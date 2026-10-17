import { VoiceCommandLoop, WindowsNativeTTSProvider } from '../packages/voice/dist/index.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_BASE = 'http://localhost:3000/api/v1';

async function main() {
  console.log('=== Jarvis Hands-Free Voice Listener (Microphone Simulation / CLI Loop) ===');
  console.log('Audio speech output enabled:', process.env.VOICE_AUDIO_OUTPUT === 'true');
  console.log('\nSay or type your command starting with "Hey Jarvis" (e.g. "Hey Jarvis, open VS Code"):');
  console.log('Type "exit" to quit.\n');

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question('🎤 Listening > ', async (input) => {
      const trimmed = input.trim();
      if (trimmed.toLowerCase() === 'exit') {
        rl.close();
        process.exit(0);
      }

      if (!trimmed) {
        promptUser();
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/voice/listen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simulatedVoiceText: trimmed }),
        });

        const data = await response.json();
        if (data.wakeWordDetected) {
          console.log(`\n🤖 Jarvis: "${data.intentResponse}"\n`);
        } else {
          console.log('ℹ️ (No wake word detected. Say "Hey Jarvis ..." to activate)\n');
        }
      } catch (err) {
        console.error('❌ Could not connect to Jarvis API (make sure npm run dev:api is running):', err.message);
      }

      promptUser();
    });
  };

  promptUser();
}

main().catch(console.error);
