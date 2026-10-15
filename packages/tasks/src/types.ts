import { z } from 'zod';

export const TaskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  dueAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  dueAt: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskInputSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  dueAt: z.string().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const ReminderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1, 'Reminder title is required'),
  runAt: z.string().min(1, 'Reminder runAt timestamp is required'),
  recurrence: z.string().optional(),
  status: z.enum(['PENDING', 'SCHEDULED', 'EXECUTED', 'CANCELLED']).default('PENDING'),
  createdAt: z.string(),
  executedAt: z.string().optional(),
});

export type Reminder = z.infer<typeof ReminderSchema>;

export const CreateReminderInputSchema = z.object({
  title: z.string().min(1, 'Reminder title is required'),
  runAt: z.string().min(1, 'Reminder runAt timestamp is required'),
  recurrence: z.string().optional(),
});

export type CreateReminderInput = z.infer<typeof CreateReminderInputSchema>;
