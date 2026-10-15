const { createDefaultToolRegistry, ToolRuntime, AuditLogger } = require('../packages/tools/dist/index');

async function main() {
  console.log('=== JARVIS Tool Runtime & Audit Lifecycle Verification (M5) ===');

  const registry = createDefaultToolRegistry();
  const auditLogger = new AuditLogger();
  const runtime = new ToolRuntime(registry, auditLogger);

  console.log('\nRegistered Tools:');
  for (const tool of registry.list()) {
    console.log(` - ${tool.name} [Risk: ${tool.risk}] -> ${tool.description}`);
  }

  console.log('\n--- Test 1: Unknown Tool Execution Attempt ---');
  const unknownRes = await runtime.executeTool('hack_mainframe', { target: '127.0.0.1' });
  console.log('Result Success:', unknownRes.success);
  console.log('Error Reported:', unknownRes.error);
  console.log('Audit Logged Status:', unknownRes.auditEntry.status);

  console.log('\n--- Test 2: Invalid Argument Schema Attempt ---');
  // create_task requires a non-empty string title
  const invalidRes = await runtime.executeTool('create_task', { title: '' });
  console.log('Result Success:', invalidRes.success);
  console.log('Error Reported:', invalidRes.error);
  console.log('Audit Logged Status:', invalidRes.auditEntry.status);

  console.log('\n--- Test 3: Valid Tool Execution with Secret Redaction ---');
  const validRes = await runtime.executeTool('create_task', {
    title: 'Setup production DB',
    description: 'Database configuration task',
    apiKey: 'sk-super-secret-key-12345',
  });
  console.log('Result Success:', validRes.success);
  console.log('Created Task ID:', validRes.data.id);
  console.log('Audit Logged Input (checking secret redaction):', JSON.stringify(validRes.auditEntry.input));

  console.log('\n--- Test 4: Global Kill Switch ---');
  runtime.setKillSwitch(true);
  const blockedRes = await runtime.executeTool('create_task', { title: 'Should be blocked' });
  console.log('Kill Switch Active:', runtime.isKillSwitchActive());
  console.log('Result Success:', blockedRes.success);
  console.log('Error Reported:', blockedRes.error);
  console.log('Audit Logged Status:', blockedRes.auditEntry.status);
  runtime.setKillSwitch(false); // Reset

  console.log('\n--- Full Audit Log Trail ---');
  const logs = auditLogger.getLogs();
  console.log(`Total Invocations Logged: ${logs.length}`);
  logs.forEach((log, index) => {
    console.log(`  [${index + 1}] Tool: ${log.toolName.padEnd(16)} | Status: ${log.status.padEnd(12)} | Duration: ${log.durationMs}ms`);
  });

  const allLogged = logs.length === 4;
  const rejectionsHandled = !unknownRes.success && !invalidRes.success && !blockedRes.success;

  if (allLogged && rejectionsHandled && validRes.success) {
    console.log('\n============================================================');
    console.log('M5 Acceptance Criteria: PASSED');
    console.log('Unknown/invalid tools cannot execute; every execution is logged.');
    console.log('============================================================');
  }
}

main();
