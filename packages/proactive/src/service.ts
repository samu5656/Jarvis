import {
  DailyBriefing,
  NotificationCategory,
  ProactiveNotification,
  ProactivePreferences,
  UpdatePreferencesInput,
} from './types';

export interface TaskDataProvider {
  getPendingTasks(userId: string): Promise<Array<{ id: string; title: string; priority: string; dueDate?: string }>>;
}

export interface CalendarDataProvider {
  getUpcomingEvents(userId: string): Promise<Array<{ id: string; title: string; startTime: string }>>;
}

export class ProactiveService {
  private preferences = new Map<string, ProactivePreferences>();
  private notifications: ProactiveNotification[] = [];
  private taskProvider?: TaskDataProvider;
  private calendarProvider?: CalendarDataProvider;

  constructor(options?: {
    taskProvider?: TaskDataProvider;
    calendarProvider?: CalendarDataProvider;
  }) {
    this.taskProvider = options?.taskProvider;
    this.calendarProvider = options?.calendarProvider;
  }

  getPreferences(userId: string): ProactivePreferences {
    const existing = this.preferences.get(userId);
    if (existing) return existing;

    // Default configuration with standard categories enabled
    const defaultPrefs: ProactivePreferences = {
      userId,
      enabledCategories: ['briefing', 'deadline', 'reminder'],
    };
    this.preferences.set(userId, defaultPrefs);
    return defaultPrefs;
  }

  updatePreferences(userId: string, input: UpdatePreferencesInput): ProactivePreferences {
    const prefs: ProactivePreferences = {
      userId,
      enabledCategories: input.enabledCategories,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
    };
    this.preferences.set(userId, prefs);
    return prefs;
  }

  /**
   * M14 Acceptance Gate: Jarvis can proactively notify ONLY for enabled categories.
   */
  async notify(
    userId: string,
    category: NotificationCategory,
    title: string,
    message: string,
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): Promise<{ sent: boolean; notification?: ProactiveNotification; reason?: string }> {
    const prefs = this.getPreferences(userId);

    // Filter check: Is this category enabled by the user?
    if (!prefs.enabledCategories.includes(category)) {
      return {
        sent: false,
        reason: `Proactive notification suppressed: Category "${category}" is disabled in user preferences.`,
      };
    }

    const notification: ProactiveNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      category,
      title,
      message,
      urgency,
      createdAt: new Date().toISOString(),
      read: false,
    };

    this.notifications.push(notification);

    return {
      sent: true,
      notification,
    };
  }

  /**
   * Scan for looming deadlines within the next `withinHours` window
   */
  async detectDeadlines(userId: string, withinHours = 24): Promise<Array<{ taskId: string; title: string; dueInHours: number }>> {
    if (!this.taskProvider) return [];

    const tasks = await this.taskProvider.getPendingTasks(userId);
    const now = Date.now();
    const thresholdMs = withinHours * 3600 * 1000;
    const detected: Array<{ taskId: string; title: string; dueInHours: number }> = [];

    for (const t of tasks) {
      if (t.dueDate) {
        const dueMs = new Date(t.dueDate).getTime();
        const diffMs = dueMs - now;
        if (diffMs > 0 && diffMs <= thresholdMs) {
          const dueInHours = Math.round((diffMs / (3600 * 1000)) * 10) / 10;
          detected.push({
            taskId: t.id,
            title: t.title,
            dueInHours,
          });

          // Proactively notify for detected deadline
          await this.notify(
            userId,
            'deadline',
            `Approaching Deadline: ${t.title}`,
            `Task "${t.title}" is due in ${dueInHours} hours.`,
            t.priority === 'HIGH' ? 'HIGH' : 'MEDIUM'
          );
        }
      }
    }

    return detected;
  }

  /**
   * Compile comprehensive Daily Briefing
   */
  async generateDailyBriefing(userId: string): Promise<DailyBriefing> {
    const tasks = this.taskProvider ? await this.taskProvider.getPendingTasks(userId) : [];
    const events = this.calendarProvider ? await this.calendarProvider.getUpcomingEvents(userId) : [];
    const deadlines = await this.detectDeadlines(userId, 24);

    const highPriorityTasks = tasks.filter((t) => t.priority === 'HIGH').length;

    let greeting = 'Good morning!';
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon!';
    if (hour >= 17) greeting = 'Good evening!';

    const summaryParts = [
      `${greeting} You have ${tasks.length} pending task(s), with ${highPriorityTasks} marked as high priority.`,
      `There are ${events.length} event(s) on your calendar today.`,
    ];

    if (deadlines.length > 0) {
      summaryParts.push(`Attention needed: ${deadlines.length} deadline(s) approaching within 24 hours.`);
    }

    const briefing: DailyBriefing = {
      date: new Date().toISOString().split('T')[0],
      greeting,
      urgentTasksCount: highPriorityTasks,
      upcomingDeadlines: deadlines,
      calendarEventsCount: events.length,
      summaryText: summaryParts.join(' '),
    };

    // Attempt proactive delivery of the briefing
    await this.notify(
      userId,
      'briefing',
      'Daily Briefing',
      briefing.summaryText,
      'LOW'
    );

    return briefing;
  }

  getNotifications(userId: string, unreadOnly = false): ProactiveNotification[] {
    let filtered = this.notifications.filter((n) => n.userId === userId);
    if (unreadOnly) {
      filtered = filtered.filter((n) => !n.read);
    }
    return filtered;
  }

  markAsRead(id: string): boolean {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      return true;
    }
    return false;
  }
}
