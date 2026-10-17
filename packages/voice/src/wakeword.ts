import { WakeWordConfig, WakeWordDetectionResult } from './types';

export class WakeWordDetector {
  private wakePhrase: string;
  private sensitivity: number;

  constructor(config?: WakeWordConfig) {
    this.wakePhrase = (config?.wakePhrase || 'hey jarvis').toLowerCase().trim();
    this.sensitivity = config?.sensitivity ?? 0.8;
  }

  detectInText(input: string): WakeWordDetectionResult {
    const textLower = input.toLowerCase().trim();
    const index = textLower.indexOf(this.wakePhrase);

    if (index !== -1) {
      // Extract command after wake word
      const commandSnippet = textLower.slice(index + this.wakePhrase.length).replace(/^[,.\s]+/, '').trim();
      return {
        detected: true,
        commandSnippet,
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      };
    }

    // Levenshtein / fuzzy partial match for natural wake phrase variations (e.g. "hay jarvis", "hi jarvis")
    const words = textLower.split(/\s+/);
    if (words.length >= 2) {
      const firstTwo = `${words[0]} ${words[1]}`;
      if (firstTwo === 'hi jarvis' || firstTwo === 'hay jarvis' || firstTwo === 'hello jarvis') {
        const commandSnippet = words.slice(2).join(' ').trim();
        return {
          detected: true,
          commandSnippet,
          confidence: 0.85,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      detected: false,
      confidence: 0.0,
      timestamp: new Date().toISOString(),
    };
  }

  getWakePhrase(): string {
    return this.wakePhrase;
  }
}
