"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMProviderFactory = void 0;
exports.createLLMProvider = createLLMProvider;
const mock_provider_1 = require("./providers/mock.provider");
const ollama_provider_1 = require("./providers/ollama.provider");
const openai_compatible_provider_1 = require("./providers/openai-compatible.provider");
class LLMProviderFactory {
    static create(config) {
        switch (config.provider) {
            case 'mock':
                return new mock_provider_1.MockLLMProvider({ model: config.model });
            case 'ollama':
                return new ollama_provider_1.OllamaProvider({
                    baseUrl: config.baseUrl,
                    model: config.model,
                    timeoutMs: config.timeoutMs,
                });
            case 'openai-compatible':
                return new openai_compatible_provider_1.OpenAICompatibleProvider({
                    baseUrl: config.baseUrl,
                    model: config.model,
                    apiKey: config.apiKey,
                    timeoutMs: config.timeoutMs,
                });
            default:
                throw new Error(`Unsupported LLM provider: ${config.provider}`);
        }
    }
}
exports.LLMProviderFactory = LLMProviderFactory;
function createLLMProvider(config) {
    return LLMProviderFactory.create(config);
}
