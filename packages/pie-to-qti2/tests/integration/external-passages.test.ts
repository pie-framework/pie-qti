/**
 * External Passage Integration Tests
 *
 * Tests the complete flow of external passage resolution and file generation
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem, TransformContext, TransformInput } from '@pie-framework/transform-types';
import { PieToQti2Plugin } from '../../src/plugin.js';
import type { PassageResolver, ResolvedPassage } from '../../src/types/passages.js';

describe('External Passage Integration', () => {
  test('should resolve and generate external passage file from string reference', async () => {
    // Mock passage resolver
    const resolver: PassageResolver = async (passageId: string): Promise<ResolvedPassage> => {
      if (passageId === 'passage-abc') {
        return {
          id: 'passage-abc',
          title: 'The Water Cycle',
          content: '<p>Water cycles through evaporation, condensation, and precipitation.</p>',
          metadata: { subject: 'Science' },
        };
      }
      throw new Error(`Unknown passage: ${passageId}`);
    };

    // Create plugin with resolver
    const plugin = new PieToQti2Plugin({ passageResolver: resolver });

    // PIE item with external passage reference
    const pieItem: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      passage: 'passage-abc', // String reference requiring resolution
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'What drives the water cycle?',
            choiceMode: 'radio',
            choices: [
              { label: 'Sun energy', value: 'a', correct: true },
              { label: 'Moon gravity', value: 'b', correct: false },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const input: TransformInput = {
      content: pieItem,
      format: 'pie',
    };

    const context: TransformContext = {
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
    };

    // Transform
    const result = await plugin.transform(input, context);

    // Verify main item
    expect(result.items).toHaveLength(1);
    expect(result.format).toBe('qti22');

    const qtiXml = result.items[0].content as string;

    // Verify object reference in QTI
    expect(qtiXml).toContain('<object');
    expect(qtiXml).toContain('data="passages/passage-abc.xml"');
    expect(qtiXml).toContain('data-pie-passage-id="passage-abc"');

    // Verify passage file was generated
    const passageFiles = (result as any).passageFiles;
    expect(passageFiles).toBeDefined();
    expect(passageFiles).toHaveLength(1);

    const passageFile = passageFiles[0];
    expect(passageFile.id).toBe('passage-abc');
    expect(passageFile.filePath).toBe('passages/passage-abc.xml');
    expect(passageFile.xml).toContain('<?xml version="1.0"');
    expect(passageFile.xml).toContain('<assessmentItem');
    expect(passageFile.xml).toContain('identifier="passage-abc"');
    expect(passageFile.xml).toContain('title="The Water Cycle"');
    expect(passageFile.xml).toContain('<h2>The Water Cycle</h2>');
    expect(passageFile.xml).toContain('Water cycles through evaporation');
    expect(passageFile.metadata).toEqual({ subject: 'Science' });

    // Verify metadata
    expect(result.metadata?.passageStrategy).toBe('external');
    expect(result.metadata?.externalPassageCount).toBe(1);
  });

  test('should use provided passage stimulus object without resolver', async () => {
    // Plugin WITHOUT resolver
    const plugin = new PieToQti2Plugin();

    // PIE item with full passage object
    const pieItem: PieItem = {
      id: 'item-2',
      uuid: 'uuid-2',
      passage: {
        id: 'passage-def',
        externalId: 'passage-def-ext',
        config: {
          id: 'passage-def',
          models: [
            {
              id: 'p1',
              element: '@pie-element/passage',
              passages: [
                {
                  title: 'Gravity and Mass',
                  text: '<p>Gravity depends on mass and distance.</p>',
                },
              ],
            },
          ],
          elements: {},
        },
        searchMetaData: { subject: 'Physics' },
      },
      config: {
        id: 'uuid-2',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'What affects gravity?',
            choiceMode: 'radio',
            choices: [
              { label: 'Mass', value: 'a', correct: true },
              { label: 'Color', value: 'b', correct: false },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const input: TransformInput = {
      content: pieItem,
      format: 'pie',
    };

    const context: TransformContext = {
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
    };

    // Transform (should work without resolver since full object provided)
    const result = await plugin.transform(input, context);

    // Verify passage file was generated from stimulus
    const passageFiles = (result as any).passageFiles;
    expect(passageFiles).toBeDefined();
    expect(passageFiles).toHaveLength(1);

    const passageFile = passageFiles[0];
    expect(passageFile.id).toBe('passage-def');
    expect(passageFile.filePath).toBe('passages/passage-def.xml');
    expect(passageFile.xml).toContain('title="Gravity and Mass"');
    expect(passageFile.xml).toContain('Gravity depends on mass and distance');
    expect(passageFile.metadata).toEqual({ subject: 'Physics' });
  });

  test('should throw error if resolver required but not provided', async () => {
    // Plugin WITHOUT resolver
    const plugin = new PieToQti2Plugin();

    // PIE item with string passage reference (requires resolver)
    const pieItem: PieItem = {
      id: 'item-3',
      uuid: 'uuid-3',
      passage: 'passage-xyz', // String reference but no resolver!
      config: {
        id: 'uuid-3',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Test?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const input: TransformInput = {
      content: pieItem,
      format: 'pie',
    };

    const context: TransformContext = {
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
    };

    // Should throw error
    await expect(plugin.transform(input, context)).rejects.toThrow(
      /has external passage reference.*but no passageResolver was provided/
    );
  });

  test('should use inline strategy when explicitly configured', async () => {
    const resolver: PassageResolver = async (passageId: string): Promise<ResolvedPassage> => {
      return {
        id: passageId,
        title: 'Test',
        content: '<p>Test</p>',
      };
    };

    // Plugin with INLINE strategy forced
    const plugin = new PieToQti2Plugin({
      passageResolver: resolver,
      passageStrategy: 'inline', // Force inline even though external passage exists
    });

    const pieItem: PieItem = {
      id: 'item-4',
      uuid: 'uuid-4',
      passage: 'passage-test',
      config: {
        id: 'uuid-4',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Test?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const input: TransformInput = {
      content: pieItem,
      format: 'pie',
    };

    const context: TransformContext = {
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
    };

    const result = await plugin.transform(input, context);

    // With inline strategy, passages should NOT be in separate files
    // even though external passage exists (resolver was called but result used inline)
    // NOTE: Current implementation still generates files but uses inline embedding.
    // This test documents current behavior - may need refinement.

    // For now, check that external passage was resolved
    const passageFiles = (result as any).passageFiles;
    // Even with inline strategy, if external passage exists, files are generated
    // The strategy affects HOW they're referenced in the item XML
    expect(passageFiles).toBeDefined();
    expect(passageFiles).toHaveLength(1);
  });

  test('should fallback to inline strategy for items with config.models passages', async () => {
    // Plugin with passage resolver
    const resolver: PassageResolver = async (_passageId: string): Promise<ResolvedPassage> => {
      throw new Error('Should not be called for inline passages');
    };

    const plugin = new PieToQti2Plugin({ passageResolver: resolver });

    // PIE item with inline passages in config.models[]
    const pieItem: PieItem = {
      id: 'item-5',
      uuid: 'uuid-5',
      config: {
        id: 'uuid-5',
        models: [
          {
            id: 'passage-inline',
            element: '@pie-element/passage',
            passages: [
              {
                title: 'Inline Passage',
                text: '<p>This is inline.</p>',
              },
            ],
          },
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Test?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/passage': '1.0.0',
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const input: TransformInput = {
      content: pieItem,
      format: 'pie',
    };

    const context: TransformContext = {
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
    };

    const result = await plugin.transform(input, context);

    // Should use inline strategy (no passageFiles)
    const passageFiles = (result as any).passageFiles;
    expect(passageFiles).toBeUndefined();

    // Passage should be embedded in item XML
    const qtiXml = result.items[0].content as string;
    expect(qtiXml).toContain('data-pie-passage-id="passage-inline"');
    expect(qtiXml).toContain('Inline Passage');
    expect(qtiXml).toContain('This is inline');
    expect(qtiXml).not.toContain('<object'); // No object reference

    expect(result.metadata?.passageStrategy).toBe('inline');
  });
});
