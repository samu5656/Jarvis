import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TaskService, InMemoryTaskStorage } from '../service';
import { ScheduledReminderQueue, ReminderNotification } from '../scheduler';

describe('Tasks & Scheduled Reminders (Milestone M7)', () => {
  it('M7 Acceptance: Task CRUD operations work reliably', async () => {
    const service = new TaskService();
    const userId = 'user_test_1';

    // 1. Create Task
    const task = await service.createTask(userId, {
      title: 'Submit DAA assignment',
      description: 'Chapter 4 graph algorithms',
      dueAt: '2026-10-15T18:00:00Z',
    });
    assert.ok(task.id);
    assert.strictEqual(task.title, 'Submit DAA assignment');
    assert.strictEqual(task.status, 'PENDING');

    // 2. Read / List Tasks
    const list = await service.getTasks(userId);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, task.id);

    // 3. Update Task
    const updated = await service.updateTask(task.id, {
      status: 'COMPLETED',
    });
    assert.strictEqual(updated?.status, 'COMPLETED');

    // 4. Delete Task
    const deleted = await service.deleteTask(task.id);
    assert.strictEqual(deleted, true);

    const remaining = await service.getTasks(userId);
    assert.strictEqual(remaining.length, 0);
  });

  it('M7 Acceptance: Scheduled reminders execute at the requested time', async () => {
    const storage = new InMemoryTaskStorage();
    const service = new TaskService(storage);
    const scheduler = new ScheduledReminderQueue(storage);

    const triggered: ReminderNotification[] = [];
    scheduler.onTrigger((notif) => {
      triggered.push(notif);
    });

    // Schedule reminder for 50 milliseconds in the future
    const runAt = new Date(Date.now() + 50).toISOString();
    const reminder = await service.createReminder('user_test_1', {
      title: 'Review Machine Learning lecture notes',
      runAt,
    });

    await scheduler.schedule(reminder);
    assert.strictEqual(scheduler.getActiveCount(), 1);

    // Wait 100ms for execution
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.strictEqual(triggered.length, 1);
    assert.strictEqual(triggered[0].title, 'Review Machine Learning lecture notes');

    // Verify status updated in storage
    const stored = await storage.getReminder(reminder.id);
    assert.strictEqual(stored?.status, 'EXECUTED');
    assert.ok(stored?.executedAt);

    scheduler.stopAll();
  });

  it('M7 Acceptance: Reminders survive scheduler/process restarts from storage', async () => {
    const storage = new InMemoryTaskStorage();
    const service = new TaskService(storage);

    // Initial Process: create a reminder 80ms in the future
    const runAt = new Date(Date.now() + 80).toISOString();
    const reminder = await service.createReminder('user_test_1', {
      title: 'Submit Lab report',
      runAt,
    });

    const oldScheduler = new ScheduledReminderQueue(storage);
    await oldScheduler.schedule(reminder);
    assert.strictEqual(oldScheduler.getActiveCount(), 1);

    // Simulate Process Restart: kill the old scheduler
    oldScheduler.stopAll();
    assert.strictEqual(oldScheduler.getActiveCount(), 0);

    // New process boots up, creates a new scheduler and restores from storage
    const newScheduler = new ScheduledReminderQueue(storage);
    const triggered: ReminderNotification[] = [];
    newScheduler.onTrigger((notif) => {
      triggered.push(notif);
    });

    const restoredCount = await newScheduler.restoreFromStorage();
    assert.strictEqual(restoredCount, 1);
    assert.strictEqual(newScheduler.getActiveCount(), 1);

    // Wait for the restored job to trigger
    await new Promise((resolve) => setTimeout(resolve, 120));

    assert.strictEqual(triggered.length, 1);
    assert.strictEqual(triggered[0].title, 'Submit Lab report');

    newScheduler.stopAll();
  });
});
