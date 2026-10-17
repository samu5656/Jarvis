import { z } from 'zod';

export interface WakeWordConfig {
  wakePhrase?: string; // Default: "hey jarvis"
  sensitivity?: number; // 0.0 to 1.0
  activeTimeoutMs?: number;
}

export interface WakeWordDetectionResult {
  detected: boolean;
  commandSnippet?: string;
  confidence: number;
  timestamp: string;
}

export interface STTProvider {
  transcribe(audio: Buffer | string): Promise<{ text: string; confidence: number }>;
}

export interface TTSProvider {
  synthesize(text: string): Promise<{ audioBuffer: Buffer; format: string; durationEstimateMs: number }>;
  speak(text: string): Promise<boolean>;
}

export const VoiceSessionInputSchema = z.object({
  audioBase64: z.string().optional(),
  simulatedVoiceText: z.string().optional(),
  wakePhrase: z.string().optional(),
});

export type VoiceSessionInput = z.infer<typeof VoiceSessionInputSchema>;

export interface VoiceSessionResponse {
  sessionId: string;
  wakeWordDetected: boolean;
  transcription: string;
  intentResponse: string;
  audibleResponseGenerated: boolean;
  audioOutputFormat?: string;
  audioDurationMs?: number;
}
