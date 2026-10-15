import { z } from 'zod';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ToolContext {
  userId?: string;
  sessionId?: string;
  executionId: string;
  confirmed?: boolean;
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  sanitized?: boolean;
}

export interface JarvisTool<TInput = any, TOutput = any> {
  readonly name: string;
  readonly description: string;
  readonly risk: RiskLevel;
  readonly inputSchema: z.ZodType<TInput>;
  execute(input: TInput, ctx: ToolContext): Promise<ToolResult<TOutput>>;
}

export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'REJECTED' | 'CONFIRMATION_REQUIRED';

export interface AuditLogEntry {
  id: string;
  executionId: string;
  userId?: string;
  toolName: string;
  risk: RiskLevel;
  status: ExecutionStatus;
  input: Record<string, any>;
  result?: any;
  error?: string;
  durationMs: number;
  timestamp: string;
}

export interface ToolRuntimeOptions {
  enableKillSwitch?: boolean;
  requireConfirmationForHighRisk?: boolean;
}
