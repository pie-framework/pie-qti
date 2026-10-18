/**
 * Transform Engine Tests
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { TransformInput } from '@pie-qti/transform-types';
import { MockStorageBackend, MockTransformPlugin } from '@pie-qti/test-utils';
import { TransformEngine } from '../src/engine/transform-engine';

function createMockPlugin(): MockTransformPlugin {
	return new MockTransformPlugin('mock-qti22-to-pie', 'qti22', 'pie', {
		name: 'Mock QTI 2.2 to PIE Plugin',
		canHandle: async (input: TransformInput) =>
			typeof input.content === 'string' && input.content.includes('assessmentItem'),
		mockItems: [
			{
				id: 'test-item',
				uuid: 'test-uuid',
				config: { id: 'test-uuid', models: [], elements: {} },
				searchMetaData: {},
			},
		],
	});
}

describe('TransformEngine', () => {
  let engine: TransformEngine;

  beforeEach(() => {
    engine = new TransformEngine();
  });

  test('should register a plugin', () => {
    engine.use(createMockPlugin());

    const plugins = engine.getPlugins();
    expect(plugins.length).toBe(1);
    expect(plugins[0].id).toBe('mock-qti22-to-pie');
  });

  test('should get plugin by id', () => {
    engine.use(createMockPlugin());

    const found = engine.getPlugin('mock-qti22-to-pie');
    expect(found).toBeDefined();
    expect(found?.id).toBe('mock-qti22-to-pie');
  });

  test('should transform QTI to PIE', async () => {
    engine.use(createMockPlugin());

    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="test-item"
                title="Test Item">
  <itemBody>
    <p>Test question</p>
  </itemBody>
</assessmentItem>`;

    const handle = await engine.transform(qtiXml, {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
    });
    const output = await handle.result();

    expect(output).toBeDefined();
    expect(output.pieConfig).toBeDefined();
    expect(output.metadata.sourceFormat).toBe('qti22');
    expect(output.metadata.targetFormat).toBe('pie');
  });

  test('should auto-detect QTI 2.2 format', async () => {
    engine.use(createMockPlugin());

    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <itemBody><p>Test</p></itemBody>
</assessmentItem>`;

    const handle = await engine.transform(qtiXml, {
      targetFormat: 'pie',
      // sourceFormat not specified - should auto-detect
    });
    const output = await handle.result();

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
    engine.use(createMockPlugin());
    engine.setStorage(new MockStorageBackend());

    const inputs = [
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">1</assessmentItem>',
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">2</assessmentItem>',
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">3</assessmentItem>',
    ];

    const handle = await engine.transformBatch(inputs, {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
      parallel: 2,
    });
    const result = await handle.result();

    expect(result.successful.length).toBe(3);
    result.successful.forEach((item) => {
      expect(item.result.pieConfig).toBeDefined();
    });
  });

  test('should clean up resources on dispose', async () => {
    const plugin = createMockPlugin();
    let disposeCalled = false;

    (plugin as unknown as { dispose?: () => Promise<void> }).dispose = async () => {
      disposeCalled = true;
    };

    engine.use(plugin);
    await engine.dispose();

    expect(disposeCalled).toBe(true);
    expect(engine.getPlugins().length).toBe(0);
  });
});
