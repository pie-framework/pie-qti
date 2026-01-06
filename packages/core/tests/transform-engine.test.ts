/**
 * Transform Engine Tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { TransformContext, TransformInput, TransformOutput, TransformPlugin } from '@pie-qti/transform-types';
import { TransformEngine } from '../src/engine/transform-engine';

// Mock plugin for testing
class MockPlugin implements TransformPlugin {
  dispose?: () => Promise<void>;

  readonly id = 'mock-qti22-to-pie';
  readonly version = '1.0.0';
  readonly name = 'Mock QTI 2.2 to PIE Plugin';
  readonly sourceFormat = 'qti22' as const;
  readonly targetFormat = 'pie' as const;

  async canHandle(input: TransformInput): Promise<boolean> {
    if (typeof input.content === 'string') {
      return input.content.includes('assessmentItem');
    }
    return false;
  }

  async transform(_input: TransformInput, context: TransformContext): Promise<TransformOutput> {
    context.logger?.info('Mock transformation', 'test-item');

    return {
      items: [
        {
          id: 'test-item',
          uuid: 'test-uuid',
          config: { id: 'test-uuid', models: [], elements: {} },
          searchMetaData: {},
        },
      ],
      format: 'pie',
      metadata: {
        sourceFormat: 'qti22',
        targetFormat: 'pie',
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: 1,
        processingTime: 0,
      },
    };
  }
}

describe('TransformEngine', () => {
  let engine: TransformEngine;

  beforeEach(() => {
    engine = new TransformEngine();
  });

  test('should register a plugin', () => {
    const plugin = new MockPlugin();
    engine.use(plugin);

    const plugins = engine.getPlugins();
    expect(plugins.length).toBe(1);
    expect(plugins[0].id).toBe('mock-qti22-to-pie');
  });

  test('should get plugin by id', () => {
    const plugin = new MockPlugin();
    engine.use(plugin);

    const found = engine.getPlugin('mock-qti22-to-pie');
    expect(found).toBeDefined();
    expect(found?.id).toBe('mock-qti22-to-pie');
  });

  test('should transform QTI to PIE', async () => {
    const plugin = new MockPlugin();
    engine.use(plugin);

    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="test-item"
                title="Test Item">
  <itemBody>
    <p>Test question</p>
  </itemBody>
</assessmentItem>`;

    const output = await engine.transform(qtiXml, {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
    });

    expect(output).toBeDefined();
    expect(output.items.length).toBe(1);
    expect(output.items[0].id).toBe('test-item');
    expect(output.format).toBe('pie');
    expect(output.metadata.sourceFormat).toBe('qti22');
    expect(output.metadata.targetFormat).toBe('pie');
  });

  test('should auto-detect QTI 2.2 format', async () => {
    const plugin = new MockPlugin();
    engine.use(plugin);

    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <itemBody><p>Test</p></itemBody>
</assessmentItem>`;

    const output = await engine.transform(qtiXml, {
      targetFormat: 'pie',
      // sourceFormat not specified - should auto-detect
    });

    expect(output.metadata.sourceFormat).toBe('qti22');
  });

  test('should throw error when no plugin found', async () => {
    // Don't register any plugins
    const qtiXml = '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"></assessmentItem>';

    await expect(
      engine.transform(qtiXml, {
        sourceFormat: 'qti22',
        targetFormat: 'pie',
      })
    ).rejects.toThrow('No plugin found');
  });

  test('should transform batch of inputs', async () => {
    const plugin = new MockPlugin();
    engine.use(plugin);

    const inputs = [
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">1</assessmentItem>',
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">2</assessmentItem>',
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">3</assessmentItem>',
    ];

    const outputs = await engine.transformBatch(inputs, {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
      parallel: 2,
    });

    expect(outputs.length).toBe(3);
    outputs.forEach((output) => {
      expect(output.items.length).toBe(1);
      expect(output.format).toBe('pie');
    });
  });

  test('should clean up resources on dispose', async () => {
    const plugin = new MockPlugin();
    let disposeCalled = false;

    plugin.dispose = async () => {
      disposeCalled = true;
    };

    engine.use(plugin);
    await engine.dispose();

    expect(disposeCalled).toBe(true);
    expect(engine.getPlugins().length).toBe(0);
  });
});
