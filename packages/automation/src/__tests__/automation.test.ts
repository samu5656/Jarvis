import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AutomationEngine,
  ConditionEvaluator,
} from '../index';

describe('Milestone M13 - Automation Engine (Trigger, Condition, Action, Retry, Idempotency)', () => {
  it('M13: Evaluates workflow conditions accurately', () => {
    const passed = ConditionEvaluator.evaluateConditions(
      [
        { field: 'priority', operator: 'equals', value: 'HIGH' },
        { field: 'tag', operator: 'contains', value: 'urgent' },
        { field: 'retryCount', operator: 'less_than', value: 5 },
      ],
      { priority: 'HIGH', tag: 'very urgent item', retryCount: 2 }
    );
    assert.strictEqual(passed, true);

    const failed = ConditionEvaluator.evaluateConditions(
      [{ field: 'priority', operator: 'equals', value: 'LOW' }],
      { priority: 'HIGH' }
    );
    assert.strictEqual(failed, false);
  });

  it('M13 Acceptance: Trigger-Condition-Action workflow executes successfully', async () => {
    let executedAction = false;
    const engine = new AutomationEngine(async (tool, input) => {
      if (tool === 'notify_user') {
        executedAction = true;
        return { success: true, data: { message: input.message } };
      }
      return { success: false, error: 'Unknown tool' };
    });

    const wf = engine.createWorkflow({
      name: 'High Priority Task Alert',
      trigger: { type: 'event', eventType: 'TASK_CREATED' },
      conditions: [{ field: 'task.priority', operator: 'equals', value: 'HIGH' }],
      actions: [
        {
          id: 'action_1',
          toolName: 'notify_user',
          input: { message: 'A critical high-priority task was created!' },
        },
      ],
    });

    const log = await engine.triggerWorkflow(wf.id, {
      task: { id: 't1', priority: 'HIGH' },
    });

    assert.strictEqual(log.state, 'COMPLETED');
    assert.strictEqual(executedAction, true);
    assert.strictEqual(log.actionResults[0].success, true);
  });

  it('M13 Acceptance: Condition filtering skips workflow execution when condition not met', async () => {
    let executedAction = false;
    const engine = new AutomationEngine(async () => {
      executedAction = true;
      return { success: true };
    });

    const wf = engine.createWorkflow({
      name: 'Notify Low Priority',
      trigger: { type: 'event', eventType: 'TASK_CREATED' },
      conditions: [{ field: 'priority', operator: 'equals', value: 'LOW' }],
      actions: [{ id: 'a1', toolName: 'noop', input: {} }],
    });

    const log = await engine.triggerWorkflow(wf.id, { priority: 'HIGH' });
    assert.strictEqual(log.state, 'SKIPPED_CONDITIONS');
    assert.strictEqual(executedAction, false);
  });

  it('M13 Acceptance CRITICAL: Workflows execute with retry controls on transient failure', async () => {
    let callAttempts = 0;
    const engine = new AutomationEngine(async () => {
      callAttempts++;
      if (callAttempts < 3) {
        return { success: false, error: 'Transient network failure' };
      }
      return { success: true, data: { status: 'Recovered' } };
    });

    const wf = engine.createWorkflow({
      name: 'Flaky Network Job',
      trigger: { type: 'schedule', cronOrInterval: '1m' },
      retryPolicy: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1.2 },
      actions: [{ id: 'flaky_action', toolName: 'fetch_data', input: {} }],
    });

    const log = await engine.triggerWorkflow(wf.id);
    assert.strictEqual(log.state, 'COMPLETED');
    assert.strictEqual(callAttempts, 3);
    assert.strictEqual(log.attempts, 3);
  });

  it('M13 Acceptance CRITICAL: Workflows enforce idempotency controls against duplicate execution', async () => {
    let executionTimes = 0;
    const engine = new AutomationEngine(async () => {
      executionTimes++;
      return { success: true };
    });

    const wf = engine.createWorkflow({
      name: 'Financial Deduplication Workflow',
      trigger: { type: 'webhook' },
      actions: [{ id: 'action_p', toolName: 'process_payment', input: {} }],
    });

    const key = 'idem_key_payment_transaction_123';

    // First call
    const log1 = await engine.triggerWorkflow(wf.id, {}, { idempotencyKey: key });
    assert.strictEqual(log1.state, 'COMPLETED');
    assert.strictEqual(executionTimes, 1);

    // Duplicate call with SAME idempotency key -> MUST NOT EXECUTE AGAIN
    const log2 = await engine.triggerWorkflow(wf.id, {}, { idempotencyKey: key });
    assert.strictEqual(log2.state, 'DUPLICATE_IDEMPOTENT');
    assert.strictEqual(executionTimes, 1); // Remains 1, duplicate suppressed
  });
});
