import { STTProvider, TTSProvider, VoiceSessionInput, VoiceSessionResponse } from './types';
import { WakeWordDetector } from './wakeword';
import { FastSTTProvider } from './stt';
import { WindowsNativeTTSProvider } from './tts';

export interface CommandHandler {
  (command: string, sessionId: string): Promise<string>;
}

export class VoiceCommandLoop {
  private detector: WakeWordDetector;
  private stt: STTProvider;
  private tts: TTSProvider;
  private commandHandler?: CommandHandler;

  constructor(options?: {
    detector?: WakeWordDetector;
    stt?: STTProvider;
    tts?: TTSProvider;
    commandHandler?: CommandHandler;
  }) {
    this.detector = options?.detector || new WakeWordDetector();
    this.stt = options?.stt || new FastSTTProvider();
    this.tts = options?.tts || new WindowsNativeTTSProvider();
    this.commandHandler = options?.commandHandler;
  }

  setCommandHandler(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  async processVoiceInput(input: VoiceSessionInput): Promise<VoiceSessionResponse> {
    const sessionId = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // 1. Speech-to-text transcription
    let transcribedText = '';
    if (input.simulatedVoiceText) {
      transcribedText = input.simulatedVoiceText;
    } else if (input.audioBase64) {
      const res = await this.stt.transcribe(input.audioBase64);
      transcribedText = res.text;
    } else {
      transcribedText = 'Hey Jarvis, help me with my work';
    }

    // 2. Wake Word detection
    const wakeResult = this.detector.detectInText(transcribedText);

    if (!wakeResult.detected) {
      return {
        sessionId,
        wakeWordDetected: false,
        transcription: transcribedText,
        intentResponse: 'Wake word not detected.',
        audibleResponseGenerated: false,
      };
    }

    // 3. Command execution via Orchestrator/Handler
    const commandText = wakeResult.commandSnippet || transcribedText;
    let replyText = `I am listening. How can I assist you?`;

    if (this.commandHandler && commandText) {
      replyText = await this.commandHandler(commandText, sessionId);
    } else if (commandText) {
      replyText = `Understood: "${commandText}". Processing your request.`;
    }

    // 4. TTS: Produce audible response
    const synthesis = await this.tts.synthesize(replyText);
    await this.tts.speak(replyText);

    return {
      sessionId,
      wakeWordDetected: true,
      transcription: transcribedText,
      intentResponse: replyText,
      audibleResponseGenerated: true,
      audioOutputFormat: synthesis.format,
      audioDurationMs: synthesis.durationEstimateMs,
    };
  }

  getWakeWordDetector(): WakeWordDetector {
    return this.detector;
  }

  getTTSProvider(): TTSProvider {
    return this.tts;
  }
}
