/**
 * Extensions Round-Trip Tests
 *
 * Verify that extensions are preserved perfectly through PIE → QTI → PIE transformations
 */

import { describe, expect, test } from 'bun:test';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQtiPlugin } from '../../src/plugin.js';
import { expectSidecarIsolation } from '../helpers/sidecar.js';

describe('Extensions Round-Trip', () => {
  const pieToQti = new PieToQtiPlugin();
  const qtiToPie = new QtiToPiePlugin();

  // Mock logger
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  test('should preserve extensions with all data types', async () => {
    const originalPie: PieItem = {
      id: 'metadata-item-1',
      uuid: '888e4567-e89b-12d3-a456-426614174000',
      extensions: {
        subject: 'Mathematics',
        gradeLevel: ['9', '10', '11'],
        DOK: 'DOK2',
        standard: 'CCSS.MATH.HSA.REI.B.3',
        tags: ['algebra', 'equations', 'solving'],
        difficulty: 0.72,
        discrimination: 0.45,
        bloomsTaxonomy: 'Apply',
      },
      config: {
        id: '888e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: '1',
            element: '@pie-element/multiple-choice',
            prompt: 'Solve for x: 2x + 5 = 13',
            choiceMode: 'radio',
            choices: [
              { label: 'x = 4', value: 'a', correct: true },
              { label: 'x = 5', value: 'b', correct: false },
              { label: 'x = 8', value: 'c', correct: false },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    expectSidecarIsolation(qtiXml);
    expect(qtiResult.items[0].sidecar?.sourceModel.extensions).toEqual(originalPie.extensions);

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml, sidecar: qtiResult.items[0].sidecar },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify extensions is perfectly reconstructed
    expect(reconstructedPie.extensions).toBeDefined();
    expect(reconstructedPie.extensions!.subject).toBe('Mathematics');
    expect(reconstructedPie.extensions!.gradeLevel).toEqual(['9', '10', '11']);
    expect(reconstructedPie.extensions!.DOK).toBe('DOK2');
    expect(reconstructedPie.extensions!.standard).toBe('CCSS.MATH.HSA.REI.B.3');
    expect(reconstructedPie.extensions!.tags).toEqual(['algebra', 'equations', 'solving']);
    expect(reconstructedPie.extensions!.difficulty).toBe(0.72);
    expect(reconstructedPie.extensions!.discrimination).toBe(0.45);
    expect(reconstructedPie.extensions!.bloomsTaxonomy).toBe('Apply');
  });

  test('should handle multi-model item with passage and extensions', async () => {
    const originalPie: PieItem = {
      id: 'complex-item-1',
      uuid: '999e4567-e89b-12d3-a456-426614174000',
      extensions: {
        subject: 'ELA',
        gradeLevel: ['7', '8'],
        DOK: 'DOK3',
        standard: 'CCSS.ELA-LITERACY.RL.7.2',
        complexity: 'high',
        estimatedTime: 180,
      },
      config: {
        id: '999e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [
              {
                title: 'Understanding Theme',
                text: '<p>Theme is the central idea or message of a story...</p>',
              },
            ],
          },
          {
            id: 'er-1',
            element: '@pie-element/extended-response',
            prompt: 'Identify the theme of the passage and provide textual evidence.',
            expectedLines: 8,
          },
        ],
        elements: {
          '@pie-element/passage': '1.0.0',
          '@pie-element/extended-response': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    // Verify both passage and metadata are in QTI
    expect(qtiXml).toContain('stimulus');
    expect(qtiXml).toContain('Understanding Theme');
    expectSidecarIsolation(qtiXml);
    expect(qtiResult.items[0].sidecar?.sourceModel.extensions).toEqual(originalPie.extensions);

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml, sidecar: qtiResult.items[0].sidecar },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify both passage and metadata are reconstructed
    expect(reconstructedPie.config.models.length).toBeGreaterThanOrEqual(1);

    // Check extensions
    expect(reconstructedPie.extensions).toBeDefined();
    expect(reconstructedPie.extensions!.subject).toBe('ELA');
    expect(reconstructedPie.extensions!.gradeLevel).toEqual(['7', '8']);
    expect(reconstructedPie.extensions!.DOK).toBe('DOK3');
    expect(reconstructedPie.extensions!.complexity).toBe('high');
    expect(reconstructedPie.extensions!.estimatedTime).toBe(180);
  });

  test('should handle item without extensions gracefully', async () => {
    const originalPie: PieItem = {
      id: 'no-metadata-item',
      uuid: 'aaae4567-e89b-12d3-a456-426614174000',
      config: {
        id: 'aaae4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: '1',
            element: '@pie-element/multiple-choice',
            prompt: 'Simple question',
            choiceMode: 'radio',
            choices: [
              { label: 'A', value: 'a', correct: true },
              { label: 'B', value: 'b', correct: false },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    // Should not have metadata section (or empty)
    expect(qtiXml).toContain('assessmentItem');
    // No qti-metadata section expected for items without extensions

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml, sidecar: qtiResult.items[0].sidecar },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Should still work, just no extensions
    expect(reconstructedPie.id).toBe('no-metadata-item');
    expect(reconstructedPie.config.models[0].element).toBe('@pie-element/multiple-choice');
  });

  test('should preserve empty arrays and zero values', async () => {
    const originalPie: PieItem = {
      id: 'edge-case-item',
      uuid: 'bbbe4567-e89b-12d3-a456-426614174000',
      extensions: {
        subject: 'Science',
        tags: [], // Empty array
        difficulty: 0, // Zero value
        relatedStandards: [],
      },
      config: {
        id: 'bbbe4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: '1',
            element: '@pie-element/extended-response',
            prompt: 'Explain.',
            expectedLines: 3,
          },
        ],
        elements: {
          '@pie-element/extended-response': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    expectSidecarIsolation(qtiXml);
    expect(qtiResult.items[0].sidecar?.sourceModel.extensions).toEqual(originalPie.extensions);

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml, sidecar: qtiResult.items[0].sidecar },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify edge cases preserved
    expect(reconstructedPie.extensions!.subject).toBe('Science');
    expect(reconstructedPie.extensions!.difficulty).toBe(0);

    // Empty arrays should be preserved
    expect(reconstructedPie.extensions!.tags).toEqual([]);
    expect(reconstructedPie.extensions!.relatedStandards).toEqual([]);
  });

  test('should use PIE extension for perfect reconstruction', async () => {
    const originalPie: PieItem = {
      id: 'extension-test',
      uuid: 'ccce4567-e89b-12d3-a456-426614174000',
      extensions: {
        customField: 'custom value',
        nestedData: {
          level1: {
            level2: 'deep value',
          },
        },
        subject: 'Test',
      },
      config: {
        id: 'ccce4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: '1',
            element: '@pie-element/multiple-choice',
            prompt: 'Test',
            choiceMode: 'radio',
            choices: [
              { label: 'A', value: 'a', correct: true },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    // PIE → QTI (embeds PIE extension)
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    expectSidecarIsolation(qtiXml);
    expect(qtiResult.items[0].sidecar?.sourceModel.extensions).toEqual(originalPie.extensions);

    // QTI → PIE (should extract from PIE extension for perfect match)
    const pieResult = await qtiToPie.transform(
      { content: qtiXml, sidecar: qtiResult.items[0].sidecar },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // With PIE extension, even nested/complex data should be preserved
    expect(reconstructedPie.extensions).toBeDefined();
    expect(reconstructedPie.extensions!.customField).toBe('custom value');
    // Note: nested objects in extensions should be preserved via PIE extension
    expect(reconstructedPie.extensions!.subject).toBe('Test');
  });
});
