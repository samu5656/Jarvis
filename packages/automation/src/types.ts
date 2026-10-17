import { z } from 'zod';

export type TriggerType = 'schedule' | 'event' | 'webhook';

export interface WorkflowTrigger {
  type: TriggerType;
  cronOrInterval?: string; // For scheduled triggers (e.g., "every 5m" or ISO interval)
  eventType?: string;      // For event triggers (e.g., "TASK_COMPLETED", "EMAIL_RECEIVED")
  config?: Record<string, any>;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value?: any;
}

export interface WorkflowAction {
  id: string;
  toolName: string;
  input: Record<string, any>;
  continueOnError?: boolean;
}

export interface WorkflowRetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions?: WorkflowCondition[];
  actions: WorkflowAction[];
  retryPolicy?: WorkflowRetryPolicy;
  createdAt: string;
  updatedAt: string;
}

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  trigger: z.object({
    type: z.enum(['schedule', 'event', 'webhook']),
    cronOrInterval: z.string().optional(),
    eventType: z.string().optional(),
    config: z.record(z.any()).optional(),
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'exists']),
    value: z.any().optional(),
  })).optional(),
  actions: z.array(z.object({
    id: z.string(),
    toolName: z.string(),
    input: z.record(z.any()),
    continueOnError: z.boolean().optional(),
  })).min(1, 'At least one action is required in a workflow'),
  retryPolicy: z.object({
    maxRetries: z.number().int().min(0).max(10),
    initialDelayMs: z.number().int().min(10),
    backoffMultiplier: z.number().min(1),
  }).optional(),
});

export type CreateWorkflowInput = z.infer<typeof WorkflowDefinitionSchema>;

export type ExecutionState = 'COMPLETED' | 'FAILED' | 'SKIPPED_CONDITIONS' | 'DUPLICATE_IDEMPOTENT';

export interface WorkflowExecutionLog {
  executionId: string;
  workflowId: string;
  idempotencyKey?: string;
  state: ExecutionState;
  triggeredAt: string;
  finishedAt: string;
  attempts: number;
  actionResults: Array<{
    actionId: string;
    toolName: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  error?: string;
}
