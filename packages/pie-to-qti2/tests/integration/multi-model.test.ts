/**
 * Multi-Model Tests
 *
 * Verify that PIE items with multiple models (passages, interactions, rubrics)
 * are correctly transformed to QTI 2.2
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQtiPlugin } from '../../src/plugin.js';
import { expectSidecarIsolation } from '../helpers/sidecar.js';

describe('Multi-Model Support', () => {
  const pieToQti = new PieToQtiPlugin();

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

  test('should preserve extensions in QTI', async () => {
    const pieItem: PieItem = {
      id: 'item-with-metadata',
      uuid: '444e4567-e89b-12d3-a456-426614174000',
      extensions: {
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

    expectSidecarIsolation(qtiXml, result, pieItem);
  });

  test('should handle passage + interaction + extensions together', async () => {
    const pieItem: PieItem = {
      id: 'complete-multi-model',
      uuid: '666e4567-e89b-12d3-a456-426614174000',
      extensions: {
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
    expectSidecarIsolation(qtiXml, result, pieItem);

    // Verify order: passage → interaction
    const stimulusIndex = qtiXml.indexOf('stimulus');
    const interactionIndex = qtiXml.indexOf('extendedTextInteraction');

    expect(stimulusIndex).toBeLessThan(interactionIndex);

    expectSidecarIsolation(qtiXml, result, pieItem);

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
