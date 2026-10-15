import { AuditLogger } from './audit';
import { ToolRegistry } from './registry';
import { AuditLogEntry, ExecutionStatus, ToolContext, ToolResult } from './types';

export interface RuntimeExecutionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  confirmationRequired?: boolean;
  executionId: string;
  auditEntry: AuditLogEntry;
}

export class ToolRuntime {
  private registry: ToolRegistry;
  private auditLogger: AuditLogger;
  private killSwitchActive = false;

  constructor(registry: ToolRegistry, auditLogger?: AuditLogger) {
    this.registry = registry;
    this.auditLogger = auditLogger || new AuditLogger();
  }

  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  getRegistry(): ToolRegistry {
    return this.registry;
  }

  setKillSwitch(active: boolean): void {
    this.killSwitchActive = active;
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  async executeTool<TInput = any, TOutput = any>(
    toolName: string,
    rawInput: TInput,
    context?: Partial<ToolContext>
  ): Promise<RuntimeExecutionResponse<TOutput>> {
    const startTime = Date.now();
    const executionId = context?.executionId || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ctx: ToolContext = {
      executionId,
      userId: context?.userId,
      sessionId: context?.sessionId,
      confirmed: context?.confirmed ?? false,
    };

    // 1. Check if tool exists
    const tool = this.registry.get(toolName);
    if (!tool) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Tool "${toolName}" is not registered in the system.`;
      const auditEntry = this.auditLogger.log({
        executionId,
        userId: ctx.userId,
        toolName,
        risk: 'LOW',
        status: 'REJECTED',
        input: rawInput as any,
        error: errorMsg,
        durationMs,
      });

      return {
        success: false,
        error: errorMsg,
        executionId,
        auditEntry,
      };
    }

    // 2. Check Global Kill Switch
    if (this.killSwitchActive) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Execution blocked: Global kill switch is currently active.`;
      const auditEntry = this.auditLogger.log({
        executionId,
        userId: ctx.userId,
        toolName: tool.name,
        risk: tool.risk,
        status: 'REJECTED',
        input: rawInput as any,
        error: errorMsg,
        durationMs,
      });

      return {
        success: false,
        error: errorMsg,
        executionId,
        auditEntry,
      };
    }

    // 3. Validate arguments against schema
    const parseResult = tool.inputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const durationMs = Date.now() - startTime;
      const errorDetails = parseResult.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      const errorMsg = `Invalid input arguments for tool "${tool.name}": ${errorDetails}`;

      const auditEntry = this.auditLogger.log({
        executionId,
        userId: ctx.userId,
        toolName: tool.name,
        risk: tool.risk,
        status: 'REJECTED',
        input: rawInput as any,
        error: errorMsg,
        durationMs,
      });

      return {
        success: false,
        error: errorMsg,
        executionId,
        auditEntry,
      };
    }

    // 4. High-risk confirmation gate
    if (tool.risk === 'HIGH' && !ctx.confirmed) {
      const durationMs = Date.now() - startTime;
      const warningMsg = `Confirmation required for high-risk tool "${tool.name}".`;
      const auditEntry = this.auditLogger.log({
        executionId,
        userId: ctx.userId,
        toolName: tool.name,
        risk: tool.risk,
        status: 'CONFIRMATION_REQUIRED',
        input: rawInput as any,
        error: warningMsg,
        durationMs,
      });

      return {
        success: false,
        confirmationRequired: true,
        error: warningMsg,
        executionId,
        auditEntry,
      };
    }

    // 5. Execute tool
    try {
      const result: ToolResult<TOutput> = await tool.execute(parseResult.data, ctx);
      const durationMs = Date.now() - startTime;
      const status: ExecutionStatus = result.success ? 'SUCCESS' : 'FAILED';

      const auditEntry = this.auditLogger.log({
        executionId,
        userId: ctx.userId,
        toolName: tool.name,
        risk: tool.risk,
        status,
        input: rawInput as any,
        result: result.data,
        error: result.error,
        durationMs,
      });

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        executionId,
        auditEntry,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err.message || 'Unexpected tool execution failure';

      const auditEntry = this.auditLogger.log({
        executionId,
        userId: ctx.userId,
        toolName: tool.name,
        risk: tool.risk,
        status: 'FAILED',
        input: parseResult.data as any,
        error: errorMsg,
        durationMs,
      });

      return {
        success: false,
        error: errorMsg,
        executionId,
        auditEntry,
      };
    }
  }
}
