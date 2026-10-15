import { LLMProvider } from '../provider.interface';
import { ChatMessage, LLMChatOptions, LLMGenerateOptions, LLMResponse } from '../types';

export interface OllamaProviderOptions {
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: OllamaProviderOptions) {
    this.baseUrl = (options.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature,
            num_predict: options?.maxTokens,
            stop: options?.stop,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama generate failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        response: string;
        model: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        content: data.response,
        model: data.model || this.model,
        usage: {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
        raw: data,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async chat(messages: ChatMessage[], options?: LLMChatOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          options: {
            temperature: options?.temperature,
            num_predict: options?.maxTokens,
            stop: options?.stop,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama chat failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        message: { content: string; role: string };
        model: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        content: data.message?.content ?? '',
        model: data.model || this.model,
        usage: {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
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
      const res = await fetch(`${this.baseUrl}/api/version`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }
}
