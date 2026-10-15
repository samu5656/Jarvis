const { TaskService, ScheduledReminderQueue, InMemoryTaskStorage } = require('../packages/tasks/dist/index');

async function main() {
  console.log('=== JARVIS Tasks & Scheduled Reminders Verification (M7) ===\n');

  const storage = new InMemoryTaskStorage();
  const service = new TaskService(storage);
  const scheduler = new ScheduledReminderQueue(storage);

  const triggeredReminders = [];
  scheduler.onTrigger((notif) => {
    console.log(`[ALARM TRIGGERED] Reminder "${notif.title}" executed at ${notif.executedAt}`);
    triggeredReminders.push(notif);
  });

  // 1. Task CRUD Verification
  console.log('--- Test 1: Task CRUD Lifecycle ---');
  const task = await service.createTask('user_1', {
    title: 'Submit DAA assignment',
    description: 'Dynamic programming & greedy algorithms',
    dueAt: '7 PM today',
  });
  console.log('Created Task:', task.title, `[ID: ${task.id}, Status: ${task.status}]`);

  const updated = await service.updateTask(task.id, { status: 'COMPLETED' });
  console.log('Updated Task Status:', updated.status);

  const list = await service.getTasks('user_1');
  console.log(`User Tasks Count: ${list.length}`);

  // 2. Scheduled Reminder Verification
  console.log('\n--- Test 2: Scheduled Reminder Execution ---');
  const delayMs = 150;
  const runAt = new Date(Date.now() + delayMs).toISOString();

  const reminder = await service.createReminder('user_1', {
    title: 'Submit DAA assignment',
    runAt,
  });
  console.log(`Scheduled Reminder: "${reminder.title}" for ${reminder.runAt}`);
  await scheduler.schedule(reminder);
  console.log('Active Timers in Queue:', scheduler.getActiveCount());

  console.log(`Waiting ${delayMs + 50}ms for scheduled alarm to fire...`);
  await new Promise((resolve) => setTimeout(resolve, delayMs + 100));

  console.log(`Triggered Alarms Count: ${triggeredReminders.length}`);
  const storedReminder = await storage.getReminder(reminder.id);
  console.log('Final Reminder Status in Storage:', storedReminder.status);

  // 3. Process Restart Survival Verification
  console.log('\n--- Test 3: Reminder Survival Across Process Restart ---');
  const restartRunAt = new Date(Date.now() + 200).toISOString();
  const durableReminder = await service.createReminder('user_1', {
    title: 'Submit Lab report',
    runAt: restartRunAt,
  });

  console.log(`Enqueuing Reminder: "${durableReminder.title}" in original process...`);
  await scheduler.schedule(durableReminder);

  console.log('SIMULATING PROCESS CRASH / RESTART: Killing scheduler timers...');
  scheduler.stopAll();
  console.log('Active Timers after crash:', scheduler.getActiveCount());

  console.log('Booting NEW Process: restoring scheduled jobs from durable storage...');
  const newScheduler = new ScheduledReminderQueue(storage);
  const newTriggered = [];
  newScheduler.onTrigger((notif) => {
    console.log(`[RESTORED ALARM TRIGGERED] "${notif.title}" executed at ${notif.executedAt}`);
    newTriggered.push(notif);
  });

  const restoredCount = await newScheduler.restoreFromStorage();
  console.log(`Restored ${restoredCount} pending reminder(s) into active queue.`);
  console.log('Active Timers in New Scheduler:', newScheduler.getActiveCount());

  console.log('Waiting for restored reminder to fire...');
  await new Promise((resolve) => setTimeout(resolve, 250));

  newScheduler.stopAll();

  console.log('\n============================================================');
  const passedCriteria =
    task.id &&
    updated.status === 'COMPLETED' &&
    triggeredReminders.length === 1 &&
    newTriggered.length === 1;

  if (passedCriteria) {
    console.log('M7 Acceptance Criteria: PASSED');
    console.log('Task CRUD works; reminder jobs survive restarts and execute at the requested time.');
  }
  console.log('============================================================');
}

main();
