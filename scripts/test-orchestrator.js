const path = require('path');
const fs = require('fs');

// Simple .env parser
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

const { createLLMProvider, MockLLMProvider } = require('../packages/llm/dist/index');
const { JarvisOrchestrator } = require('../packages/core/dist/index');

async function main() {
  console.log('=== JARVIS Orchestrator Verification (M4) ===');

  const providerType = process.env.LLM_PROVIDER || 'mock';
  let llm;

  if (providerType === 'mock') {
    const mock = new MockLLMProvider();
    mock.addRule({
      pattern: 'Create a task',
      response: JSON.stringify({
        thought: 'User wants to create a new task. I will invoke the create_task tool.',
        toolCall: {
          toolName: 'create_task',
          arguments: {
            title: 'Submit DAA assignment',
            dueAt: 'tomorrow 5 PM',
          },
        },
        response: 'I have created the task "Submit DAA assignment" due tomorrow at 5 PM.',
      }),
    });
    mock.addRule({
      pattern: 'open',
      response: JSON.stringify({
        thought: 'User wants to launch an application.',
        toolCall: {
          toolName: 'open_application',
          arguments: {
            appId: 'vscode',
          },
        },
        response: 'Opening VS Code for you now.',
      }),
    });
    llm = mock;
  } else {
    llm = createLLMProvider({
      provider: providerType,
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL || 'llama3',
      apiKey: process.env.LLM_API_KEY,
    });
  }

  const orchestrator = new JarvisOrchestrator(llm);
  const userPrompt = process.argv[2] || 'Create a task to submit DAA assignment by tomorrow';

  console.log(`User Prompt: "${userPrompt}"\n`);
  console.log('Processing through JarvisOrchestrator...');

  const result = await orchestrator.processMessage(userPrompt, { sessionId: 'test-session' });

  console.log('\n--- Orchestrator Result ---');
  console.log('Session ID:', result.sessionId);
  console.log('Internal Thought:', result.plan.thought);

  if (result.plan.toolCall) {
    console.log('\n[Validated Tool Call]');
    console.log('  Tool Name: ', result.plan.toolCall.toolName);
    console.log('  Risk Level:', result.plan.toolCall.risk);
    console.log('  Arguments: ', JSON.stringify(result.plan.toolCall.arguments));
  } else {
    console.log('\n[No Tool Call Needed]');
  }

  if (result.toolResult) {
    console.log('\n[Tool Execution Result]');
    console.log('  Success:', result.toolResult.success);
    console.log('  Data:   ', JSON.stringify(result.toolResult.data));
  }

  console.log('\n[Natural User Response]');
  console.log(' ', result.response);
  console.log('---------------------------');

  if (result.plan.toolCall && result.response) {
    console.log('\nM4 Acceptance Criteria: PASSED (Validated tool call and natural response produced)');
  }
}

main();
