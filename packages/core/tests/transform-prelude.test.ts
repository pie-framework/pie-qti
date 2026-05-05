import { describe, expect, test } from 'bun:test';
import type {
  TransformContext,
  TransformInput,
  TransformOutput,
  TransformPlugin,
} from '@pie-qti/transform-types';
import type { ServerLogger } from '@pie-qti/logger/server';
import { prepareTransformPrelude, detectTransformFormat } from '../src/engine/transform-prelude';
import { FormatDetectorRegistry } from '../src/registry/format-detector-registry';
import { PluginRegistry } from '../src/registry/plugin-registry';

const logger: ServerLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

class PreludePlugin implements TransformPlugin {
  readonly id: string;
  readonly version = '1.0.0';
  readonly name: string;
  readonly sourceFormat: string;
  readonly targetFormat: string;
  initializeCalls = 0;
  initializeOptions: Record<string, unknown> | null = null;

  constructor({
    id,
    sourceFormat,
    targetFormat,
  }: {
    id?: string;
    sourceFormat: string;
    targetFormat: string;
  }) {
    this.id = id ?? `${sourceFormat}-to-${targetFormat}`;
    this.name = this.id;
    this.sourceFormat = sourceFormat;
    this.targetFormat = targetFormat;
  }

  async initialize(options: Record<string, unknown>): Promise<void> {
    this.initializeCalls += 1;
    this.initializeOptions = options;
  }

  async canHandle(_input: TransformInput): Promise<boolean> {
    return true;
  }

  async transform(_input: TransformInput, _context: TransformContext): Promise<TransformOutput> {
    return {
      items: [],
      format: this.targetFormat,
      metadata: {
        sourceFormat: this.sourceFormat,
        targetFormat: this.targetFormat,
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: 0,
        processingTime: 0,
      },
    };
  }
}

describe('transform prelude', () => {
  test('uses explicit sourceFormat without invoking detectors', async () => {
    const registry = new PluginRegistry();
    const formatDetectorRegistry = new FormatDetectorRegistry();
    const plugin = new PreludePlugin({ sourceFormat: 'qti22', targetFormat: 'pie' });
    let detectorCalls = 0;

    registry.register(plugin);
    formatDetectorRegistry.register({
      id: 'unused-detector',
      formatId: 'qti22',
      priority: 100,
      detect() {
        detectorCalls += 1;
        return true;
      },
    });

    const options = {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
      vendor: 'acme',
      custom: true,
    };
    const prelude = await prepareTransformPrelude({
      input: '<assessmentItem/>',
      options,
      registry,
      formatDetectorRegistry,
      defaultLogger: logger,
    });

    expect(detectorCalls).toBe(0);
    expect(prelude.sourceFormat).toBe('qti22');
    expect(prelude.targetFormat).toBe('pie');
    expect(prelude.plugin).toBe(plugin);
    expect(prelude.context.vendor).toBe('acme');
    expect(prelude.context.options).toBe(options);
    expect(plugin.initializeCalls).toBe(1);
    expect(plugin.initializeOptions).toBe(options);
  });

  test('detects source format before resolving the plugin', async () => {
    const registry = new PluginRegistry();
    const formatDetectorRegistry = new FormatDetectorRegistry();
    const plugin = new PreludePlugin({ sourceFormat: 'pie', targetFormat: 'qti22' });

    registry.register(plugin);
    formatDetectorRegistry.register({
      id: 'pie-detector',
      formatId: 'pie',
      priority: 100,
      detect(input) {
        return typeof input === 'object' && 'models' in input;
      },
    });

    const prelude = await prepareTransformPrelude({
      input: { models: [] },
      options: { targetFormat: 'qti22' },
      registry,
      formatDetectorRegistry,
      defaultLogger: logger,
    });

    expect(prelude.sourceFormat).toBe('pie');
    expect(prelude.plugin).toBe(plugin);
    expect(plugin.initializeCalls).toBe(1);
  });

  test('throws the public engine error when no plugin matches the format pair', async () => {
    await expect(
      prepareTransformPrelude({
        input: '<assessmentItem/>',
        options: { sourceFormat: 'qti22', targetFormat: 'pie' },
        registry: new PluginRegistry(),
        formatDetectorRegistry: new FormatDetectorRegistry(),
        defaultLogger: logger,
      })
    ).rejects.toThrow('No plugin found for transformation: qti22 → pie');
  });

  test('throws the public detection error when no detector matches', async () => {
    await expect(
      detectTransformFormat(new FormatDetectorRegistry(), {
        content: '<unknown/>',
      })
    ).rejects.toThrow('Could not detect input format. Please specify sourceFormat explicitly.');
  });
});
