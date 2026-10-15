export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface LLMChatOptions extends LLMGenerateOptions {}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export type LLMProviderType = 'mock' | 'ollama' | 'openai-compatible';

export interface LLMConfig {
  provider: LLMProviderType;
  baseUrl?: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}
