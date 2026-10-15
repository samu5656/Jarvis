import { z } from 'zod';
import { JarvisTool, ToolContext, ToolResult } from '../types';

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1, 'Task title cannot be empty'),
  description: z.string().optional(),
  dueAt: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: string;
}

export class CreateTaskTool implements JarvisTool<CreateTaskInput, TaskRecord> {
  readonly name = 'create_task';
  readonly description = 'Creates a new to-do task for the user with an optional description and due date.';
  readonly risk = 'LOW' as const;
  readonly inputSchema = CreateTaskInputSchema;

  async execute(input: CreateTaskInput, _ctx: ToolContext): Promise<ToolResult<TaskRecord>> {
    const task: TaskRecord = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: task,
    };
  }
}
