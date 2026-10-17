import assert from 'node:assert';
import {
  ProactiveService,
} from '../packages/proactive/dist/index.js';

async function testProactiveJarvis() {
  console.log('Testing M14: Proactive Jarvis (Daily Briefing, Deadlines, Category-Gated Alerts)...');

  const now = Date.now();
  const testTasks = [
    {
      id: 'task_urgent',
      title: 'Submit Machine Learning Project',
      priority: 'HIGH',
      dueDate: new Date(now + 2 * 3600 * 1000).toISOString(), // 2 hours from now
    },
    {
      id: 'task_later',
      title: 'Review Sprint Backlog',
      priority: 'LOW',
      dueDate: new Date(now + 48 * 3600 * 1000).toISOString(), // 48 hours from now
    },
  ];

  const testCalendar = [
    {
      id: 'event_1',
      title: 'Engineering All-Hands',
      startTime: new Date(now + 3600 * 1000).toISOString(),
    },
  ];

  const service = new ProactiveService({
    taskProvider: { getPendingTasks: async () => testTasks },
    calendarProvider: { getUpcomingEvents: async () => testCalendar },
  });

  // 1. Daily Briefing Generation
  const briefing = await service.generateDailyBriefing('user_test');
  assert.ok(briefing.summaryText.length > 0);
  assert.strictEqual(briefing.urgentTasksCount, 1);
  assert.strictEqual(briefing.calendarEventsCount, 1);
  assert.strictEqual(briefing.upcomingDeadlines.length, 1);
  console.log('✔ Daily briefing generated with tasks, deadlines, and calendar events');

  // 2. Deadline Detection
  const deadlines = await service.detectDeadlines('user_test', 24);
  assert.strictEqual(deadlines.length, 1);
  assert.strictEqual(deadlines[0].title, 'Submit Machine Learning Project');
  console.log('✔ Deadline detection accurately isolated tasks due within 24 hours');

  // 3. M14 ACCEPTANCE CRITICAL: Proactively notify ONLY for enabled categories
  service.updatePreferences('user_test', {
    enabledCategories: ['deadline'], // ONLY deadline notifications enabled
  });

  // Attempting disabled category 'system' -> MUST BE SUPPRESSED
  const suppressedSystem = await service.notify(
    'user_test',
    'system',
    'OS Update',
    'Windows 11 update available'
  );
  assert.strictEqual(suppressedSystem.sent, false);
  assert.match(suppressedSystem.reason || '', /disabled in user preferences/i);
  console.log('✔ Proactive notification for disabled category correctly SUPPRESSED');

  // Attempting disabled category 'briefing' -> MUST BE SUPPRESSED
  const suppressedBriefing = await service.notify(
    'user_test',
    'briefing',
    'Evening Briefing',
    'Summary of your evening'
  );
  assert.strictEqual(suppressedBriefing.sent, false);
  console.log('✔ Proactive briefing correctly suppressed when category disabled');

  // Attempting enabled category 'deadline' -> MUST SUCCEED
  const allowedDeadline = await service.notify(
    'user_test',
    'deadline',
    'Urgent Deadline Alert',
    'Due in less than 2 hours!',
    'HIGH'
  );
  assert.strictEqual(allowedDeadline.sent, true);
  assert.ok(allowedDeadline.notification);
  assert.strictEqual(allowedDeadline.notification.category, 'deadline');
  console.log('✔ Proactive notification for enabled category correctly DELIVERED');

  console.log('\nAll M14 Proactive Jarvis acceptance tests passed successfully!');
}

testProactiveJarvis().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
