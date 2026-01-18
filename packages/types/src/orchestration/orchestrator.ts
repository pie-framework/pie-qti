/**
 * Core orchestration types for workflow and activity management
 */

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial backoff delay in milliseconds */
  initialInterval: number;
  /** Maximum backoff delay in milliseconds */
  maxInterval: number;
  /** Backoff multiplier (exponential backoff) */
  backoffCoefficient: number;
  /** Non-retryable error types */
  nonRetryableErrors?: string[];
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Maximum time for entire workflow execution (ms) */
  workflowTimeout?: number;
  /** Maximum time for a single activity execution (ms) */
  activityTimeout?: number;
  /** Heartbeat interval for long-running activities (ms) */
  heartbeatInterval?: number;
}

/**
 * Workflow execution status
 * Extensible string type allows custom workflow statuses
 */
export type WorkflowStatus = string;

/**
 * Progress tracking for workflow execution
 */
export interface WorkflowProgress {
  /** Current step/activity being executed */
  currentStep: string;
  /** Number of completed steps */
  completedSteps: number;
  /** Total number of steps */
  totalSteps: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Optional message describing current progress */
  message?: string;
}

/**
 * Workflow execution handle for monitoring and control
 */
export interface WorkflowHandle<TOutput> {
  /** Unique workflow execution ID */
  readonly workflowId: string;
  /** Workflow type identifier */
  readonly workflowType: string;
  /** Current execution status */
  status(): Promise<WorkflowStatus>;
  /** Get current progress information */
  progress(): Promise<WorkflowProgress | null>;
  /** Wait for workflow completion and get result */
  result(): Promise<TOutput>;
  /** Cancel the workflow execution */
  cancel(): Promise<void>;
  /** Terminate the workflow execution (immediate, no cleanup) */
  terminate(reason?: string): Promise<void>;
}

/**
 * Workflow event for observability
 */
export interface WorkflowEvent {
  /** Event type (extensible string) */
  type: string;
  /** Workflow execution ID */
  workflowId: string;
  /** Workflow type */
  workflowType: string;
  /** Event timestamp */
  timestamp: Date;
  /** Activity type (for activity events) */
  activityType?: string;
  /** Error information (for failure events) */
  error?: {
    message: string;
    stack?: string;
    type?: string;
  };
  /** Retry attempt number (for retry events) */
  attempt?: number;
  /** Additional event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filter for querying workflows
 */
export interface WorkflowFilter {
  /** Filter by workflow type */
  workflowType?: string;
  /** Filter by status */
  status?: WorkflowStatus | WorkflowStatus[];
  /** Filter by start time range */
  startTime?: {
    after?: Date;
    before?: Date;
  };
  /** Maximum number of results */
  limit?: number;
}

/**
 * Workflow execution information
 */
export interface WorkflowInfo {
  /** Workflow execution ID */
  workflowId: string;
  /** Workflow type */
  workflowType: string;
  /** Current status */
  status: WorkflowStatus;
  /** Start time */
  startTime: Date;
  /** End time (if completed/failed) */
  endTime?: Date;
  /** Current progress */
  progress?: WorkflowProgress;
  /** Error information (if failed) */
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Options for starting a workflow
 */
export interface WorkflowOptions {
  /** Optional workflow ID (generated if not provided) */
  workflowId?: string;
  /** Retry policy override */
  retryPolicy?: RetryPolicy;
  /** Timeout configuration override */
  timeout?: TimeoutConfig;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context provided to workflow execution
 */
export interface WorkflowContext {
  /** Workflow execution ID */
  readonly workflowId: string;
  /** Execute an activity */
  executeActivity<TInput, TOutput>(
    activity: Activity<TInput, TOutput>,
    input: TInput,
    options?: { retryPolicy?: RetryPolicy; timeout?: number }
  ): Promise<TOutput>;
  /** Log message from workflow */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): void;
  /** Report progress */
  reportProgress(progress: WorkflowProgress): void;
  /** Sleep for specified duration (ms) - workflow-safe */
  sleep(durationMs: number): Promise<void>;
  /** Current workflow time (deterministic for workflow engines that support it) */
  now(): Date;
}

/**
 * Context provided to activity execution
 */
export interface ActivityContext {
  /** Activity execution ID */
  readonly activityId: string;
  /** Workflow execution ID */
  readonly workflowId: string;
  /** Current attempt number (starts at 1) */
  readonly attempt: number;
  /** Log message from activity */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): void;
  /** Send heartbeat (for long-running activities) */
  heartbeat(details?: unknown): void;
  /** Check if cancellation was requested */
  isCancelled(): boolean;
}

/**
 * Activity definition - represents a unit of work that can be retried
 */
export interface Activity<TInput, TOutput> {
  /** Activity type identifier */
  type: string;
  /** Activity display name */
  name: string;
  /** Execute the activity */
  execute: (context: ActivityContext, input: TInput) => Promise<TOutput>;
  /** Default retry policy for this activity */
  retryPolicy?: RetryPolicy;
  /** Default timeout for this activity (ms) */
  timeout?: number;
}

/**
 * Workflow definition - represents orchestration logic
 */
export interface WorkflowDefinition<TInput, TOutput> {
  /** Workflow type identifier */
  type: string;
  /** Workflow version */
  version: string;
  /** Workflow display name */
  name: string;
  /** Execute the workflow (pure orchestration - deterministic, no I/O) */
  execute: (context: WorkflowContext, input: TInput) => Promise<TOutput>;
  /** Default timeout configuration */
  timeout?: TimeoutConfig;
}

/**
 * Configuration for workflow orchestrator
 */
export interface OrchestratorConfig {
  /** Orchestrator name/type */
  name: string;
  /** Default retry policy */
  defaultRetryPolicy?: RetryPolicy;
  /** Default timeout configuration */
  defaultTimeout?: TimeoutConfig;
  /** Maximum concurrent activities (for InMemoryOrchestrator) */
  maxConcurrentActivities?: number;
  /** Additional orchestrator-specific configuration */
  [key: string]: unknown;
}

/**
 * Workflow orchestrator interface - abstracts workflow execution engine
 */
export interface WorkflowOrchestrator {
  /** Orchestrator name */
  readonly name: string;

  /** Initialize the orchestrator */
  initialize(config: OrchestratorConfig): Promise<void>;

  /** Start a workflow execution */
  startWorkflow<TInput, TOutput>(
    definition: WorkflowDefinition<TInput, TOutput>,
    input: TInput,
    options?: WorkflowOptions
  ): Promise<WorkflowHandle<TOutput>>;

  /** Get handle to existing workflow */
  getWorkflow<TOutput>(workflowId: string): Promise<WorkflowHandle<TOutput>>;

  /** List workflows matching filter */
  listWorkflows(filter?: WorkflowFilter): Promise<WorkflowInfo[]>;

  /** Subscribe to workflow events */
  on(event: 'workflow-event', listener: (event: WorkflowEvent) => void): void;

  /** Unsubscribe from workflow events */
  off(event: 'workflow-event', listener: (event: WorkflowEvent) => void): void;

  /** Shutdown the orchestrator and cleanup resources */
  shutdown(): Promise<void>;
}
