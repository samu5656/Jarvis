import { ChatMessage, LLMChatOptions, LLMGenerateOptions, LLMResponse } from './types';

export interface LLMProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Simple one-off completion
   */
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;

  /**
   * Multi-turn chat completion
   */
  chat(messages: ChatMessage[], options?: LLMChatOptions): Promise<LLMResponse>;

  /**
   * Checks if the LLM provider endpoint is accessible and responsive
   */
  healthCheck(): Promise<boolean>;
}
