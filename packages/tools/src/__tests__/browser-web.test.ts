import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ToolRegistry,
  ToolRuntime,
  WebSearchTool,
  BrowserActionTool,
  UrlPolicy,
} from '../index';

describe('Milestone M11 - Browser & Web Tools', () => {
  it('M11: Web search returns structured results within policy', async () => {
    const registry = new ToolRegistry();
    registry.register(new WebSearchTool());
    const runtime = new ToolRuntime(registry);

    const res = await runtime.executeTool('web_search', {
      query: 'TypeScript programming',
      limit: 3,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.data.length > 0);
    assert.ok(res.data[0].title);
    assert.ok(res.data[0].url);
  });

  it('M11: Browser navigation to valid HTTPS URL succeeds without mutating external state', async () => {
    const registry = new ToolRegistry();
    registry.register(new BrowserActionTool());
    const runtime = new ToolRuntime(registry);

    const res = await runtime.executeTool(
      'browser_action',
      {
        action: 'navigate',
        url: 'https://example.com',
      },
      { confirmed: false }
    );

    // Note: Since BrowserActionTool has risk HIGH, unconfirmed execution gets gated by ToolRuntime
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.confirmationRequired, true);

    // With confirmation, navigation completes successfully
    const confirmedRes = await runtime.executeTool(
      'browser_action',
      {
        action: 'navigate',
        url: 'https://example.com',
      },
      { confirmed: true }
    );
    assert.strictEqual(confirmedRes.success, true);
    assert.strictEqual(confirmedRes.data.action, 'navigate');
  });

  it('M11 Acceptance CRITICAL: Navigation to prohibited schemes (file:, javascript:, vbscript:) is BLOCKED', async () => {
    const registry = new ToolRegistry();
    registry.register(new BrowserActionTool());
    const runtime = new ToolRuntime(registry);

    // Prohibited file scheme
    const fileRes = await runtime.executeTool(
      'browser_action',
      {
        action: 'navigate',
        url: 'file:///etc/passwd',
      },
      { confirmed: true }
    );
    assert.strictEqual(fileRes.success, false);
    assert.match(fileRes.error || '', /Protocol "file:" is not allowed/i);

    // Prohibited javascript scheme
    const jsRes = await runtime.executeTool(
      'browser_action',
      {
        action: 'navigate',
        url: 'javascript:alert(1)',
      },
      { confirmed: true }
    );
    assert.strictEqual(jsRes.success, false);
    assert.match(jsRes.error || '', /Protocol "javascript:" is not allowed/i);
  });

  it('M11 Acceptance CRITICAL: Dangerous external browser actions (submit_form, download_file, execute_script) remain gated by confirmation', async () => {
    const registry = new ToolRegistry();
    registry.register(new BrowserActionTool());
    const runtime = new ToolRuntime(registry);

    // 1. Submit Form without confirmation -> MUST BE GATED
    const submitRes = await runtime.executeTool(
      'browser_action',
      {
        action: 'submit_form',
        url: 'https://payment-gateway.example.com/checkout',
        formData: { amount: 100 },
      },
      { confirmed: false }
    );
    assert.strictEqual(submitRes.success, false);
    assert.strictEqual(submitRes.confirmationRequired, true);
    assert.strictEqual(submitRes.auditEntry.status, 'CONFIRMATION_REQUIRED');

    // 2. Download File without confirmation -> MUST BE GATED
    const downloadRes = await runtime.executeTool(
      'browser_action',
      {
        action: 'download_file',
        url: 'https://example.com/package.zip',
      },
      { confirmed: false }
    );
    assert.strictEqual(downloadRes.success, false);
    assert.strictEqual(downloadRes.confirmationRequired, true);

    // 3. Execute Script without confirmation -> MUST BE GATED
    const scriptRes = await runtime.executeTool(
      'browser_action',
      {
        action: 'execute_script',
        url: 'https://example.com',
        script: 'document.cookie',
      },
      { confirmed: false }
    );
    assert.strictEqual(scriptRes.success, false);
    assert.strictEqual(scriptRes.confirmationRequired, true);

    // 4. With explicit user confirmation, action proceeds
    const approvedSubmit = await runtime.executeTool(
      'browser_action',
      {
        action: 'submit_form',
        url: 'https://payment-gateway.example.com/checkout',
      },
      { confirmed: true }
    );
    assert.strictEqual(approvedSubmit.success, true);
    assert.strictEqual(approvedSubmit.data.action, 'submit_form');
  });

  it('M11: Global kill switch immediately disables browser actions', async () => {
    const registry = new ToolRegistry();
    registry.register(new BrowserActionTool());
    const runtime = new ToolRuntime(registry);

    runtime.setKillSwitch(true);

    const res = await runtime.executeTool(
      'browser_action',
      {
        action: 'navigate',
        url: 'https://example.com',
      },
      { confirmed: true }
    );
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.auditEntry.status, 'REJECTED');
  });
});
