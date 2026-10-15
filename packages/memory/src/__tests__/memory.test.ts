import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MemoryService } from '../service';

describe('Memory Service (Milestone M8)', () => {
  it('M8 Acceptance: Jarvis stores and recalls durable user-approved memories without leaking unrelated data', async () => {
    const memory = new MemoryService();
    const userA = 'user_student_1';
    const userB = 'user_student_2';

    // Store user A's approved memories
    await memory.remember(userA, {
      type: 'USER_PREFERENCE',
      content: 'Prefers dark mode and TypeScript for all projects',
      importance: 'MEDIUM',
    });

    await memory.remember(userA, {
      type: 'PROJECT_CONTEXT',
      content: 'FlowForge project is an IoT automation workflow engine in Node.js',
      importance: 'HIGH',
    });

    // Store user B's secret memory
    await memory.remember(userB, {
      type: 'FACT',
      content: 'User B private data: bank PIN and confidential project',
      importance: 'HIGH',
    });

    // 1. Query relevant memories for User A
    const recalledFlowForge = await memory.recall(userA, 'FlowForge');
    assert.strictEqual(recalledFlowForge.length, 1);
    assert.ok(recalledFlowForge[0].content.includes('IoT automation workflow'));

    // 2. Query preferences for User A
    const recalledPref = await memory.recall(userA, 'TypeScript');
    assert.strictEqual(recalledPref.length, 1);
    assert.ok(recalledPref[0].content.includes('TypeScript'));

    // 3. Acceptance Check: User A query NEVER retrieves User B's unrelated/private data
    const leakCheck = await memory.recall(userA, 'private data bank');
    assert.strictEqual(leakCheck.length, 0);

    const allUserA = await memory.recall(userA);
    assert.strictEqual(allUserA.length, 2);
    assert.ok(allUserA.every((m) => m.userId === userA));
  });

  it('M8 Acceptance: High importance memories rank higher in retrieval', async () => {
    const memory = new MemoryService();
    const userId = 'user_priority_test';

    await memory.remember(userId, {
      type: 'FACT',
      content: 'Low priority note about coffee',
      importance: 'LOW',
    });

    await memory.remember(userId, {
      type: 'USER_PREFERENCE',
      content: 'High priority note about system backup schedule',
      importance: 'HIGH',
    });

    const all = await memory.recall(userId);
    assert.strictEqual(all.length, 2);
    assert.strictEqual(all[0].importance, 'HIGH');
    assert.strictEqual(all[1].importance, 'LOW');
  });
});
