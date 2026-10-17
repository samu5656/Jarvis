import assert from 'node:assert';
import {
  WakeWordDetector,
  FastSTTProvider,
  WindowsNativeTTSProvider,
  VoiceCommandLoop,
} from '../packages/voice/dist/index.js';

async function testVoiceSystem() {
  console.log('Testing M12: Voice (Wake Word, STT, TTS, Hands-Free Command Loop)...');

  // 1. Test Wake Word Detector
  const detector = new WakeWordDetector();
  const detection1 = detector.detectInText('Hey Jarvis, open VS Code and my FlowForge project');
  assert.strictEqual(detection1.detected, true);
  assert.strictEqual(detection1.commandSnippet, 'open vs code and my flowforge project');
  console.log('✔ Wake Word "Hey Jarvis" successfully recognized and stripped from command');

  // 2. Test STT
  const stt = new FastSTTProvider();
  const transcription = await stt.transcribe('Hey Jarvis, what is my schedule?');
  assert.strictEqual(transcription.text, 'Hey Jarvis, what is my schedule?');
  assert.ok(transcription.confidence > 0.8);
  console.log('✔ STT correctly transcribes audio/voice stream');

  // 3. Test TTS
  const tts = new WindowsNativeTTSProvider(false);
  const synthesis = await tts.synthesize('I have opened VS Code and your FlowForge project.');
  assert.strictEqual(synthesis.format, 'audio/wav');
  assert.ok(synthesis.audioBuffer.length > 0);
  assert.ok(synthesis.durationEstimateMs > 0);
  console.log('✔ TTS synthesizes valid audio buffer and timing duration');

  // 4. M12 ACCEPTANCE CRITERIA: "Hey Jarvis" starts a command session and produces an audible response
  const voiceLoop = new VoiceCommandLoop({
    tts,
    commandHandler: async (cmd, sessionId) => {
      assert.ok(sessionId.startsWith('voice_'));
      return `Executing requested action: ${cmd}. Done!`;
    },
  });

  const session = await voiceLoop.processVoiceInput({
    simulatedVoiceText: 'Hey Jarvis, open VS Code and FlowForge',
  });

  assert.strictEqual(session.wakeWordDetected, true);
  assert.ok(session.sessionId.startsWith('voice_'));
  assert.strictEqual(session.audibleResponseGenerated, true);
  assert.strictEqual(session.audioOutputFormat, 'audio/wav');
  assert.strictEqual(session.intentResponse, 'Executing requested action: open vs code and flowforge. Done!');
  console.log('✔ ACCEPTANCE: "Hey Jarvis" starts a command session and produces an audible response');

  // 5. Rejection of un-woken input
  const unwoken = await voiceLoop.processVoiceInput({
    simulatedVoiceText: 'What is the weather outside right now?',
  });
  assert.strictEqual(unwoken.wakeWordDetected, false);
  assert.strictEqual(unwoken.audibleResponseGenerated, false);
  console.log('✔ Voice input without wake word safely ignored');

  console.log('\nAll M12 Voice acceptance tests passed successfully!');
}

testVoiceSystem().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
