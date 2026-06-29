/**
 * Transform Plugin Type Definitions
 *
 * Core interfaces for the plugin architecture
 */

import type { LogContext, ServerLogger } from '@pie-qti/logger/server';

export type { LogContext, ServerLogger };

/**
 * Transform format identifier
 * Extensible string type allows arbitrary format pairs to be registered
 */
export type TransformFormat = string;

/**
 * Transform plugin interface
 */
export interface TransformPlugin {
  /** Unique plugin identifier */
  readonly id: string;

  /** Plugin version */
  readonly version: string;

  /** Human-readable plugin name */
  readonly name: string;

  /** Source format this plugin transforms from */
  readonly sourceFormat: TransformFormat;

  /** Target format this plugin transforms to */
  readonly targetFormat: TransformFormat;

  /**
   * Plugin priority (optional)
   * Higher priority plugins are selected first when multiple plugins
   * match the same source/target format pair.
   * Default: 100
   *
   * Recommended ranges:
   * - 1-99: Low priority (fallback implementations)
   * - 100-499: Normal priority (standard plugins)
   * - 500-999: High priority (vendor-specific overrides)
   * - 1000+: Critical priority (framework internals)
   */
  readonly priority?: number;

  /**
   * Initialize plugin (optional)
   */
  initialize?(options: PluginOptions): Promise<void>;

  /**
   * Check if plugin can handle this input
   */
  canHandle(input: TransformInput): Promise<boolean>;

  /**
   * Transform input to output
   */
  transform(input: TransformInput, context: TransformContext): Promise<TransformOutput>;

  /**
   * Validate output (optional)
   */
  validate?(output: TransformOutput): Promise<ValidationResult>;

  /**
   * Cleanup resources (optional)
   */
  dispose?(): Promise<void>;
}

/**
 * Plugin initialization options
 */
export interface PluginOptions {
  [key: string]: any;
}

/**
 * Transform input
 */
export interface TransformInput {
  /** Input content (XML string, JSON, or file path) */
  content: string | object;

  /** Original format (optional, will be auto-detected) */
  format?: TransformFormat;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Transformed output item with explicit format
 */
export interface TransformOutputItem {
  /** Item content (PIE object for PIE format, XML string for QTI format) */
  content: any;

  /** Format of this specific item */
  format: TransformFormat;
}

/**
 * Transform output
 */
export interface TransformOutput {
  /** Transformed items (wrapped with format information) */
  items: TransformOutputItem[];

  /** Primary output format */
  format: TransformFormat;

  /** Transformation metadata */
  metadata: TransformMetadata;

  /** Any warnings or errors */
  warnings?: TransformWarning[];
  errors?: TransformError[];
}

/**
 * Transform context passed through the pipeline
 */
export interface TransformContext {
  /** Logger for transformation messages */
  logger?: ServerLogger;

  /** Vendor-specific options */
  vendor?: string;

  /** Additional options */
  options?: Record<string, any>;

  /** Storage backend for file operations */
  storage?: any; // StorageBackend from storage package - using any to avoid circular dependency

  /** Current session identifier */
  sessionId?: string;

  /** User identifier for logging and tracking */
  userId?: string;

  /** Vendor metadata from detection phase */
  metadata?: Record<string, unknown>;
}

/**
 * Transform metadata
 */
export interface TransformMetadata {
  /** Source format */
  sourceFormat: TransformFormat;

  /** Target format */
  targetFormat: TransformFormat;

  /** Plugin used for transformation */
  pluginId: string;

  /** Transformation timestamp */
  timestamp: Date;

  /** Number of items processed */
  itemCount: number;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Source QTI version when the source format is a QTI variant */
  qtiVersion?: string;

  /** Structured explanation of profile matches, custom handling, and transform steps. */
  conversionTrace?: import('../source-profile.js').ConversionTrace;

  /** Source profiles detected while analyzing or transforming the source content. */
  sourceProfiles?: import('../source-profile.js').SourceProfileMatch[];

  /** Structured diagnostics emitted by source-profile detection or handling. */
  sourceDiagnostics?: import('../source-profile.js').SourceProfileDiagnostic[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Transform warning
 */
export interface TransformWarning {
  itemId?: string;
  message: string;
  code?: string;
}

/**
 * Error category for classification
 */
export enum ErrorCategory {
  /**
   * User input validation error
   * Example: Invalid QTI XML, missing required elements
   * Action: Show to user, allow correction
   */
  VALIDATION = 'validation',

  /**
   * Configuration or setup error
   * Example: Missing API keys, invalid storage config
   * Action: Alert ops team, check configuration
   */
  CONFIGURATION = 'configuration',

  /**
   * Internal plugin or framework error
   * Example: Null pointer, unexpected state
   * Action: Log for debugging, may indicate bug
   */
  INTERNAL = 'internal',

  /**
   * External service or network error
   * Example: S3 unavailable, API timeout
   * Action: Retry with backoff, check service status
   */
  EXTERNAL = 'external',
}

/**
 * Transform error with classification
 */
export interface TransformError {
  /**
   * Item identifier if error is item-specific
   */
  itemId?: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Error code for programmatic handling
   */
  code?: string;

  /**
   * Error category for classification
   */
  category: ErrorCategory;

  /**
   * Whether error is recoverable
   * Recoverable errors can be retried or worked around
   */
  recoverable: boolean;

  /**
   * Underlying cause if error is wrapped
   */
  cause?: Error;

  /**
   * Additional context for debugging
   */
  context?: Record<string, unknown>;
}
