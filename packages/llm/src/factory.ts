import { LLMProvider } from './provider.interface';
import { MockLLMProvider } from './providers/mock.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider';
import { LLMConfig } from './types';

export class LLMProviderFactory {
  static create(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'mock':
        return new MockLLMProvider({ model: config.model });
      case 'ollama':
        return new OllamaProvider({
          baseUrl: config.baseUrl,
          model: config.model,
          timeoutMs: config.timeoutMs,
        });
      case 'openai-compatible':
        return new OpenAICompatibleProvider({
          baseUrl: config.baseUrl,
          model: config.model,
          apiKey: config.apiKey,
          timeoutMs: config.timeoutMs,
        });
      default:
        throw new Error(`Unsupported LLM provider: ${(config as any).provider}`);
    }
  }
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  return LLMProviderFactory.create(config);
}
