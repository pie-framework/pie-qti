import type {
  TransformContext,
  TransformFormat,
  TransformInput,
  TransformPlugin,
} from '@pie-qti/transform-types';
import type { ServerLogger } from '@pie-qti/logger/server';
import type { PluginRegistry } from '../registry/plugin-registry.js';
import type { FormatDetectorRegistry } from '../registry/format-detector-registry.js';

export interface TransformOptions {
  /** Source format (will be auto-detected if not provided) */
  sourceFormat?: TransformFormat;

  /** Target format */
  targetFormat: TransformFormat;

  /** Vendor-specific options */
  vendor?: string;

  /** Logger instance */
  logger?: ServerLogger;

  /** Additional options */
  [key: string]: any;
}

export interface TransformPreludeInput {
  input: string | object;
  options: TransformOptions;
  registry: PluginRegistry;
  formatDetectorRegistry: FormatDetectorRegistry;
  defaultLogger: ServerLogger;
}

export interface TransformPrelude {
  logger: ServerLogger;
  sourceFormat: TransformFormat;
  targetFormat: TransformFormat;
  plugin: TransformPlugin;
  context: TransformContext;
}

export async function detectTransformFormat(
  formatDetectorRegistry: FormatDetectorRegistry,
  input: TransformInput
): Promise<TransformFormat> {
  const detected = await formatDetectorRegistry.detectFormat(input.content);

  if (!detected) {
    throw new Error(
      'Could not detect input format. Please specify sourceFormat explicitly.'
    );
  }

  return detected;
}

export async function prepareTransformPrelude({
  input,
  options,
  registry,
  formatDetectorRegistry,
  defaultLogger,
}: TransformPreludeInput): Promise<TransformPrelude> {
  const logger = options.logger || defaultLogger;
  const transformInput: TransformInput = {
    content: input,
    format: options.sourceFormat,
  };

  const sourceFormat =
    options.sourceFormat || (await detectTransformFormat(formatDetectorRegistry, transformInput));
  const plugin = registry.findPlugin(sourceFormat, options.targetFormat);

  if (!plugin) {
    throw new Error(
      `No plugin found for transformation: ${sourceFormat} → ${options.targetFormat}`
    );
  }

  logger.debug(`Using plugin: ${plugin.name} (${plugin.id})`);

  if (plugin.initialize) {
    logger.debug('Initializing plugin...');
    await plugin.initialize(options);
  }

  return {
    logger,
    sourceFormat,
    targetFormat: options.targetFormat,
    plugin,
    context: {
      logger,
      vendor: options.vendor,
      options,
    },
  };
}
