import { TTSProvider } from './types';
import { spawn } from 'child_process';

export class WindowsNativeTTSProvider implements TTSProvider {
  private enableAudibleOutput: boolean;

  constructor(enableAudibleOutput = true) {
    this.enableAudibleOutput = enableAudibleOutput;
  }

  async synthesize(text: string): Promise<{ audioBuffer: Buffer; format: string; durationEstimateMs: number }> {
    // Generate PCM/WAV synthesized audio mock representation
    const wordCount = text.split(/\s+/).length;
    const durationEstimateMs = Math.max(800, wordCount * 300); // ~300ms per word
    const audioBuffer = Buffer.from(`RIFF_MOCK_WAV_${text}_AUDIO_SYNTHESIS`);

    return {
      audioBuffer,
      format: 'audio/wav',
      durationEstimateMs,
    };
  }

  async speak(text: string): Promise<boolean> {
    if (!this.enableAudibleOutput) return true;

    // On Windows, utilize PowerShell System.Speech.Synthesis.SpeechSynthesizer for native audio output
    if (process.platform === 'win32') {
      try {
        const cleanText = text.replace(/["`$\\]/g, ' ');
        const psCommand = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = 1; $synth.Speak("${cleanText}")`;
        
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        return true;
      } catch {
        return true;
      }
    }

    return true;
  }
}
