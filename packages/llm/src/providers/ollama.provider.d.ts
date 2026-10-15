import { LLMProvider } from '../provider.interface';
import { ChatMessage, LLMChatOptions, LLMGenerateOptions, LLMResponse } from '../types';
export interface OllamaProviderOptions {
    baseUrl?: string;
    model: string;
    timeoutMs?: number;
}
export declare class OllamaProvider implements LLMProvider {
    readonly name = "ollama";
    readonly model: string;
    private baseUrl;
    private timeoutMs;
    constructor(options: OllamaProviderOptions);
    generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
    chat(messages: ChatMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
    healthCheck(): Promise<boolean>;
}
