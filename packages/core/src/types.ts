import { ChatMessage } from '@jarvis/llm';

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

export interface ToolManifest {
  name: string;
  description: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  parameters: Record<string, ToolParameter>;
}

export interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, any>;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface OrchestratorPlan {
  thought: string;
  toolCall?: ToolCallRequest;
  response: string;
}

export interface ConversationTurn {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  plan?: OrchestratorPlan;
  toolResult?: ToolExecutionResult;
}

export interface OrchestratorOptions {
  userId?: string;
  sessionId?: string;
  systemInstruction?: string;
}

export interface OrchestratorResult {
  sessionId: string;
  response: string;
  plan: OrchestratorPlan;
  toolResult?: ToolExecutionResult;
}
