/**
 * QTI Structure Verification
 *
 * Inspect generated QTI XML to verify compliance with QTI 2.2.2 spec
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQtiPlugin } from '../../src/plugin.js';
import { expectSidecarIsolation } from '../helpers/sidecar.js';

describe('QTI 2.2.2 Structure Verification', () => {
  const pieToQti = new PieToQtiPlugin();

  const logger = {
    debug: () => {},
    info: console.log,
    warn: console.warn,
    error: console.error,
  };

  test('should generate valid QTI with metadata and stimulus', async () => {
    const pieItem: PieItem = {
      id: 'inspect-item',
      uuid: '111e4567-e89b-12d3-a456-426614174000',
      searchMetaData: {
        subject: 'Science',
        gradeLevel: ['8', '9'],
        DOK: 'DOK3',
        difficulty: 0.72,
      },
      config: {
        id: '111e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [
              {
                title: 'Photosynthesis',
                text: '<p>Plants convert sunlight into energy through photosynthesis.</p>',
              },
            ],
          },
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'What do plants produce during photosynthesis?',
            choiceMode: 'radio',
            choices: [
              { label: 'Oxygen', value: 'a', correct: true },
              { label: 'Carbon Dioxide', value: 'b', correct: false },
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

    console.log('\n=== GENERATED QTI XML ===\n');
    console.log(qtiXml);
    console.log('\n=== END QTI XML ===\n');

    // Verify structure
    expect(qtiXml).toContain('assessmentItem');
    expectSidecarIsolation(qtiXml, result, pieItem);
    expect(qtiXml).toContain('<div class="stimulus"');
    expect(qtiXml).toContain('choiceInteraction');

    expectSidecarIsolation(qtiXml, result, pieItem);
  });
});
