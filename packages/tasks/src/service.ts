import {
  CreateReminderInput,
  CreateTaskInput,
  Reminder,
  Task,
  UpdateTaskInput,
} from './types';

export interface TaskStorage {
  saveTask(task: Task): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  listTasks(userId: string): Promise<Task[]>;
  deleteTask(id: string): Promise<boolean>;
  saveReminder(reminder: Reminder): Promise<void>;
  getReminder(id: string): Promise<Reminder | null>;
  listReminders(userId?: string): Promise<Reminder[]>;
  updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | null>;
}

export class InMemoryTaskStorage implements TaskStorage {
  private tasks = new Map<string, Task>();
  private reminders = new Map<string, Reminder>();

  async saveTask(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async listTasks(userId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((t) => t.userId === userId);
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async saveReminder(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }

  async getReminder(id: string): Promise<Reminder | null> {
    return this.reminders.get(id) || null;
  }

  async listReminders(userId?: string): Promise<Reminder[]> {
    const all = Array.from(this.reminders.values());
    if (userId) {
      return all.filter((r) => r.userId === userId);
    }
    return all;
  }

  async updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | null> {
    const existing = this.reminders.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.reminders.set(id, updated);
    return updated;
  }
}

export class TaskService {
  private storage: TaskStorage;

  constructor(storage?: TaskStorage) {
    this.storage = storage || new InMemoryTaskStorage();
  }

  async createTask(userId: string, input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    await this.storage.saveTask(task);
    return task;
  }

  async getTasks(userId: string, status?: string): Promise<Task[]> {
    const list = await this.storage.listTasks(userId);
    if (status) {
      return list.filter((t) => t.status === status);
    }
    return list;
  }

  async updateTask(id: string, updates: UpdateTaskInput): Promise<Task | null> {
    const existing = await this.storage.getTask(id);
    if (!existing) return null;
    const updated: Task = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.storage.saveTask(updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return await this.storage.deleteTask(id);
  }

  async createReminder(userId: string, input: CreateReminderInput): Promise<Reminder> {
    const now = new Date().toISOString();
    const reminder: Reminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      title: input.title,
      runAt: input.runAt,
      recurrence: input.recurrence,
      status: 'SCHEDULED',
      createdAt: now,
    };
    await this.storage.saveReminder(reminder);
    return reminder;
  }

  async getReminders(userId?: string): Promise<Reminder[]> {
    return await this.storage.listReminders(userId);
  }

  async cancelReminder(id: string): Promise<boolean> {
    const updated = await this.storage.updateReminder(id, { status: 'CANCELLED' });
    return !!updated;
  }

  getStorage(): TaskStorage {
    return this.storage;
  }
}
