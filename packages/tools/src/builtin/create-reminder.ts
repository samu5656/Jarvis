import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';

export const CreateReminderInputSchema = z.object({
  title: z.string().min(1, 'Reminder title is required'),
  runAt: z.string().min(1, 'Target time runAt is required'),
  recurrence: z.string().optional(),
});

export type CreateReminderInput = z.infer<typeof CreateReminderInputSchema>;

export interface ReminderRecord {
  id: string;
  title: string;
  runAt: string;
  recurrence?: string;
  status: 'SCHEDULED';
  createdAt: string;
}

export class CreateReminderTool implements JarvisTool<CreateReminderInput, ReminderRecord> {
  readonly name = 'create_reminder';
  readonly description = 'Schedules a reminder alert for the user at a specified future time.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = CreateReminderInputSchema;

  async execute(input: CreateReminderInput, _ctx: ToolContext): Promise<ToolResult<ReminderRecord>> {
    const reminder: ReminderRecord = {
      id: `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: input.title,
      runAt: input.runAt,
      recurrence: input.recurrence,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: reminder,
    };
  }
}
