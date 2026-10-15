"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = void 0;
class OllamaProvider {
    name = 'ollama';
    model;
    baseUrl;
    timeoutMs;
    constructor(options) {
        this.baseUrl = (options.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        this.model = options.model;
        this.timeoutMs = options.timeoutMs ?? 30000;
    }
    async generate(prompt, options) {
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
            const data = (await response.json());
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
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async chat(messages, options) {
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
            const data = (await response.json());
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
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async healthCheck() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${this.baseUrl}/api/version`, { signal: controller.signal });
            clearTimeout(timeout);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
exports.OllamaProvider = OllamaProvider;
