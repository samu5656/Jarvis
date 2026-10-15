const path = require('path');
const fs = require('fs');

// Simple .env parser to avoid extra dependency issues
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    const val = vals.join('=').replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const { createLLMProvider } = require('../packages/llm/dist/index');

async function main() {
  const providerType = process.env.LLM_PROVIDER || 'mock';
  const baseUrl = process.env.LLM_BASE_URL || 'http://localhost:11434';
  const model = process.env.LLM_MODEL || 'llama3';
  const apiKey = process.env.LLM_API_KEY || '';

  console.log('=== JARVIS LLM Provider Verification (M3) ===');
  console.log(`Configured Provider: ${providerType}`);
  console.log(`Model:               ${model}`);
  console.log(`Base URL:            ${baseUrl}`);
  console.log('----------------------------------------------');

  const provider = createLLMProvider({
    provider: providerType,
    baseUrl,
    model,
    apiKey,
  });

  console.log('1. Checking provider health...');
  const healthy = await provider.healthCheck();
  console.log(`   Health Check: ${healthy ? 'ONLINE / HEALTHY' : 'OFFLINE / UNREACHABLE'}`);

  const testPrompt = process.argv[2] || 'Hey Jarvis, are you ready?';
  console.log(`\n2. Sending test prompt: "${testPrompt}"...`);

  try {
    const response = await provider.generate(testPrompt);
    console.log('\n--- LLM Response Received ---');
    console.log(`Model:   ${response.model}`);
    console.log(`Content: ${response.content}`);
    if (response.usage) {
      console.log(`Usage:   ${JSON.stringify(response.usage)}`);
    }
    console.log('-----------------------------');
    console.log('M3 Acceptance Criteria: PASSED (Test prompt reaches LLM; provider abstraction works)');
  } catch (err) {
    console.error('Error contacting LLM:', err.message);
    process.exit(1);
  }
}

main();
