import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MockLLMProvider } from '../providers/mock.provider';
import { OllamaProvider } from '../providers/ollama.provider';
import { OpenAICompatibleProvider } from '../providers/openai-compatible.provider';
import { createLLMProvider } from '../factory';
import { LLMProvider } from '../provider.interface';

describe('LLMProvider Abstraction and Swappability (M3)', () => {
  it('should instantiate MockLLMProvider correctly', async () => {
    const provider = new MockLLMProvider({ model: 'test-mock' });
    assert.strictEqual(provider.name, 'mock');
    assert.strictEqual(provider.model, 'test-mock');

    const res = await provider.generate('Hello Jarvis');
    assert.ok(res.content.includes('Hello Jarvis'));
    assert.strictEqual(res.model, 'test-mock');

    const health = await provider.healthCheck();
    assert.strictEqual(health, true);
  });

  it('should support custom mock rules for deterministic tool/chat responses', async () => {
    const provider = new MockLLMProvider();
    provider.addRule({
      pattern: 'weather',
      response: 'The weather is sunny and 24 degrees.',
    });

    const res = await provider.chat([{ role: 'user', content: 'What is the weather today?' }]);
    assert.strictEqual(res.content, 'The weather is sunny and 24 degrees.');
  });

  it('should allow hot-swapping providers through createLLMProvider factory without changing consumer code', async () => {
    // Orchestrator consumer function accepting generic LLMProvider
    async function runOrchestratorTurn(llm: LLMProvider, userPrompt: string) {
      return await llm.generate(userPrompt);
    }

    const mockProvider = createLLMProvider({
      provider: 'mock',
      model: 'fast-mock',
    });

    const ollamaProvider = createLLMProvider({
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3:latest',
    });

    const openaiProvider = createLLMProvider({
      provider: 'openai-compatible',
      baseUrl: 'http://localhost:1234/v1',
      model: 'local-model',
    });

    // Check types & interface consistency
    assert.strictEqual(mockProvider.name, 'mock');
    assert.strictEqual(ollamaProvider.name, 'ollama');
    assert.strictEqual(openaiProvider.name, 'openai-compatible');

    // Run orchestrator with mock provider
    const response = await runOrchestratorTurn(mockProvider, 'Open VS Code');
    assert.ok(response.content.length > 0);
  });
});
