"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLLMProvider = void 0;
class MockLLMProvider {
    name = 'mock';
    model;
    defaultResponse;
    rules = [];
    constructor(options = {}) {
        this.model = options.model ?? 'mock-model-v1';
        this.defaultResponse = options.defaultResponse ?? 'Mock LLM Response: Action parsed successfully.';
        if (options.rules) {
            this.rules = options.rules;
        }
    }
    addRule(rule) {
        this.rules.push(rule);
    }
    resolveResponse(input) {
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
    async generate(prompt, _options) {
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
    async chat(messages, _options) {
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
    async healthCheck() {
        return true;
    }
}
exports.MockLLMProvider = MockLLMProvider;
