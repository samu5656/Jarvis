import { AutomationEngine } from './engine';
import { WorkflowExecutionLog } from './types';

export interface AutomationJobData {
  workflowId: string;
  payload?: Record<string, any>;
  idempotencyKey?: string;
}

export class AutomationQueueWorker {
  private engine: AutomationEngine;
  private isProcessing = false;
  private queue: AutomationJobData[] = [];

  constructor(engine: AutomationEngine) {
    this.engine = engine;
  }

  async enqueue(job: AutomationJobData): Promise<void> {
    this.queue.push(job);
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift()!;
    try {
      await this.engine.triggerWorkflow(job.workflowId, job.payload, {
        idempotencyKey: job.idempotencyKey,
      });
    } catch (err) {
      console.error(`AutomationWorker failed for workflow ${job.workflowId}:`, err);
    }

    setImmediate(() => this.processNext());
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}
