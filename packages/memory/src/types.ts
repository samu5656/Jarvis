import { z } from 'zod';

export type MemoryImportance = 'LOW' | 'MEDIUM' | 'HIGH';
export type MemoryType = 'USER_PREFERENCE' | 'PROJECT_CONTEXT' | 'FACT' | 'SHORT_TERM_CONVERSATION';

export const MemorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['USER_PREFERENCE', 'PROJECT_CONTEXT', 'FACT', 'SHORT_TERM_CONVERSATION']),
  content: z.string().min(1, 'Memory content is required'),
  source: z.string().optional(),
  importance: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Memory = z.infer<typeof MemorySchema>;

export const CreateMemoryInputSchema = z.object({
  type: z.enum(['USER_PREFERENCE', 'PROJECT_CONTEXT', 'FACT', 'SHORT_TERM_CONVERSATION']).default('FACT'),
  content: z.string().min(1, 'Memory content is required'),
  source: z.string().optional(),
  importance: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
});

export type CreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>;

export interface MemoryQuery {
  userId: string;
  query?: string;
  type?: MemoryType;
  importance?: MemoryImportance;
  limit?: number;
}
