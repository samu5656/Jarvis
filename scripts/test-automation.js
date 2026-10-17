import assert from 'node:assert';
import {
  AutomationEngine,
  AutomationQueueWorker,
} from '../packages/automation/dist/index.js';

async function testAutomationEngine() {
  console.log('Testing M13: Automation Engine (Trigger-Condition-Action, Retries, Idempotency)...');

  let executionCounter = 0;
  const engine = new AutomationEngine(async (tool, input) => {
    if (tool === 'notify_slack') {
      executionCounter++;
      return { success: true, data: { delivered: true, text: input.text } };
    }
    return { success: false, error: 'Unknown tool' };
  });

  // 1. Create a Trigger-Condition-Action workflow
  const wf = engine.createWorkflow({
    name: 'Deploy Failure Alert',
    trigger: { type: 'event', eventType: 'BUILD_FAILED' },
    conditions: [
      { field: 'branch', operator: 'equals', value: 'main' },
      { field: 'exitCode', operator: 'not_equals', value: 0 },
    ],
    actions: [
      {
        id: 'notify_action',
        toolName: 'notify_slack',
        input: { text: 'Alert: main branch build failed!' },
      },
    ],
  });
  assert.ok(wf.id.startsWith('wf_'));
  console.log('✔ Workflow definition created successfully');

  // 2. Trigger with matching conditions -> Must complete
  const logMatch = await engine.triggerWorkflow(wf.id, {
    branch: 'main',
    exitCode: 1,
  });
  assert.strictEqual(logMatch.state, 'COMPLETED');
  assert.strictEqual(executionCounter, 1);
  console.log('✔ Trigger-Condition-Action workflow executed on condition match');

  // 3. Trigger with non-matching conditions -> Must be skipped
  const logNoMatch = await engine.triggerWorkflow(wf.id, {
    branch: 'dev-feature',
    exitCode: 1,
  });
  assert.strictEqual(logNoMatch.state, 'SKIPPED_CONDITIONS');
  assert.strictEqual(executionCounter, 1); // Not incremented
  console.log('✔ Workflow conditions successfully filtered unmatching events');

  // 4. Retry Policy Verification on Transient Failure
  let flakyAttempts = 0;
  const retryEngine = new AutomationEngine(async () => {
    flakyAttempts++;
    if (flakyAttempts < 2) {
      return { success: false, error: 'Transient network glitch' };
    }
    return { success: true, data: { status: 'OK' } };
  });

  const retryWf = retryEngine.createWorkflow({
    name: 'Auto-Retry Sync Job',
    trigger: { type: 'schedule', cronOrInterval: '10m' },
    retryPolicy: { maxRetries: 3, initialDelayMs: 15, backoffMultiplier: 1.5 },
    actions: [{ id: 'sync_action', toolName: 'sync_data', input: {} }],
  });

  const retryLog = await retryEngine.triggerWorkflow(retryWf.id);
  assert.strictEqual(retryLog.state, 'COMPLETED');
  assert.strictEqual(flakyAttempts, 2);
  console.log('✔ Workflows execute with retry controls on transient failure');

  // 5. Idempotency Controls Verification
  let idempotentExecCount = 0;
  const idemEngine = new AutomationEngine(async () => {
    idempotentExecCount++;
    return { success: true };
  });

  const idemWf = idemEngine.createWorkflow({
    name: 'Transactional Task Sync',
    trigger: { type: 'webhook' },
    actions: [{ id: 'action_1', toolName: 'charge_customer', input: {} }],
  });

  const testKey = 'unique_transaction_order_998811';

  // First run
  const res1 = await idemEngine.triggerWorkflow(idemWf.id, {}, { idempotencyKey: testKey });
  assert.strictEqual(res1.state, 'COMPLETED');
  assert.strictEqual(idempotentExecCount, 1);

  // Duplicate replay
  const res2 = await idemEngine.triggerWorkflow(idemWf.id, {}, { idempotencyKey: testKey });
  assert.strictEqual(res2.state, 'DUPLICATE_IDEMPOTENT');
  assert.strictEqual(idempotentExecCount, 1);
  console.log('✔ Workflows enforce strict idempotency controls against duplicate dispatch');

  console.log('\nAll M13 Automation Engine acceptance tests passed successfully!');
}

testAutomationEngine().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
