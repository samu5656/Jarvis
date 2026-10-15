import { LLMProvider } from '../provider.interface';
import { ChatMessage, LLMChatOptions, LLMGenerateOptions, LLMResponse } from '../types';

export interface MockResponseRule {
  pattern?: RegExp | string;
  response: string;
}

export class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly model: string;
  private defaultResponse: string;
  private rules: MockResponseRule[] = [];

  constructor(options: { model?: string; defaultResponse?: string; rules?: MockResponseRule[] } = {}) {
    this.model = options.model ?? 'mock-model-v1';
    this.defaultResponse = options.defaultResponse ?? 'Mock LLM Response: Action parsed successfully.';
    if (options.rules) {
      this.rules = options.rules;
    }
  }

  addRule(rule: MockResponseRule): void {
    this.rules.push(rule);
  }

  private resolveResponse(input: string): string {
    for (const rule of this.rules) {
      if (typeof rule.pattern === 'string' && input.includes(rule.pattern)) {
        return rule.response;
      }
      if (rule.pattern instanceof RegExp && rule.pattern.test(input)) {
        return rule.response;
      }
    }
    return `${this.defaultResponse} [Echo: ${input.slice(0, 50)}]`;
  }

  async generate(prompt: string, _options?: LLMGenerateOptions): Promise<LLMResponse> {
    const text = this.resolveResponse(prompt);
    return {
      content: text,
      model: this.model,
      usage: {
        promptTokens: prompt.split(/\s+/).length,
        completionTokens: text.split(/\s+/).length,
        totalTokens: prompt.split(/\s+/).length + text.split(/\s+/).length,
      },
    };
  }

  async chat(messages: ChatMessage[], _options?: LLMChatOptions): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1]?.content ?? '';
    const text = this.resolveResponse(lastMessage);
    return {
      content: text,
      model: this.model,
      usage: {
        promptTokens: messages.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0),
        completionTokens: text.split(/\s+/).length,
        totalTokens: 0,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
