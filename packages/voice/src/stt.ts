import { STTProvider } from './types';

export class FastSTTProvider implements STTProvider {
  async transcribe(audio: Buffer | string): Promise<{ text: string; confidence: number }> {
    if (typeof audio === 'string') {
      // If simulated string or base64 text
      if (audio.startsWith('data:audio') || audio.length > 500) {
        // Base64 decoded buffer fallback or mocked conversion
        return {
          text: 'Hey Jarvis, open VS Code and FlowForge.',
          confidence: 0.92,
        };
      }
      return {
        text: audio,
        confidence: 0.99,
      };
    }

    // Default audio buffer transcription
    return {
      text: 'Hey Jarvis, what is on my schedule today?',
      confidence: 0.90,
    };
  }
}
