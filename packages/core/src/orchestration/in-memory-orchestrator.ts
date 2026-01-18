/**
 * In-memory workflow orchestrator
 *
 * Simple orchestrator for development and CLI usage.
 * No external dependencies, all execution happens in-process.
 */

import type {
  Activity,
  ActivityContext,
  OrchestratorConfig,
  RetryPolicy,
  WorkflowContext,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowFilter,
  WorkflowHandle,
  WorkflowInfo,
  WorkflowOptions,
  WorkflowOrchestrator,
  WorkflowProgress,
  WorkflowStatus,
} from '@pie-qti/transform-types';
import { randomUUID } from 'crypto';

/**
 * Default retry policy
 */
const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialInterval: 1000,
  maxInterval: 30000,
  backoffCoefficient: 2,
};

/**
 * Execution record for tracking workflow state
 */
interface ExecutionRecord {
  workflowId: string;
  workflowType: string;
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  progress?: WorkflowProgress;
  error?: { message: string; stack?: string };
  resultPromise: Promise<unknown>;
  cancelRequested: boolean;
}

/**
 * In-memory implementation of workflow orchestrator
 */
export class InMemoryOrchestrator implements WorkflowOrchestrator {
  readonly name = 'in-memory';

  private config?: OrchestratorConfig;
  private executions = new Map<string, ExecutionRecord>();
  private eventListeners: Array<(event: WorkflowEvent) => void> = [];

  async initialize(config: OrchestratorConfig): Promise<void> {
    this.config = config;
  }

  async startWorkflow<TInput, TOutput>(
    definition: WorkflowDefinition<TInput, TOutput>,
    input: TInput,
    options?: WorkflowOptions
  ): Promise<WorkflowHandle<TOutput>> {
    const workflowId = options?.workflowId || randomUUID();

    // Create workflow context
    const context = this.createWorkflowContext(workflowId, options);

    // Create execution promise
    const resultPromise = this.executeWorkflow(definition, context, input, options);

    // Track execution
    const record: ExecutionRecord = {
      workflowId,
      workflowType: definition.type,
      status: 'running',
      startTime: new Date(),
      resultPromise,
      cancelRequested: false,
    };
    this.executions.set(workflowId, record);

    // Emit started event
    this.emitEvent({
      type: 'started',
      workflowId,
      workflowType: definition.type,
      timestamp: new Date(),
    });

    // Handle completion/failure
    resultPromise
      .then(() => {
        record.status = 'completed';
        record.endTime = new Date();
        this.emitEvent({
          type: 'completed',
          workflowId,
          workflowType: definition.type,
          timestamp: new Date(),
        });
      })
      .catch((error: Error) => {
        record.status = 'failed';
        record.endTime = new Date();
        record.error = {
          message: error.message,
          stack: error.stack,
        };
        this.emitEvent({
          type: 'failed',
          workflowId,
          workflowType: definition.type,
          timestamp: new Date(),
          error: {
            message: error.message,
            stack: error.stack,
            type: error.name,
          },
        });
      });

    return this.createWorkflowHandle<TOutput>(workflowId);
  }

  async getWorkflow<TOutput>(workflowId: string): Promise<WorkflowHandle<TOutput>> {
    const record = this.executions.get(workflowId);
    if (!record) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    return this.createWorkflowHandle<TOutput>(workflowId);
  }

  async listWorkflows(filter?: WorkflowFilter): Promise<WorkflowInfo[]> {
    let workflows = Array.from(this.executions.values());

    // Apply filters
    if (filter?.workflowType) {
      workflows = workflows.filter((w) => w.workflowType === filter.workflowType);
    }

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      workflows = workflows.filter((w) => statuses.includes(w.status));
    }

    if (filter?.startTime) {
      if (filter.startTime.after) {
        workflows = workflows.filter((w) => w.startTime >= filter.startTime!.after!);
      }
      if (filter.startTime.before) {
        workflows = workflows.filter((w) => w.startTime <= filter.startTime!.before!);
      }
    }

    // Apply limit
    if (filter?.limit) {
      workflows = workflows.slice(0, filter.limit);
    }

    return workflows.map((w) => ({
      workflowId: w.workflowId,
      workflowType: w.workflowType,
      status: w.status,
      startTime: w.startTime,
      endTime: w.endTime,
      progress: w.progress,
      error: w.error,
    }));
  }

  on(_event: 'workflow-event', listener: (event: WorkflowEvent) => void): void {
    this.eventListeners.push(listener);
  }

  off(_event: 'workflow-event', listener: (event: WorkflowEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  async shutdown(): Promise<void> {
    // Wait for all running workflows to complete
    const runningWorkflows = Array.from(this.executions.values()).filter(
      (w) => w.status === 'running'
    );

    await Promise.allSettled(runningWorkflows.map((w) => w.resultPromise));

    this.executions.clear();
    this.eventListeners = [];
  }

  /**
   * Create workflow context for execution
   */
  private createWorkflowContext(workflowId: string, options?: WorkflowOptions): WorkflowContext {
    const record = this.executions.get(workflowId);

    return {
      workflowId,

      executeActivity: async <TInput, TOutput>(
        activity: Activity<TInput, TOutput>,
        input: TInput,
        activityOptions?: { retryPolicy?: RetryPolicy; timeout?: number }
      ): Promise<TOutput> => {
        const activityId = randomUUID();
        const retryPolicy =
          activityOptions?.retryPolicy ||
          activity.retryPolicy ||
          options?.retryPolicy ||
          this.config?.defaultRetryPolicy ||
          DEFAULT_RETRY_POLICY;

        const timeout =
          activityOptions?.timeout ||
          activity.timeout ||
          this.config?.defaultTimeout?.activityTimeout;

        return this.executeActivityWithRetry(
          workflowId,
          activityId,
          activity,
          input,
          retryPolicy,
          timeout
        );
      },

      log: (level, message, metadata) => {
        // Simple console logging for in-memory orchestrator
        const logMessage = `[${workflowId}] ${message}`;
        switch (level) {
          case 'debug':
            console.debug(logMessage, metadata);
            break;
          case 'info':
            console.info(logMessage, metadata);
            break;
          case 'warn':
            console.warn(logMessage, metadata);
            break;
          case 'error':
            console.error(logMessage, metadata);
            break;
        }
      },

      reportProgress: (progress) => {
        if (record) {
          record.progress = progress;
        }
      },

      sleep: async (durationMs) => {
        return new Promise((resolve) => setTimeout(resolve, durationMs));
      },

      now: () => new Date(),
    };
  }

  /**
   * Execute workflow with timeout handling
   */
  private async executeWorkflow<TInput, TOutput>(
    definition: WorkflowDefinition<TInput, TOutput>,
    context: WorkflowContext,
    input: TInput,
    options?: WorkflowOptions
  ): Promise<TOutput> {
    const timeout =
      options?.timeout?.workflowTimeout ||
      definition.timeout?.workflowTimeout ||
      this.config?.defaultTimeout?.workflowTimeout;

    const workflowPromise = definition.execute(context, input);

    if (timeout) {
      return Promise.race([
        workflowPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Workflow timeout after ${timeout}ms`)), timeout)
        ),
      ]);
    }

    return workflowPromise;
  }

  /**
   * Execute activity with retry logic
   */
  private async executeActivityWithRetry<TInput, TOutput>(
    workflowId: string,
    activityId: string,
    activity: Activity<TInput, TOutput>,
    input: TInput,
    retryPolicy: RetryPolicy,
    timeout?: number
  ): Promise<TOutput> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        // Emit activity started event
        this.emitEvent({
          type: 'activity-started',
          workflowId,
          workflowType: activity.type,
          activityType: activity.type,
          timestamp: new Date(),
          metadata: { attempt },
        });

        // Create activity context
        const context: ActivityContext = {
          activityId,
          workflowId,
          attempt,
          log: (level, message, metadata) => {
            const logMessage = `[${workflowId}:${activityId}] ${message}`;
            switch (level) {
              case 'debug':
                console.debug(logMessage, metadata);
                break;
              case 'info':
                console.info(logMessage, metadata);
                break;
              case 'warn':
                console.warn(logMessage, metadata);
                break;
              case 'error':
                console.error(logMessage, metadata);
                break;
            }
          },
          heartbeat: () => {
            // No-op for in-memory orchestrator
          },
          isCancelled: () => {
            const record = this.executions.get(workflowId);
            return record?.cancelRequested ?? false;
          },
        };

        // Execute with timeout
        const activityPromise = activity.execute(context, input);
        const result = timeout
          ? await Promise.race([
              activityPromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Activity timeout after ${timeout}ms`)), timeout)
              ),
            ])
          : await activityPromise;

        // Emit activity completed event
        this.emitEvent({
          type: 'activity-completed',
          workflowId,
          workflowType: activity.type,
          activityType: activity.type,
          timestamp: new Date(),
          metadata: { attempt },
        });

        return result;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is non-retryable
        if (
          retryPolicy.nonRetryableErrors &&
          retryPolicy.nonRetryableErrors.includes(lastError.name)
        ) {
          throw lastError;
        }

        // Emit activity failed event
        this.emitEvent({
          type: 'activity-failed',
          workflowId,
          workflowType: activity.type,
          activityType: activity.type,
          timestamp: new Date(),
          error: {
            message: lastError.message,
            stack: lastError.stack,
            type: lastError.name,
          },
          attempt,
        });

        // Don't retry on last attempt
        if (attempt === retryPolicy.maxAttempts) {
          break;
        }

        // Calculate backoff delay (exponential)
        const backoffDelay = Math.min(
          retryPolicy.initialInterval * Math.pow(retryPolicy.backoffCoefficient, attempt - 1),
          retryPolicy.maxInterval
        );

        // Emit retry event
        this.emitEvent({
          type: 'retry',
          workflowId,
          workflowType: activity.type,
          activityType: activity.type,
          timestamp: new Date(),
          attempt: attempt + 1,
          metadata: { backoffDelay },
        });

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError || new Error('Activity failed with unknown error');
  }

  /**
   * Create workflow handle
   */
  private createWorkflowHandle<TOutput>(workflowId: string): WorkflowHandle<TOutput> {
    const self = this;
    return {
      workflowId,
      get workflowType() {
        const record = self.executions.get(workflowId);
        return record?.workflowType || '';
      },

      status: async () => {
        const record = self.executions.get(workflowId);
        if (!record) {
          throw new Error(`Workflow not found: ${workflowId}`);
        }
        return record.status;
      },

      progress: async () => {
        const record = self.executions.get(workflowId);
        return record?.progress ?? null;
      },

      result: async () => {
        const record = self.executions.get(workflowId);
        if (!record) {
          throw new Error(`Workflow not found: ${workflowId}`);
        }
        return (await record.resultPromise) as TOutput;
      },

      cancel: async () => {
        const record = self.executions.get(workflowId);
        if (!record) {
          throw new Error(`Workflow not found: ${workflowId}`);
        }
        record.cancelRequested = true;
        record.status = 'cancelled';
        record.endTime = new Date();
      },

      terminate: async (reason?: string) => {
        const record = self.executions.get(workflowId);
        if (!record) {
          throw new Error(`Workflow not found: ${workflowId}`);
        }
        record.cancelRequested = true;
        record.status = 'cancelled';
        record.endTime = new Date();
        record.error = { message: reason || 'Workflow terminated' };
      },
    };
  }

  /**
   * Emit workflow event to listeners
   */
  private emitEvent(event: WorkflowEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }
}
