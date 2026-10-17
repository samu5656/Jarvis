import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ProactiveService,
  TaskDataProvider,
  CalendarDataProvider,
} from '../index';

describe('Milestone M14 - Proactive Jarvis (Briefings, Deadlines, Category-Gated Notifications)', () => {
  it('M14: Compiles Daily Briefing from tasks and calendar providers', async () => {
    const taskProvider: TaskDataProvider = {
      getPendingTasks: async () => [
        { id: 't1', title: 'Finish DAA Assignment', priority: 'HIGH', dueDate: new Date(Date.now() + 7200000).toISOString() },
        { id: 't2', title: 'Read Research Paper', priority: 'LOW' },
      ],
    };

    const calendarProvider: CalendarDataProvider = {
      getUpcomingEvents: async () => [
        { id: 'e1', title: 'Algorithms Lecture', startTime: new Date().toISOString() },
      ],
    };

    const service = new ProactiveService({ taskProvider, calendarProvider });
    const briefing = await service.generateDailyBriefing('user_1');

    assert.strictEqual(briefing.urgentTasksCount, 1);
    assert.strictEqual(briefing.calendarEventsCount, 1);
    assert.strictEqual(briefing.upcomingDeadlines.length, 1);
    assert.match(briefing.summaryText, /pending task/i);
  });

  it('M14 Acceptance CRITICAL: Jarvis proactively notifies for enabled categories', async () => {
    const service = new ProactiveService();
    // Default enabled: ['briefing', 'deadline', 'reminder']
    const result = await service.notify(
      'user_1',
      'deadline',
      'Urgent Submission',
      'Due in 2 hours',
      'HIGH'
    );

    assert.strictEqual(result.sent, true);
    assert.ok(result.notification);
    assert.strictEqual(result.notification.category, 'deadline');
  });

  it('M14 Acceptance CRITICAL: Jarvis SUPPRESSES notifications for disabled categories', async () => {
    const service = new ProactiveService();

    // User explicitly disables 'system' and 'briefing' categories
    service.updatePreferences('user_1', {
      enabledCategories: ['deadline'], // ONLY deadline allowed
    });

    // 1. Try sending disabled category -> MUST BE SUPPRESSED
    const briefingResult = await service.notify(
      'user_1',
      'briefing',
      'Morning Briefing',
      'Here is your day at a glance'
    );
    assert.strictEqual(briefingResult.sent, false);
    assert.match(briefingResult.reason || '', /disabled in user preferences/i);

    const systemResult = await service.notify(
      'user_1',
      'system',
      'System Update',
      'Docker engine updated'
    );
    assert.strictEqual(systemResult.sent, false);
    assert.match(systemResult.reason || '', /disabled in user preferences/i);

    // 2. Try sending permitted category -> MUST SUCCEED
    const deadlineResult = await service.notify(
      'user_1',
      'deadline',
      'Project Submission',
      'Due tonight!'
    );
    assert.strictEqual(deadlineResult.sent, true);
    assert.ok(deadlineResult.notification);
  });

  it('M14: Automatically detects looming deadlines within 24 hours', async () => {
    const taskProvider: TaskDataProvider = {
      getPendingTasks: async () => [
        { id: 't1', title: 'Near Deadline Task', priority: 'HIGH', dueDate: new Date(Date.now() + 3600000).toISOString() }, // in 1h
        { id: 't2', title: 'Far Deadline Task', priority: 'LOW', dueDate: new Date(Date.now() + 172800000).toISOString() }, // in 48h
      ],
    };

    const service = new ProactiveService({ taskProvider });
    const detected = await service.detectDeadlines('user_2', 24);

    assert.strictEqual(detected.length, 1);
    assert.strictEqual(detected[0].title, 'Near Deadline Task');
    assert.ok(detected[0].dueInHours <= 1.1);

    const notifs = service.getNotifications('user_2');
    assert.strictEqual(notifs.length, 1);
    assert.strictEqual(notifs[0].category, 'deadline');
  });
});
