import assert from 'node:assert';
import {
  ToolRegistry,
  ToolRuntime,
  ReadCalendarTool,
  DraftEmailTool,
  SendEmailTool,
  DraftStore,
} from '../packages/tools/dist/index.js';

async function testCalendarAndEmail() {
  console.log('Testing M9: Calendar & Email Tools...');

  const calendarTool = new ReadCalendarTool([
    {
      id: 'cal_1',
      title: 'Sprint Planning',
      startTime: '2026-10-15T10:00:00Z',
      endTime: '2026-10-15T11:00:00Z',
      location: 'Zoom',
    },
    {
      id: 'cal_2',
      title: 'Customer Review',
      startTime: '2026-10-16T15:00:00Z',
      endTime: '2026-10-16T16:00:00Z',
      location: 'Meet',
    },
  ]);

  const registry = new ToolRegistry();
  registry.register(calendarTool);
  registry.register(new DraftEmailTool());
  registry.register(new SendEmailTool());
  const runtime = new ToolRuntime(registry);

  // 1. Read Calendar
  const calRes = await runtime.executeTool('read_calendar', { query: 'Sprint' });
  assert.strictEqual(calRes.success, true);
  assert.strictEqual(calRes.data.length, 1);
  assert.strictEqual(calRes.data[0].id, 'cal_1');
  console.log('✔ Read Calendar and search query verified');

  // 2. Draft Email
  const draftRes = await runtime.executeTool('draft_email', {
    to: ['recipient@domain.com'],
    subject: 'Quarterly Sync',
    body: 'Please find the agenda attached.',
  });
  assert.strictEqual(draftRes.success, true);
  assert.strictEqual(draftRes.data.status, 'DRAFT');
  assert.ok(draftRes.data.draftId);
  console.log('✔ Draft Email safely stored as DRAFT verified');

  // 3. Acceptance Criteria: Send without confirmation MUST FAIL
  const blockedSend = await runtime.executeTool(
    'send_email',
    { draftId: draftRes.data.draftId },
    { confirmed: false }
  );
  assert.strictEqual(blockedSend.success, false);
  assert.strictEqual(blockedSend.confirmationRequired, true);
  assert.strictEqual(blockedSend.auditEntry.status, 'CONFIRMATION_REQUIRED');
  console.log('✔ ACCEPTANCE: External message send strictly blocked without required confirmation');

  // 4. Send with explicit confirmation MUST SUCCEED
  const approvedSend = await runtime.executeTool(
    'send_email',
    { draftId: draftRes.data.draftId },
    { confirmed: true }
  );
  assert.strictEqual(approvedSend.success, true);
  assert.strictEqual(approvedSend.data.status, 'SENT');
  assert.strictEqual(approvedSend.auditEntry.status, 'SUCCESS');
  console.log('✔ Send Email succeeds with explicit approval');

  // 5. Global kill switch blocks sending
  runtime.setKillSwitch(true);
  const killSwitchSend = await runtime.executeTool(
    'send_email',
    { draftId: draftRes.data.draftId },
    { confirmed: true }
  );
  assert.strictEqual(killSwitchSend.success, false);
  assert.strictEqual(killSwitchSend.auditEntry.status, 'REJECTED');
  console.log('✔ Global kill switch stops email dispatch');

  console.log('\nAll M9 Calendar & Email acceptance tests passed successfully!');
}

testCalendarAndEmail().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
