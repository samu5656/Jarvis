import { LLMProvider } from '../provider.interface';
import { ChatMessage, LLMChatOptions, LLMGenerateOptions, LLMResponse } from '../types';
export interface MockResponseRule {
    pattern?: RegExp | string;
    response: string;
}
export declare class MockLLMProvider implements LLMProvider {
    readonly name = "mock";
    readonly model: string;
    private defaultResponse;
    private rules;
    constructor(options?: {
        model?: string;
        defaultResponse?: string;
        rules?: MockResponseRule[];
    });
    addRule(rule: MockResponseRule): void;
    private resolveResponse;
    generate(prompt: string, _options?: LLMGenerateOptions): Promise<LLMResponse>;
    chat(messages: ChatMessage[], _options?: LLMChatOptions): Promise<LLMResponse>;
    healthCheck(): Promise<boolean>;
}
