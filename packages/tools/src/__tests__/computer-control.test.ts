import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ToolRuntime } from '../runtime';
import { createDefaultToolRegistry } from '../builtin';
import { PathAllowlist } from '../security/allowlist';
import path from 'path';

describe('Computer Control v1 (Milestone M6)', () => {
  const customAllowlist = new PathAllowlist({
    flowforge: 'C:\\Users\\MockUser\\Projects\\FlowForge',
    jarvis: 'C:\\Users\\MockUser\\Projects\\Jarvis',
  });

  const registry = createDefaultToolRegistry(customAllowlist);
  const runtime = new ToolRuntime(registry);

  it('M6 Acceptance: "Open VS Code" works and launches approved application', async () => {
    const result = await runtime.executeTool('open_application', { appId: 'vscode' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data?.appId, 'vscode');
    assert.strictEqual(result.data?.status, 'LAUNCHED');
    assert.strictEqual(result.auditEntry.status, 'SUCCESS');
  });

  it('M6 Acceptance: "open FlowForge" works and opens approved project path', async () => {
    const result = await runtime.executeTool('open_folder', { path: 'FlowForge' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data?.opened, true);
    assert.ok(result.data?.resolvedPath.includes('FlowForge'));
    assert.strictEqual(result.auditEntry.status, 'SUCCESS');
  });

  it('M6 Acceptance: Unapproved application is REJECTED', async () => {
    const result = await runtime.executeTool('open_application', { appId: 'random_malware.exe' });
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('not in the approved application allowlist'));
    assert.strictEqual(result.auditEntry.status, 'FAILED');
  });

  it('M6 Acceptance: Unapproved path is REJECTED', async () => {
    const result = await runtime.executeTool('open_folder', { path: 'C:\\Windows\\System32' });
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('outside the approved directory scopes'));
    assert.strictEqual(result.auditEntry.status, 'FAILED');
  });

  it('M6 Security: Directory traversal attacks (../) to escape approved directories are REJECTED', async () => {
    const result = await runtime.executeTool('open_folder', {
      path: path.join('C:\\Users\\MockUser\\Projects\\FlowForge', '..', '..', 'Windows'),
    });
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('outside the approved directory scopes'));
    assert.strictEqual(result.auditEntry.status, 'FAILED');
  });

  it('M6 Security: Valid HTTPS URLs succeed; malicious protocols (file:, javascript:) are REJECTED', async () => {
    // Valid HTTPS
    const validUrl = await runtime.executeTool('open_url', { url: 'https://github.com' });
    assert.strictEqual(validUrl.success, true);
    assert.strictEqual(validUrl.data?.opened, true);

    // Malicious file:
    const dangerousFile = await runtime.executeTool('open_url', { url: 'file:///C:/passwords.txt' });
    assert.strictEqual(dangerousFile.success, false);
    assert.ok(dangerousFile.error?.includes('not allowed'));

    // Malicious javascript:
    const dangerousJs = await runtime.executeTool('open_url', { url: 'javascript:alert(1)' });
    assert.strictEqual(dangerousJs.success, false);
  });

  it('M6 Security: Kill switch instantly disables computer control tools', async () => {
    runtime.setKillSwitch(true);

    const result = await runtime.executeTool('open_application', { appId: 'vscode' });
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('Global kill switch is currently active'));
    assert.strictEqual(result.auditEntry.status, 'REJECTED');

    runtime.setKillSwitch(false); // Reset
  });
});
