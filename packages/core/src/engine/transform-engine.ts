/**
 * Transform Engine
 *
 * Core transformation engine that orchestrates plugins
 */

import type {
  TransformContext,
  TransformFormat,
  TransformInput,
  TransformLogger,
  TransformPlugin,
  WorkflowOrchestrator,
  WorkflowHandle,
  StorageBackend,
} from '@pie-qti/transform-types';
import { PluginRegistry } from '../registry/plugin-registry.js';
import { ConsoleLogger } from '../utils/logger.js';
import type { FormatDetector } from '../registry/format-detector-registry.js';
import { FormatDetectorRegistry } from '../registry/format-detector-registry.js';
import { Qti22Detector } from '../detectors/qti22-detector.js';
import { PieDetector } from '../detectors/pie-detector.js';
import { InMemoryOrchestrator } from '../orchestration/in-memory-orchestrator.js';
import { TransformItemWorkflow, type TransformItemInput, type TransformItemOutput } from '../orchestration/workflows/transform-item-workflow.js';
import { BatchTransformWorkflow, type BatchTransformInput, type BatchTransformOutput } from '../orchestration/workflows/batch-transform-workflow.js';

export interface TransformOptions {
  /** Source format (will be auto-detected if not provided) */
  sourceFormat?: TransformFormat;

  /** Target format */
  targetFormat: TransformFormat;

  /** Vendor-specific options */
  vendor?: string;

  /** Logger instance */
  logger?: TransformLogger;

  /** Additional options */
  [key: string]: any;
}

export class TransformEngine {
  private registry: PluginRegistry;
  private formatDetectorRegistry: FormatDetectorRegistry;
  private defaultLogger: TransformLogger;
  private orchestrator: WorkflowOrchestrator;
  private storage?: StorageBackend;

  constructor(orchestrator?: WorkflowOrchestrator, storage?: StorageBackend) {
    this.registry = new PluginRegistry();
    this.formatDetectorRegistry = new FormatDetectorRegistry();
    this.defaultLogger = new ConsoleLogger();
    this.orchestrator = orchestrator || new InMemoryOrchestrator();
    this.storage = storage;

    // Register built-in format detectors
    this.formatDetectorRegistry.register(new Qti22Detector());
    this.formatDetectorRegistry.register(new PieDetector());
  }

  /**
   * Register a plugin
   */
  use(plugin: TransformPlugin): this {
    this.registry.register(plugin);
    return this;
  }

  /**
   * Register a custom format detector
   */
  registerFormatDetector(detector: FormatDetector): this {
    this.formatDetectorRegistry.register(detector);
    return this;
  }

  /**
   * Transform input to target format
   * Returns a workflow handle for monitoring progress and getting results
   */
  async transform(
    input: string | object,
    options: TransformOptions
  ): Promise<WorkflowHandle<TransformItemOutput>> {
    const logger = options.logger || this.defaultLogger;

    // Prepare input
    const transformInput: TransformInput = {
      content: input,
      format: options.sourceFormat,
    };

    // Detect format if not provided
    const sourceFormat = options.sourceFormat || (await this.detectFormat(transformInput));

    logger.info(`Transforming from ${sourceFormat} to ${options.targetFormat}`);

    // Find appropriate plugin
    const plugin = this.registry.findPlugin(sourceFormat, options.targetFormat);

    if (!plugin) {
      throw new Error(
        `No plugin found for transformation: ${sourceFormat} → ${options.targetFormat}`
      );
    }

    logger.debug(`Using plugin: ${plugin.name} (${plugin.id})`);

    // Initialize plugin if needed
    if (plugin.initialize) {
      logger.debug('Initializing plugin...');
      await plugin.initialize(options);
    }

    // Create context
    const context: TransformContext = {
      logger,
      vendor: options.vendor,
      options,
    };

    // Prepare workflow input
    const workflowInput: TransformItemInput = {
      content: typeof input === 'string' ? input : JSON.stringify(input),
      itemId: 'item-' + Date.now(),
      sourceFormat,
      targetFormat: options.targetFormat,
      plugin,
      context,
      storage: this.storage,
    };

    // Start workflow
    return this.orchestrator.startWorkflow(TransformItemWorkflow, workflowInput);
  }

  /**
   * Transform multiple inputs in batch
   * Returns a workflow handle for monitoring progress and getting results
   */
  async transformBatch(
    inputs: Array<string | object>,
    options: TransformOptions & { parallel?: number }
  ): Promise<WorkflowHandle<BatchTransformOutput>> {
    const logger = options.logger || this.defaultLogger;

    // Detect format if not provided
    const sourceFormat = options.sourceFormat || (await this.detectFormat({
      content: inputs[0],
      format: options.sourceFormat,
    }));

    logger.info(`Batch transforming ${inputs.length} items`);

    // Find appropriate plugin
    const plugin = this.registry.findPlugin(sourceFormat, options.targetFormat);

    if (!plugin) {
      throw new Error(
        `No plugin found for transformation: ${sourceFormat} → ${options.targetFormat}`
      );
    }

    // Initialize plugin if needed
    if (plugin.initialize) {
      logger.debug('Initializing plugin...');
      await plugin.initialize(options);
    }

    // Create context
    const context: TransformContext = {
      logger,
      vendor: options.vendor,
      options,
    };

    if (!this.storage) {
      throw new Error('Storage backend required for batch transformation');
    }

    // Prepare workflow input
    const workflowInput: BatchTransformInput = {
      items: inputs.map((input, index) => ({
        itemId: `item-${Date.now()}-${index}`,
        contentUri: typeof input === 'string' ? input : `memory://item-${index}`,
      })),
      sourceFormat,
      targetFormat: options.targetFormat,
      plugin,
      context,
      storage: this.storage,
      maxConcurrent: options.parallel || 5,
    };

    // Start workflow
    return this.orchestrator.startWorkflow(BatchTransformWorkflow, workflowInput);
  }

  /**
   * Auto-detect input format using registered format detectors
   */
  private async detectFormat(input: TransformInput): Promise<TransformFormat> {
    const detected = await this.formatDetectorRegistry.detectFormat(input.content);

    if (!detected) {
      throw new Error(
        'Could not detect input format. Please specify sourceFormat explicitly.'
      );
    }

    return detected;
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): TransformPlugin[] {
    return this.registry.getAll();
  }

  /**
   * Get plugin by ID
   */
  getPlugin(id: string): TransformPlugin | undefined {
    return this.registry.get(id);
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    const plugins = this.registry.getAll();

    for (const plugin of plugins) {
      if (plugin.dispose) {
        await plugin.dispose();
      }
    }

    this.registry.clear();

    // Shutdown orchestrator
    await this.orchestrator.shutdown();
  }

  /**
   * Get the workflow orchestrator
   */
  getOrchestrator(): WorkflowOrchestrator {
    return this.orchestrator;
  }

  /**
   * Set storage backend
   */
  setStorage(storage: StorageBackend): void {
    this.storage = storage;
  }
}
