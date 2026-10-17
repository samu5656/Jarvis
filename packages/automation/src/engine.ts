import {
  CreateWorkflowInput,
  ExecutionState,
  WorkflowDefinition,
  WorkflowExecutionLog,
} from './types';
import { ConditionEvaluator } from './condition';

export interface ActionExecutor {
  (toolName: string, input: Record<string, any>, context: Record<string, any>): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
}

export class AutomationEngine {
  private workflows = new Map<string, WorkflowDefinition>();
  private executionHistory: WorkflowExecutionLog[] = [];
  private idempotencyRegistry = new Map<string, WorkflowExecutionLog>();
  private actionExecutor: ActionExecutor;

  constructor(actionExecutor?: ActionExecutor) {
    this.actionExecutor = actionExecutor || (async (tool, input) => {
      return { success: true, data: { executedTool: tool, input } };
    });
  }

  setActionExecutor(executor: ActionExecutor): void {
    this.actionExecutor = executor;
  }

  createWorkflow(input: CreateWorkflowInput): WorkflowDefinition {
    const id = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const wf: WorkflowDefinition = {
      id,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
      trigger: input.trigger,
      conditions: input.conditions,
      actions: input.actions,
      retryPolicy: input.retryPolicy ? {
        maxRetries: input.retryPolicy.maxRetries ?? 3,
        initialDelayMs: input.retryPolicy.initialDelayMs ?? 100,
        backoffMultiplier: input.retryPolicy.backoffMultiplier ?? 2,
      } : undefined,
      createdAt: now,
      updatedAt: now,
    };
    this.workflows.set(id, wf);
    return wf;
  }

  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  deleteWorkflow(id: string): boolean {
    return this.workflows.delete(id);
  }

  /**
   * Executes a workflow with retry, idempotency controls, and condition checks
   */
  async triggerWorkflow(
    workflowId: string,
    eventPayload: Record<string, any> = {},
    options?: { idempotencyKey?: string }
  ): Promise<WorkflowExecutionLog> {
    const wf = this.workflows.get(workflowId);
    if (!wf) {
      throw new Error(`Workflow with ID "${workflowId}" not found.`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const triggeredAt = new Date().toISOString();

    // 1. Idempotency Check
    if (options?.idempotencyKey) {
      const existing = this.idempotencyRegistry.get(options.idempotencyKey);
      if (existing) {
        return {
          ...existing,
          state: 'DUPLICATE_IDEMPOTENT',
          finishedAt: new Date().toISOString(),
        };
      }
    }

    if (!wf.enabled) {
      const skippedLog: WorkflowExecutionLog = {
        executionId,
        workflowId,
        idempotencyKey: options?.idempotencyKey,
        state: 'SKIPPED_CONDITIONS',
        triggeredAt,
        finishedAt: new Date().toISOString(),
        attempts: 0,
        actionResults: [],
        error: 'Workflow is disabled',
      };
      this.recordExecution(skippedLog);
      return skippedLog;
    }

    // 2. Condition Evaluation Check
    const conditionContext = { ...eventPayload, trigger: wf.trigger };
    const passed = ConditionEvaluator.evaluateConditions(wf.conditions, conditionContext);
    if (!passed) {
      const skippedLog: WorkflowExecutionLog = {
        executionId,
        workflowId,
        idempotencyKey: options?.idempotencyKey,
        state: 'SKIPPED_CONDITIONS',
        triggeredAt,
        finishedAt: new Date().toISOString(),
        attempts: 1,
        actionResults: [],
        error: 'Workflow conditions evaluated to false.',
      };
      this.recordExecution(skippedLog);
      return skippedLog;
    }

    // 3. Action Execution with Retry Logic
    const actionResults: WorkflowExecutionLog['actionResults'] = [];
    let state: ExecutionState = 'COMPLETED';
    let workflowError: string | undefined;
    let totalAttempts = 0;

    const retryPolicy = wf.retryPolicy || { maxRetries: 3, initialDelayMs: 20, backoffMultiplier: 1.5 };

    for (const action of wf.actions) {
      let success = false;
      let lastError: string | undefined;
      let actionData: any = undefined;
      let attempt = 0;

      while (!success && attempt <= retryPolicy.maxRetries) {
        attempt++;
        totalAttempts++;
        try {
          const res = await this.actionExecutor(action.toolName, action.input, conditionContext);
          if (res.success) {
            success = true;
            actionData = res.data;
          } else {
            lastError = res.error || 'Action reported failure';
            if (attempt <= retryPolicy.maxRetries) {
              const delay = retryPolicy.initialDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        } catch (err: any) {
          lastError = err.message || 'Action threw an error';
          if (attempt <= retryPolicy.maxRetries) {
            const delay = retryPolicy.initialDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      actionResults.push({
        actionId: action.id,
        toolName: action.toolName,
        success,
        data: actionData,
        error: lastError,
      });

      if (!success && !action.continueOnError) {
        state = 'FAILED';
        workflowError = `Action "${action.id}" (${action.toolName}) failed after ${attempt} attempts: ${lastError}`;
        break;
      }
    }

    const log: WorkflowExecutionLog = {
      executionId,
      workflowId,
      idempotencyKey: options?.idempotencyKey,
      state,
      triggeredAt,
      finishedAt: new Date().toISOString(),
      attempts: totalAttempts,
      actionResults,
      error: workflowError,
    };

    this.recordExecution(log);

    if (options?.idempotencyKey) {
      this.idempotencyRegistry.set(options.idempotencyKey, log);
    }

    return log;
  }

  private recordExecution(log: WorkflowExecutionLog): void {
    this.executionHistory.push(log);
  }

  getExecutionHistory(workflowId?: string): WorkflowExecutionLog[] {
    if (workflowId) {
      return this.executionHistory.filter((l) => l.workflowId === workflowId);
    }
    return this.executionHistory;
  }
}
