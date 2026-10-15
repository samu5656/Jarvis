import { LLMProvider } from './provider.interface';
import { LLMConfig } from './types';
export declare class LLMProviderFactory {
    static create(config: LLMConfig): LLMProvider;
}
export declare function createLLMProvider(config: LLMConfig): LLMProvider;
