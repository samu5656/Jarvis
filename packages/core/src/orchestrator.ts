import { LLMProvider } from '@jarvis/llm';
import { createDefaultToolRegistry, ToolRegistry, ToolRuntime, AuditLogger } from '@jarvis/tools';
import { ConversationManager } from './conversation';
import { buildSystemPrompt } from './prompt';
import { StructuredPlanner } from './planner';
import {
  OrchestratorOptions,
  OrchestratorPlan,
  OrchestratorResult,
  ToolExecutionResult,
  ToolManifest,
} from './types';

export class JarvisOrchestrator {
  private llm: LLMProvider;
  private conversation: ConversationManager;
  private runtime: ToolRuntime;

  constructor(llm: LLMProvider, options?: { maxTurns?: number; runtime?: ToolRuntime }) {
    this.llm = llm;
    this.conversation = new ConversationManager({ maxTurns: options?.maxTurns });
    this.runtime = options?.runtime || new ToolRuntime(createDefaultToolRegistry(), new AuditLogger());
  }

  getRuntime(): ToolRuntime {
    return this.runtime;
  }

  getAuditLogger(): AuditLogger {
    return this.runtime.getAuditLogger();
  }

  getRegisteredTools(): ToolManifest[] {
    return this.runtime.getRegistry().list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      risk: tool.risk,
      parameters: {},
    }));
  }

  async processMessage(userPrompt: string, options: OrchestratorOptions = {}): Promise<OrchestratorResult> {
    const sessionId = options.sessionId || 'default-session';
    const availableTools = this.getRegisteredTools();
    const systemPrompt = buildSystemPrompt(availableTools, options.systemInstruction);

    // 1. Record user turn in conversation history
    this.conversation.addTurn(sessionId, {
      role: 'user',
      content: userPrompt,
    });

    // 2. Prepare LLM conversation history
    const messages = this.conversation.toLLMMessages(sessionId, systemPrompt);

    // 3. Request LLM turn
    const llmResponse = await this.llm.chat(messages);

    // 4. Parse structured plan and tool selection
    const plan: OrchestratorPlan = StructuredPlanner.parsePlan(llmResponse.content, availableTools);

    // 5. Execute validated tool call through ToolRuntime
    let toolResult: ToolExecutionResult | undefined = undefined;
    if (plan.toolCall) {
      const runtimeResponse = await this.runtime.executeTool(
        plan.toolCall.toolName,
        plan.toolCall.arguments,
        {
          userId: options.userId,
          sessionId,
        }
      );

      toolResult = {
        success: runtimeResponse.success,
        data: runtimeResponse.data,
        error: runtimeResponse.error,
      };
    }

    // 6. Record assistant turn in conversation history
    this.conversation.addTurn(sessionId, {
      role: 'assistant',
      content: plan.response,
      plan,
      toolResult,
    });

    return {
      sessionId,
      response: plan.response,
      plan,
      toolResult,
    };
  }

  getConversationHistory(sessionId = 'default-session') {
    return this.conversation.getHistory(sessionId);
  }
}
