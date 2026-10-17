import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ToolRegistry,
  ToolRuntime,
  ReadCalendarTool,
  DraftEmailTool,
  SendEmailTool,
  DraftStore,
} from '../index';

describe('Milestone M9 - Calendar & Email Tools', () => {
  it('M9: Jarvis can read calendar events and filter by date/query', async () => {
    const calendarTool = new ReadCalendarTool([
      {
        id: 'cal_1',
        title: 'Team Standup',
        startTime: '2026-10-15T09:00:00Z',
        endTime: '2026-10-15T09:30:00Z',
      },
      {
        id: 'cal_2',
        title: 'Client Demo',
        startTime: '2026-10-16T14:00:00Z',
        endTime: '2026-10-16T15:00:00Z',
      },
    ]);

    const registry = new ToolRegistry();
    registry.register(calendarTool);
    const runtime = new ToolRuntime(registry);

    // Read all
    const allRes = await runtime.executeTool('read_calendar', {});
    assert.strictEqual(allRes.success, true);
    assert.strictEqual(allRes.data.length, 2);

    // Query filter
    const queryRes = await runtime.executeTool('read_calendar', { query: 'Standup' });
    assert.strictEqual(queryRes.success, true);
    assert.strictEqual(queryRes.data.length, 1);
    assert.strictEqual(queryRes.data[0].id, 'cal_1');
  });

  it('M9: Jarvis can draft email safely without external sending', async () => {
    const registry = new ToolRegistry();
    registry.register(new DraftEmailTool());
    const runtime = new ToolRuntime(registry);

    const draftRes = await runtime.executeTool('draft_email', {
      to: ['client@example.com'],
      subject: 'Milestone Progress Update',
      body: 'Hello, the project milestone is ready for review.',
    });

    assert.strictEqual(draftRes.success, true);
    assert.strictEqual(draftRes.data.status, 'DRAFT');
    assert.ok(draftRes.data.draftId);
    assert.strictEqual(draftRes.confirmationRequired, undefined);

    // Verify stored in DraftStore
    const savedDraft = DraftStore.getDraft(draftRes.data.draftId);
    assert.ok(savedDraft);
    assert.strictEqual(savedDraft.subject, 'Milestone Progress Update');
  });

  it('M9 Acceptance: Jarvis NEVER sends an external message without required approval', async () => {
    const registry = new ToolRegistry();
    registry.register(new DraftEmailTool());
    registry.register(new SendEmailTool());
    const runtime = new ToolRuntime(registry);

    // Step 1: Draft the email
    const draftRes = await runtime.executeTool('draft_email', {
      to: ['partner@example.com'],
      subject: 'Confidential Proposal',
      body: 'Here are the terms.',
    });
    const draftId = draftRes.data.draftId;

    // Step 2: Attempt sending WITHOUT confirmation -> MUST BE BLOCKED
    const unconfirmedRes = await runtime.executeTool(
      'send_email',
      { draftId },
      { confirmed: false }
    );

    assert.strictEqual(unconfirmedRes.success, false);
    assert.strictEqual(unconfirmedRes.confirmationRequired, true);
    assert.strictEqual(unconfirmedRes.auditEntry.status, 'CONFIRMATION_REQUIRED');
    assert.match(unconfirmedRes.error || '', /Confirmation required/);

    // Step 3: Attempt sending direct message WITHOUT confirmation -> MUST BE BLOCKED
    const unconfirmedDirect = await runtime.executeTool(
      'send_email',
      {
        to: ['ceo@example.com'],
        subject: 'Important notice',
        body: 'Details inside',
      },
      { confirmed: false }
    );
    assert.strictEqual(unconfirmedDirect.success, false);
    assert.strictEqual(unconfirmedDirect.confirmationRequired, true);

    // Step 4: With explicit user confirmation -> Successfully sends
    const confirmedRes = await runtime.executeTool(
      'send_email',
      { draftId },
      { confirmed: true }
    );

    assert.strictEqual(confirmedRes.success, true);
    assert.strictEqual(confirmedRes.data.status, 'SENT');
    assert.strictEqual(confirmedRes.data.to[0], 'partner@example.com');
    assert.strictEqual(confirmedRes.auditEntry.status, 'SUCCESS');
  });

  it('M9: Global kill switch immediately stops email sending even if confirmed', async () => {
    const registry = new ToolRegistry();
    registry.register(new SendEmailTool());
    const runtime = new ToolRuntime(registry);

    runtime.setKillSwitch(true);

    const res = await runtime.executeTool(
      'send_email',
      {
        to: ['someone@example.com'],
        subject: 'Emergency',
        body: 'Alert',
      },
      { confirmed: true }
    );

    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /kill switch/i);
    assert.strictEqual(res.auditEntry.status, 'REJECTED');
  });
});
