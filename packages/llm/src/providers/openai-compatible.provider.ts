import { LLMProvider } from '../provider.interface';
import { ChatMessage, LLMChatOptions, LLMGenerateOptions, LLMResponse } from '../types';

export interface OpenAICompatibleProviderOptions {
  baseUrl?: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = 'openai-compatible';
  readonly model: string;
  private baseUrl: string;
  private apiKey?: string;
  private timeoutMs: number;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.baseUrl = (options.baseUrl || 'http://localhost:1234/v1').replace(/\/+$/, '');
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: ChatMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          stop: options?.stop,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI-compatible chat failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        model: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const choice = data.choices?.[0];
      return {
        content: choice?.message?.content ?? '',
        model: data.model || this.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        raw: data,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }
}
