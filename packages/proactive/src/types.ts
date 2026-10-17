import { z } from 'zod';

export type NotificationCategory = 'briefing' | 'deadline' | 'system' | 'reminder';

export interface ProactivePreferences {
  userId: string;
  enabledCategories: NotificationCategory[];
  quietHoursStart?: string; // e.g. "22:00"
  quietHoursEnd?: string;   // e.g. "07:00"
}

export interface ProactiveNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  read: boolean;
}

export interface DailyBriefing {
  date: string;
  greeting: string;
  urgentTasksCount: number;
  upcomingDeadlines: Array<{ taskId: string; title: string; dueInHours: number }>;
  calendarEventsCount: number;
  summaryText: string;
}

export const UpdatePreferencesInputSchema = z.object({
  enabledCategories: z.array(z.enum(['briefing', 'deadline', 'system', 'reminder'])),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesInputSchema>;
