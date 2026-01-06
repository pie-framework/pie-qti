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
  TransformOutput,
  TransformPlugin,
} from '@pie-framework/transform-types';
import { PluginRegistry } from '../registry/plugin-registry.js';
import { ConsoleLogger } from '../utils/logger.js';

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
  private defaultLogger: TransformLogger;

  constructor() {
    this.registry = new PluginRegistry();
    this.defaultLogger = new ConsoleLogger();
  }

  /**
   * Register a plugin
   */
  use(plugin: TransformPlugin): this {
    this.registry.register(plugin);
    return this;
  }

  /**
   * Transform input to target format
   */
  async transform(
    input: string | object,
    options: TransformOptions
  ): Promise<TransformOutput> {
    const startTime = Date.now();
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

    // Create context
    const context: TransformContext = {
      logger,
      vendor: options.vendor,
      options,
    };

    // Initialize plugin if needed
    if (plugin.initialize) {
      logger.debug('Initializing plugin...');
      await plugin.initialize(options);
    }

    // Transform
    logger.info('Starting transformation...');
    const output = await plugin.transform(transformInput, context);

    // Validate output if plugin supports it
    if (plugin.validate) {
      logger.debug('Validating output...');
      const validation = await plugin.validate(output);
      if (!validation.valid) {
        logger.warn('Validation warnings/errors detected');
        if (validation.errors && validation.errors.length > 0) {
          validation.errors.forEach((error) => logger.error(error));
        }
        if (validation.warnings && validation.warnings.length > 0) {
          validation.warnings.forEach((warning) => logger.warn(warning));
        }
      }
    }

    // Update metadata
    const processingTime = Date.now() - startTime;
    output.metadata = {
      ...output.metadata,
      sourceFormat,
      targetFormat: options.targetFormat,
      pluginId: plugin.id,
      timestamp: new Date(),
      itemCount: output.items.length,
      processingTime,
    };

    logger.info(
      `Transformation complete: ${output.items.length} items in ${processingTime}ms`
    );

    return output;
  }

  /**
   * Transform multiple inputs in batch
   */
  async transformBatch(
    inputs: Array<string | object>,
    options: TransformOptions & { parallel?: number }
  ): Promise<TransformOutput[]> {
    const parallelism = options.parallel || 5;
    const logger = options.logger || this.defaultLogger;

    logger.info(`Batch transforming ${inputs.length} items with parallelism=${parallelism}`);

    const results: TransformOutput[] = [];
    const chunks: Array<Array<string | object>> = [];

    // Split into chunks
    for (let i = 0; i < inputs.length; i += parallelism) {
      chunks.push(inputs.slice(i, i + parallelism));
    }

    // Process chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.debug(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} items)`);

      const chunkResults = await Promise.all(
        chunk.map((input) => this.transform(input, options))
      );

      results.push(...chunkResults);
    }

    logger.info(`Batch transformation complete: ${results.length} outputs`);
    return results;
  }

  /**
   * Transform stream of inputs
   */
  async *transformStream(
    inputs: AsyncIterable<string | object>,
    options: TransformOptions
  ): AsyncGenerator<TransformOutput> {
    const logger = options.logger || this.defaultLogger;

    logger.info('Starting streaming transformation...');

    let count = 0;
    for await (const input of inputs) {
      const output = await this.transform(input, options);
      count++;
      logger.debug(`Streamed ${count} items`);
      yield output;
    }

    logger.info(`Streaming transformation complete: ${count} items`);
  }

  /**
   * Auto-detect input format
   */
  private async detectFormat(input: TransformInput): Promise<TransformFormat> {
    // If content is string, try to detect XML (QTI) vs JSON (PIE)
    if (typeof input.content === 'string') {
      const trimmed = input.content.trim();

      if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
        // It's XML - this repo only supports QTI 2.2.x at transform time.
        if (
          trimmed.includes('imsqti_v2p2') ||
          trimmed.includes('http://www.imsglobal.org/xsd/imsqti_v2p2')
        ) {
          return 'qti22';
        }

        throw new Error(
          'Unsupported QTI namespace. Expected QTI 2.2 (imsqti_v2p2).'
        );
      }

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // It's JSON - assume PIE
        return 'pie';
      }
    }

    // If object, assume PIE
    if (typeof input.content === 'object') {
      return 'pie';
    }

    throw new Error('Could not detect input format');
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
  }
}
