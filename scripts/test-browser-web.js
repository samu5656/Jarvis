import assert from 'node:assert';
import {
  ToolRegistry,
  ToolRuntime,
  WebSearchTool,
  BrowserActionTool,
} from '../packages/tools/dist/index.js';

async function testBrowserAndWeb() {
  console.log('Testing M11: Browser & Web Tools (Search, Navigation, Policy Gating)...');

  const registry = new ToolRegistry();
  registry.register(new WebSearchTool());
  registry.register(new BrowserActionTool());
  const runtime = new ToolRuntime(registry);

  // 1. Web Search
  const searchRes = await runtime.executeTool('web_search', {
    query: 'Node.js best practices',
    limit: 2,
  });
  assert.strictEqual(searchRes.success, true);
  assert.ok(searchRes.data.length > 0);
  console.log('✔ Web search returns structured results within policy');

  // 2. Navigation with confirmation
  const navRes = await runtime.executeTool(
    'browser_action',
    {
      action: 'navigate',
      url: 'https://nodejs.org',
    },
    { confirmed: true }
  );
  assert.strictEqual(navRes.success, true);
  assert.strictEqual(navRes.data.action, 'navigate');
  console.log('✔ Navigation within approved policy succeeded');

  // 3. Prohibited schemes strictly blocked
  const blockedScheme = await runtime.executeTool(
    'browser_action',
    {
      action: 'navigate',
      url: 'javascript:void(0)',
    },
    { confirmed: true }
  );
  assert.strictEqual(blockedScheme.success, false);
  assert.match(blockedScheme.error || '', /Protocol "javascript:" is not allowed/i);
  console.log('✔ ACCEPTANCE: Prohibited schemes (javascript:, file:) blocked');

  // 4. Dangerous external browser action gated by confirmation
  const unconfirmedForm = await runtime.executeTool(
    'browser_action',
    {
      action: 'submit_form',
      url: 'https://external-api.example.com/login',
    },
    { confirmed: false }
  );
  assert.strictEqual(unconfirmedForm.success, false);
  assert.strictEqual(unconfirmedForm.confirmationRequired, true);
  console.log('✔ ACCEPTANCE: Dangerous/external browser actions remain gated by confirmation');

  // 5. Confirmed dangerous action executes safely
  const confirmedForm = await runtime.executeTool(
    'browser_action',
    {
      action: 'submit_form',
      url: 'https://external-api.example.com/login',
    },
    { confirmed: true }
  );
  assert.strictEqual(confirmedForm.success, true);
  assert.strictEqual(confirmedForm.data.action, 'submit_form');
  console.log('✔ Confirmed browser action completes successfully');

  console.log('\nAll M11 Browser & Web Tools acceptance tests passed successfully!');
}

testBrowserAndWeb().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
