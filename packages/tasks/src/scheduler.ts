import { Reminder } from './types';
import { TaskStorage } from './service';

export interface ReminderNotification {
  reminderId: string;
  userId: string;
  title: string;
  runAt: string;
  executedAt: string;
}

export type ReminderCallback = (notification: ReminderNotification) => Promise<void> | void;

export class ScheduledReminderQueue {
  private storage: TaskStorage;
  private timers = new Map<string, NodeJS.Timeout>();
  private onTriggerCallbacks: ReminderCallback[] = [];

  constructor(storage: TaskStorage) {
    this.storage = storage;
  }

  onTrigger(cb: ReminderCallback): void {
    this.onTriggerCallbacks.push(cb);
  }

  /**
   * Schedules a reminder. Calculates remaining time until runAt.
   */
  async schedule(reminder: Reminder): Promise<void> {
    if (this.timers.has(reminder.id)) {
      clearTimeout(this.timers.get(reminder.id)!);
      this.timers.delete(reminder.id);
    }

    const runTime = new Date(reminder.runAt).getTime();
    const now = Date.now();
    const delay = Math.max(0, runTime - now);

    const timer = setTimeout(async () => {
      this.timers.delete(reminder.id);
      await this.triggerReminder(reminder.id);
    }, delay);

    this.timers.set(reminder.id, timer);
  }

  private async triggerReminder(reminderId: string): Promise<void> {
    const reminder = await this.storage.getReminder(reminderId);
    if (!reminder || reminder.status === 'CANCELLED') return;

    const now = new Date().toISOString();
    await this.storage.updateReminder(reminderId, {
      status: 'EXECUTED',
      executedAt: now,
    });

    const notification: ReminderNotification = {
      reminderId: reminder.id,
      userId: reminder.userId,
      title: reminder.title,
      runAt: reminder.runAt,
      executedAt: now,
    };

    for (const cb of this.onTriggerCallbacks) {
      try {
        await cb(notification);
      } catch (err) {
        console.error('Error in reminder callback:', err);
      }
    }
  }

  /**
   * Restores pending/scheduled reminders from durable storage after process restart.
   */
  async restoreFromStorage(): Promise<number> {
    const all = await this.storage.listReminders();
    const scheduled = all.filter((r) => r.status === 'SCHEDULED');
    for (const reminder of scheduled) {
      await this.schedule(reminder);
    }
    return scheduled.length;
  }

  cancel(reminderId: string): void {
    if (this.timers.has(reminderId)) {
      clearTimeout(this.timers.get(reminderId)!);
      this.timers.delete(reminderId);
    }
  }

  stopAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  getActiveCount(): number {
    return this.timers.size;
  }
}
