import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MockLLMProvider } from '@jarvis/llm';
import { JarvisOrchestrator } from '../orchestrator';
import { StructuredPlanner } from '../planner';

describe('Jarvis Orchestrator (Milestone M4)', () => {
  it('should parse structured tool planning from LLM JSON response', () => {
    const rawJson = `\`\`\`json
{
  "thought": "The user wants to record a homework assignment. I will use the create_task tool.",
  "toolCall": {
    "toolName": "create_task",
    "arguments": {
      "title": "Submit DAA assignment",
      "dueAt": "Tomorrow 5 PM"
    }
  },
  "response": "I have created the task for submitting your DAA assignment by tomorrow 5 PM."
}
\`\`\``;

    const mockManifests = [
      {
        name: 'create_task',
        description: 'Creates a task',
        risk: 'LOW' as const,
        parameters: {},
      },
    ];

    const plan = StructuredPlanner.parsePlan(rawJson, mockManifests);
    assert.strictEqual(plan.thought, 'The user wants to record a homework assignment. I will use the create_task tool.');
    assert.ok(plan.toolCall);
    assert.strictEqual(plan.toolCall.toolName, 'create_task');
    assert.strictEqual(plan.toolCall.arguments.title, 'Submit DAA assignment');
    assert.strictEqual(plan.response, 'I have created the task for submitting your DAA assignment by tomorrow 5 PM.');
  });

  it('M4 Acceptance Criteria: "Create a task..." results in a validated tool call and natural response', async () => {
    const mockLlm = new MockLLMProvider();

    // Configure deterministic rule on the LLM mock for create task prompt
    mockLlm.addRule({
      pattern: 'Create a task',
      response: JSON.stringify({
        thought: 'User explicitly requested creating a task.',
        toolCall: {
          toolName: 'create_task',
          arguments: {
            title: 'Submit DAA assignment',
            dueAt: 'tomorrow',
          },
        },
        response: 'Task created: Submit DAA assignment due tomorrow.',
      }),
    });

    const orchestrator = new JarvisOrchestrator(mockLlm);

    const result = await orchestrator.processMessage(
      'Create a task to submit DAA assignment by tomorrow',
      { sessionId: 'test-session-1' }
    );

    // Verify structured plan
    assert.ok(result.plan, 'Plan must exist');
    assert.strictEqual(result.plan.thought, 'User explicitly requested creating a task.');

    // Verify validated tool call
    assert.ok(result.plan.toolCall, 'Tool call must be present');
    assert.strictEqual(result.plan.toolCall.toolName, 'create_task');
    assert.strictEqual(result.plan.toolCall.arguments.title, 'Submit DAA assignment');
    assert.strictEqual(result.plan.toolCall.risk, 'LOW');

    // Verify validated tool execution
    assert.ok(result.toolResult, 'Tool result must be present');
    assert.strictEqual(result.toolResult.success, true);
    assert.strictEqual(result.toolResult.data.title, 'Submit DAA assignment');
    assert.strictEqual(result.toolResult.data.status, 'PENDING');

    // Verify natural conversational response
    assert.strictEqual(result.response, 'Task created: Submit DAA assignment due tomorrow.');
  });

  it('should preserve conversation turns across multiple messages in a session', async () => {
    const mockLlm = new MockLLMProvider();
    const orchestrator = new JarvisOrchestrator(mockLlm);

    await orchestrator.processMessage('Hello Jarvis', { sessionId: 'session-history' });
    await orchestrator.processMessage('What is your name?', { sessionId: 'session-history' });

    const history = orchestrator.getConversationHistory('session-history');
    assert.strictEqual(history.length, 4); // 2 user turns + 2 assistant turns
    assert.strictEqual(history[0].role, 'user');
    assert.strictEqual(history[0].content, 'Hello Jarvis');
    assert.strictEqual(history[1].role, 'assistant');
    assert.strictEqual(history[2].role, 'user');
    assert.strictEqual(history[2].content, 'What is your name?');
  });

  it('should safely handle conversational inputs without tool calls', async () => {
    const mockLlm = new MockLLMProvider();
    mockLlm.addRule({
      pattern: 'How are you',
      response: JSON.stringify({
        thought: 'Friendly greeting; no tool required.',
        toolCall: null,
        response: "I'm functioning smoothly, thank you! How can I assist you today?",
      }),
    });

    const orchestrator = new JarvisOrchestrator(mockLlm);
    const result = await orchestrator.processMessage('How are you?', { sessionId: 'chat-only' });

    assert.strictEqual(result.plan.toolCall, undefined);
    assert.strictEqual(result.response, "I'm functioning smoothly, thank you! How can I assist you today?");
  });
});
