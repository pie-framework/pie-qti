/**
 * Transform Plugin Type Definitions
 *
 * Core interfaces for the plugin architecture
 */

/**
 * Transform format identifier
 * Extensible string type allows arbitrary format pairs to be registered
 */
export type TransformFormat = string;

/**
 * Well-known format constants
 * Use these for built-in formats to avoid typos
 */
export const KNOWN_FORMATS = {
	QTI22: 'qti22',
	PIE: 'pie',
	LEARNOSITY: 'learnosity',
	CANVAS: 'canvas',
	BRIGHTSPACE: 'brightspace',
} as const;

/**
 * Type for known format values
 */
export type KnownFormat = (typeof KNOWN_FORMATS)[keyof typeof KNOWN_FORMATS];

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
  logger?: TransformLogger;

  /** Vendor-specific options */
  vendor?: string;

  /** Additional options */
  options?: Record<string, any>;
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
 * Transform error
 */
export interface TransformError {
  itemId?: string;
  message: string;
  code?: string;
  fatal: boolean;
}

/**
 * Logger interface
 */
export interface TransformLogger {
  debug(message: string, itemId?: string): void;
  info(message: string, itemId?: string): void;
  warn(message: string, itemId?: string): void;
  error(message: string, itemId?: string): void;
}
