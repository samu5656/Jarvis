import { LLMProvider } from '../provider.interface';
import { ChatMessage, LLMChatOptions, LLMGenerateOptions, LLMResponse } from '../types';
export interface OpenAICompatibleProviderOptions {
    baseUrl?: string;
    model: string;
    apiKey?: string;
    timeoutMs?: number;
}
export declare class OpenAICompatibleProvider implements LLMProvider {
    readonly name = "openai-compatible";
    readonly model: string;
    private baseUrl;
    private apiKey?;
    private timeoutMs;
    constructor(options: OpenAICompatibleProviderOptions);
    private getHeaders;
    generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
    chat(messages: ChatMessage[], options?: LLMChatOptions): Promise<LLMResponse>;
    healthCheck(): Promise<boolean>;
}
