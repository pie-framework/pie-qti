/**
 * QTI 2.2 to PIE Plugin Tests
 */

import { describe, expect, test } from 'bun:test';
import { TransformEngine } from '@pie-qti/transform-core';
import {
	createQtiWrapper,
	createResponseDeclaration,
	createChoiceInteraction,
	SilentLogger,
	createTestEngine,
	expectSuccessfulTransform,
	expectValidPieModel,
} from '@pie-qti/test-utils';
import { QtiToPiePlugin } from '../src/plugin';

// Create sample QTI using test utilities
const sampleQtiXml = createQtiWrapper(
	`
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
  <itemBody>
    <p>What is 2 + 2?</p>
    ${createChoiceInteraction('RESPONSE', [
			{ id: 'choiceA', text: '4' },
			{ id: 'choiceB', text: '3' },
			{ id: 'choiceC', text: '5' },
			{ id: 'choiceD', text: '22' },
		])}
  </itemBody>
`,
	'choice-001',
	'Sample Multiple Choice',
);

describe('QtiToPiePlugin', () => {
  test('should identify as correct plugin', () => {
    const plugin = new QtiToPiePlugin();

    expect(plugin.id).toBe('qti22-to-pie');
    expect(plugin.sourceFormat).toBe('qti22');
    expect(plugin.targetFormat).toBe('pie');
  });

  test('should detect QTI 2.2 content', async () => {
    const plugin = new QtiToPiePlugin();

    const canHandle = await plugin.canHandle({
      content: sampleQtiXml,
    });

    expect(canHandle).toBe(true);
  });

  test('should reject non-QTI content', async () => {
    const plugin = new QtiToPiePlugin();

    const canHandle = await plugin.canHandle({
      content: '{ "id": "test", "type": "pie" }',
    });

    expect(canHandle).toBe(false);
  });

  test('should transform QTI to PIE', async () => {
    const plugin = new QtiToPiePlugin();

    const output = await plugin.transform(
      { content: sampleQtiXml },
      { logger: new SilentLogger() }
    );

    expectSuccessfulTransform(output, 1);
    expect(output.items[0].content.id).toBe('choice-001');
    expect(output.items[0].content.metadata?.searchMetaData.title).toBe('Sample Multiple Choice');
  });

  test('should work with TransformEngine', async () => {
    const engine = createTestEngine({
      plugins: [new QtiToPiePlugin()],
      logger: new SilentLogger(),
    });

    const handle = await engine.transform(sampleQtiXml, {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
    });
    const output = await handle.result();

    expect(output.pieConfig).toBeDefined();
    expect(output.metadata.sourceFormat).toBe('qti22');
    expect(output.metadata.targetFormat).toBe('pie');
  });

  test('should accept empty constructor options (backward compatible)', () => {
    const plugin = new QtiToPiePlugin();

    expect(plugin.id).toBe('qti22-to-pie');
    expect(plugin.sourceFormat).toBe('qti22');
    expect(plugin.targetFormat).toBe('pie');
  });

  test('should accept constructor options with vendor detectors', () => {
    const mockDetector = {
      name: 'test-detector',
      vendor: 'test-vendor',
      detect: () => ({ vendor: 'test-vendor', confidence: 0.8 }),
    };

    const plugin = new QtiToPiePlugin({
      vendorDetectors: [mockDetector],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with vendor transformers', () => {
    const mockTransformer = {
      name: 'test-transformer',
      vendor: 'test-vendor',
      canHandle: () => false,
      transform: async () => ({ items: [], format: 'pie' }),
    };

    const plugin = new QtiToPiePlugin({
      vendorTransformers: [mockTransformer],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with asset resolvers', () => {
    const mockResolver = {
      resolve: async () => ({ url: 'test.png', content: Buffer.from('') }),
    };

    const plugin = new QtiToPiePlugin({
      assetResolvers: [mockResolver],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with CSS class extractors', () => {
    const mockExtractor = {
      extract: () => ({ vendor: [], behavior: [] }),
    };

    const plugin = new QtiToPiePlugin({
      cssClassExtractors: [mockExtractor],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with metadata extractors', () => {
    const mockExtractor = {
      extract: () => ({}),
    };

    const plugin = new QtiToPiePlugin({
      metadataExtractors: [mockExtractor],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });

  test('should accept constructor options with multiple extension types', () => {
    const mockDetector = {
      name: 'test-detector',
      vendor: 'test-vendor',
      detect: () => ({ vendor: 'test-vendor', confidence: 0.8 }),
    };

    const mockTransformer = {
      name: 'test-transformer',
      vendor: 'test-vendor',
      canHandle: () => false,
      transform: async () => ({ items: [], format: 'pie' }),
    };

    const plugin = new QtiToPiePlugin({
      vendorDetectors: [mockDetector],
      vendorTransformers: [mockTransformer],
    });

    expect(plugin.id).toBe('qti22-to-pie');
  });
});
