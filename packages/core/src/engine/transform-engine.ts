/**
 * Transform Engine
 *
 * Core transformation engine that orchestrates plugins
 */

import type {
  TransformPlugin,
  WorkflowOrchestrator,
  WorkflowHandle,
  StorageBackend,
} from '@pie-qti/transform-types';
import type { ServerLogger } from '@pie-qti/logger/server';
import { ConsoleLogger } from '@pie-qti/logger/server';
import { PluginRegistry } from '../registry/plugin-registry.js';
import type { FormatDetector } from '../registry/format-detector-registry.js';
import { FormatDetectorRegistry } from '../registry/format-detector-registry.js';
import { QtiDetector } from '../detectors/qti-detector.js';
import { PieDetector } from '../detectors/pie-detector.js';
import { InMemoryOrchestrator } from '../orchestration/in-memory-orchestrator.js';
import { TransformItemWorkflow, type TransformItemInput, type TransformItemOutput } from '../orchestration/workflows/transform-item-workflow.js';
import { BatchTransformWorkflow, type BatchTransformInput, type BatchTransformOutput } from '../orchestration/workflows/batch-transform-workflow.js';
import { prepareTransformPrelude, type TransformOptions } from './transform-prelude.js';

export type { TransformOptions } from './transform-prelude.js';

export class TransformEngine {
  private registry: PluginRegistry;
  private formatDetectorRegistry: FormatDetectorRegistry;
  private defaultLogger: ServerLogger;
  private orchestrator: WorkflowOrchestrator;
  private storage?: StorageBackend;

  constructor(orchestrator?: WorkflowOrchestrator, storage?: StorageBackend) {
    this.registry = new PluginRegistry();
    this.formatDetectorRegistry = new FormatDetectorRegistry();
    this.defaultLogger = new ConsoleLogger();
    this.orchestrator = orchestrator || new InMemoryOrchestrator();
    this.storage = storage;

    // Register built-in format detectors
    this.formatDetectorRegistry.register(new QtiDetector());
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
    const prelude = await prepareTransformPrelude({
      input,
      options,
      registry: this.registry,
      formatDetectorRegistry: this.formatDetectorRegistry,
      defaultLogger: this.defaultLogger,
    });

    prelude.logger.info(`Transforming from ${prelude.sourceFormat} to ${prelude.targetFormat}`);

    // Prepare workflow input
    const workflowInput: TransformItemInput = {
      content: typeof input === 'string' ? input : JSON.stringify(input),
      itemId: 'item-' + Date.now(),
      sourceFormat: prelude.sourceFormat,
      targetFormat: prelude.targetFormat,
      plugin: prelude.plugin,
      context: prelude.context,
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
    const prelude = await prepareTransformPrelude({
      input: inputs[0],
      options,
      registry: this.registry,
      formatDetectorRegistry: this.formatDetectorRegistry,
      defaultLogger: this.defaultLogger,
    });

    prelude.logger.info(`Batch transforming ${inputs.length} items`);

    if (!this.storage) {
      throw new Error('Storage backend required for batch transformation');
    }

    // Prepare workflow input
    const workflowInput: BatchTransformInput = {
      items: inputs.map((input, index) => ({
        itemId: `item-${Date.now()}-${index}`,
        contentUri: typeof input === 'string' ? input : `memory://item-${index}`,
      })),
      sourceFormat: prelude.sourceFormat,
      targetFormat: prelude.targetFormat,
      plugin: prelude.plugin,
      context: prelude.context,
      storage: this.storage,
      maxConcurrent: options.parallel || 5,
    };

    // Start workflow
    return this.orchestrator.startWorkflow(BatchTransformWorkflow, workflowInput);
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
