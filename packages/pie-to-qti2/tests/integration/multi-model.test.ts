/**
 * Multi-Model Tests
 *
 * Verify that PIE items with multiple models (passages, interactions, rubrics)
 * are correctly transformed to QTI 2.2
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQti2Plugin } from '../../src/plugin.js';

describe('Multi-Model Support', () => {
  const pieToQti = new PieToQti2Plugin();

  // Mock logger
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  test('should process item with inline passage + interaction', async () => {
    const pieItem: PieItem = {
      id: 'multi-model-1',
      uuid: '333e4567-e89b-12d3-a456-426614174000',
      config: {
        id: '333e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [
              {
                title: 'The Water Cycle',
                text: '<p>Water moves through the environment in a continuous cycle...</p>',
              },
            ],
          },
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Based on the passage, which process describes water moving from plants to the atmosphere?',
            choiceMode: 'radio',
            choices: [
              { label: 'Precipitation', value: 'a', correct: false },
              { label: 'Transpiration', value: 'b', correct: true },
              { label: 'Condensation', value: 'c', correct: false },
            ],
          },
        ],
        elements: {
          '@pie-element/passage': '1.0.0',
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const result = await pieToQti.transform({ content: pieItem }, { logger });
    const qtiXml = result.items[0].content as string;

    // Verify QTI structure
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('choiceInteraction');

    // Verify inline passage was added
    expect(qtiXml).toContain('stimulus');
    expect(qtiXml).toContain('The Water Cycle');
    expect(qtiXml).toContain('Water moves through the environment');

    // Verify passage comes before interaction
    const stimulusIndex = qtiXml.indexOf('stimulus');
    const interactionIndex = qtiXml.indexOf('choiceInteraction');
    expect(stimulusIndex).toBeLessThan(interactionIndex);

    // Verify metadata reports multiple models
    expect(result.metadata.modelCount).toBe(2);
    expect(result.metadata.hasPassages).toBe(true);
  });

  test('should preserve searchMetaData in QTI', async () => {
    const pieItem: PieItem = {
      id: 'item-with-metadata',
      uuid: '444e4567-e89b-12d3-a456-426614174000',
      searchMetaData: {
        subject: 'Science',
        gradeLevel: ['8', '9'],
        DOK: 'DOK3',
        standard: 'NGSS.MS-PS3-5',
        tags: ['energy', 'transfer', 'systems'],
        difficulty: 0.65,
      },
      config: {
        id: '444e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'What is energy?',
            choiceMode: 'radio',
            choices: [
              { label: 'Force', value: 'a', correct: false },
              { label: 'Ability to do work', value: 'b', correct: true },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const result = await pieToQti.transform({ content: pieItem }, { logger });
    const qtiXml = result.items[0].content as string;

    // Verify qti-metadata section exists
    expect(qtiXml).toContain('<qti-metadata>');
    expect(qtiXml).toContain('</qti-metadata>');

    // Verify individual metadata fields
    expect(qtiXml).toContain('name="subject" value="Science"');
    expect(qtiXml).toContain('name="gradeLevel" value="8,9"');
    expect(qtiXml).toContain('data-type="array"');
    expect(qtiXml).toContain('name="DOK" value="DOK3"');
    expect(qtiXml).toContain('name="difficulty" value="0.65"');
    expect(qtiXml).toContain('data-type="number"');

    // Verify metadata is preserved in PIE extension
    expect(qtiXml).toContain('<pie:sourceModel>');
    expect(qtiXml).toContain('searchMetaData');
  });

  test('should handle multiple interactions - processes only first one (Phase 1)', async () => {
    const pieItem: PieItem = {
      id: 'multi-interaction',
      uuid: '555e4567-e89b-12d3-a456-426614174000',
      config: {
        id: '555e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Question 1',
            choiceMode: 'radio',
            choices: [
              { label: 'A', value: 'a', correct: true },
              { label: 'B', value: 'b', correct: false },
            ],
          },
          {
            id: 'mc-2',
            element: '@pie-element/multiple-choice',
            prompt: 'Question 2',
            choiceMode: 'radio',
            choices: [
              { label: 'C', value: 'c', correct: false },
              { label: 'D', value: 'd', correct: true },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const result = await pieToQti.transform({ content: pieItem }, { logger });
    const qtiXml = result.items[0].content as string;

    // Should process first interaction
    expect(qtiXml).toContain('Question 1');

    // Metadata should indicate multiple interactions detected
    expect(result.metadata.modelCount).toBe(2);

    // Note: Currently Phase 1 only processes the first interaction
    // The generator itself may include both in choices, but plugin logs warning
    // Future Phase 2 will properly handle multiple interactions
    expect(qtiXml).toContain('choiceInteraction');
  });

  test('should handle passage + interaction + searchMetaData together', async () => {
    const pieItem: PieItem = {
      id: 'complete-multi-model',
      uuid: '666e4567-e89b-12d3-a456-426614174000',
      searchMetaData: {
        subject: 'ELA',
        gradeLevel: ['6', '7'],
        standard: 'CCSS.ELA-LITERACY.RL.6.1',
      },
      config: {
        id: '666e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [
              {
                title: 'A Short Story',
                text: '<p>Once upon a time...</p>',
              },
            ],
          },
          {
            id: 'er-1',
            element: '@pie-element/extended-response',
            prompt: 'Summarize the story.',
            expectedLines: 5,
          },
        ],
        elements: {
          '@pie-element/passage': '1.0.0',
          '@pie-element/extended-response': '1.0.0',
        },
      },
    };

    const result = await pieToQti.transform({ content: pieItem }, { logger });
    const qtiXml = result.items[0].content as string;

    // Verify all components present
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('stimulus'); // Passage
    expect(qtiXml).toContain('extendedTextInteraction'); // Interaction
    expect(qtiXml).toContain('<qti-metadata>'); // Metadata

    // Verify order: metadata → passage → interaction
    const metadataIndex = qtiXml.indexOf('<qti-metadata>');
    const stimulusIndex = qtiXml.indexOf('stimulus');
    const interactionIndex = qtiXml.indexOf('extendedTextInteraction');

    expect(metadataIndex).toBeLessThan(stimulusIndex);
    expect(stimulusIndex).toBeLessThan(interactionIndex);

    // Verify all metadata fields
    expect(qtiXml).toContain('name="subject" value="ELA"');
    expect(qtiXml).toContain('name="gradeLevel"');

    // Verify result metadata
    expect(result.metadata.modelCount).toBe(2);
    expect(result.metadata.hasPassages).toBe(true);
  });

  test('should handle item with no passage', async () => {
    const pieItem: PieItem = {
      id: 'no-passage',
      uuid: '777e4567-e89b-12d3-a456-426614174000',
      config: {
        id: '777e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Standalone question',
            choiceMode: 'radio',
            choices: [
              { label: 'Yes', value: 'a', correct: true },
              { label: 'No', value: 'b', correct: false },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const result = await pieToQti.transform({ content: pieItem }, { logger });
    const qtiXml = result.items[0].content as string;

    // Should generate QTI without passage
    expect(qtiXml).toContain('choiceInteraction');
    expect(qtiXml).not.toContain('stimulus');

    // Metadata should reflect no passages
    expect(result.metadata.hasPassages).toBe(false);
    expect(result.metadata.modelCount).toBe(1);
  });
});
