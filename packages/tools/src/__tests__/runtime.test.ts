import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ToolRuntime } from '../runtime';
import { ToolRegistry } from '../registry';
import { AuditLogger } from '../audit';
import { CreateTaskTool } from '../builtin/create-task';
import { DeleteProjectTool } from '../builtin/delete-project';

describe('Tool Runtime & Security Lifecycle (Milestone M5)', () => {
  it('M5 Acceptance: Unknown tools CANNOT execute, and the rejection is logged', async () => {
    const registry = new ToolRegistry();
    const auditLogger = new AuditLogger();
    const runtime = new ToolRuntime(registry, auditLogger);

    const result = await runtime.executeTool('non_existent_tool', { foo: 'bar' });

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('not registered'));

    // Verify audit logging
    const logs = auditLogger.getLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].toolName, 'non_existent_tool');
    assert.strictEqual(logs[0].status, 'REJECTED');
    assert.ok(logs[0].error?.includes('not registered'));
  });

  it('M5 Acceptance: Invalid tools/arguments CANNOT execute, and the rejection is logged', async () => {
    const registry = new ToolRegistry();
    registry.register(new CreateTaskTool());
    const auditLogger = new AuditLogger();
    const runtime = new ToolRuntime(registry, auditLogger);

    // Missing required field 'title'
    const result = await runtime.executeTool('create_task', { description: 'Only description' });

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('Invalid input arguments'));

    // Verify audit logging
    const logs = auditLogger.getLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].toolName, 'create_task');
    assert.strictEqual(logs[0].status, 'REJECTED');
    assert.ok(logs[0].error?.includes('title'));
  });

  it('M5 Acceptance: Valid tool executions succeed and are recorded in audit log', async () => {
    const registry = new ToolRegistry();
    registry.register(new CreateTaskTool());
    const auditLogger = new AuditLogger();
    const runtime = new ToolRuntime(registry, auditLogger);

    const result = await runtime.executeTool('create_task', {
      title: 'Complete assignment',
      description: 'Before midnight',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data?.title, 'Complete assignment');
    assert.strictEqual(result.data?.status, 'PENDING');

    // Verify audit logging
    const logs = auditLogger.getLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].toolName, 'create_task');
    assert.strictEqual(logs[0].status, 'SUCCESS');
    assert.strictEqual(logs[0].result?.title, 'Complete assignment');
  });

  it('M5 Security: Sensitive credentials/passwords are automatically redacted in audit logs', async () => {
    const registry = new ToolRegistry();
    registry.register(new CreateTaskTool());
    const auditLogger = new AuditLogger();
    const runtime = new ToolRuntime(registry, auditLogger);

    await runtime.executeTool('create_task', {
      title: 'Setup DB',
      description: 'Secret config',
      password: 'super_secret_password',
      apiKey: 'xyz123',
    } as any);

    const logs = auditLogger.getLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].input.password, '***REDACTED***');
    assert.strictEqual(logs[0].input.apiKey, '***REDACTED***');
  });

  it('M5 Security: High-risk tools require explicit confirmation before executing', async () => {
    const registry = new ToolRegistry();
    registry.register(new DeleteProjectTool());
    const auditLogger = new AuditLogger();
    const runtime = new ToolRuntime(registry, auditLogger);

    // Attempt without confirmation
    const unconfirmedResult = await runtime.executeTool('delete_project', {
      projectName: 'OldRepo',
    });

    assert.strictEqual(unconfirmedResult.success, false);
    assert.strictEqual(unconfirmedResult.confirmationRequired, true);

    // Attempt with confirmation
    const confirmedResult = await runtime.executeTool(
      'delete_project',
      { projectName: 'OldRepo' },
      { confirmed: true }
    );

    assert.strictEqual(confirmedResult.success, true);
    assert.strictEqual(confirmedResult.data?.deleted, true);

    const logs = auditLogger.getLogs();
    assert.strictEqual(logs.length, 2);
    assert.strictEqual(logs[1].status, 'CONFIRMATION_REQUIRED');
    assert.strictEqual(logs[0].status, 'SUCCESS');
  });

  it('M5 Security: Global kill switch blocks tool execution immediately', async () => {
    const registry = new ToolRegistry();
    registry.register(new CreateTaskTool());
    const auditLogger = new AuditLogger();
    const runtime = new ToolRuntime(registry, auditLogger);

    runtime.setKillSwitch(true);

    const result = await runtime.executeTool('create_task', { title: 'Do something' });
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('Global kill switch'));

    const logs = auditLogger.getLogs();
    assert.strictEqual(logs[0].status, 'REJECTED');
  });
});
