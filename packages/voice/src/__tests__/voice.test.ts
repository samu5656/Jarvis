import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  WakeWordDetector,
  FastSTTProvider,
  WindowsNativeTTSProvider,
  VoiceCommandLoop,
} from '../index';

describe('Milestone M12 - Voice (Wake Word, STT, TTS, Hands-Free Command Loop)', () => {
  it('M12: Wake word detector correctly detects "Hey Jarvis" and extracts subsequent command', () => {
    const detector = new WakeWordDetector();

    // Exact phrase
    const res1 = detector.detectInText('Hey Jarvis, open VS Code and my project');
    assert.strictEqual(res1.detected, true);
    assert.strictEqual(res1.commandSnippet, 'open vs code and my project');
    assert.ok(res1.confidence >= 0.8);

    // Natural variation
    const res2 = detector.detectInText('Hello Jarvis what is my next meeting');
    assert.strictEqual(res2.detected, true);
    assert.strictEqual(res2.commandSnippet, 'what is my next meeting');

    // Negative case (wake word absent)
    const res3 = detector.detectInText('Just a random conversation about code');
    assert.strictEqual(res3.detected, false);
    assert.strictEqual(res3.commandSnippet, undefined);
  });

  it('M12: STT transcribes spoken voice payload accurately', async () => {
    const stt = new FastSTTProvider();
    const result = await stt.transcribe('Hey Jarvis, what tasks do I have today?');
    assert.strictEqual(result.text, 'Hey Jarvis, what tasks do I have today?');
    assert.ok(result.confidence > 0.8);
  });

  it('M12: TTS synthesizes audible audio output with valid buffer and duration', async () => {
    const tts = new WindowsNativeTTSProvider(false); // disable audible audio device during unit test runner
    const synthesis = await tts.synthesize('Good morning. You have two scheduled meetings today.');
    assert.strictEqual(synthesis.format, 'audio/wav');
    assert.ok(synthesis.audioBuffer.length > 0);
    assert.ok(synthesis.durationEstimateMs > 0);
  });

  it('M12 Acceptance Criteria: "Hey Jarvis" starts a command session and produces an audible response', async () => {
    const voiceLoop = new VoiceCommandLoop({
      tts: new WindowsNativeTTSProvider(false),
      commandHandler: async (command, sessionId) => {
        assert.ok(sessionId.startsWith('voice_'));
        return `Jarvis executed command: ${command}`;
      },
    });

    const session = await voiceLoop.processVoiceInput({
      simulatedVoiceText: 'Hey Jarvis, check my upcoming calendar events',
    });

    // Acceptance checks
    assert.strictEqual(session.wakeWordDetected, true);
    assert.ok(session.sessionId.startsWith('voice_'));
    assert.strictEqual(session.audibleResponseGenerated, true);
    assert.strictEqual(session.audioOutputFormat, 'audio/wav');
    assert.ok(session.audioDurationMs! > 0);
    assert.strictEqual(session.intentResponse, 'Jarvis executed command: check my upcoming calendar events');
  });

  it('M12: Voice command loop ignores input without wake word', async () => {
    const voiceLoop = new VoiceCommandLoop({
      tts: new WindowsNativeTTSProvider(false),
    });

    const session = await voiceLoop.processVoiceInput({
      simulatedVoiceText: 'Turn off the lights in the other room',
    });

    assert.strictEqual(session.wakeWordDetected, false);
    assert.strictEqual(session.audibleResponseGenerated, false);
    assert.strictEqual(session.intentResponse, 'Wake word not detected.');
  });
});
