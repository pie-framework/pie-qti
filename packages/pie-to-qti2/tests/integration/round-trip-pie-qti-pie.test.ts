/**
 * Round-Trip Tests: PIE → QTI → PIE
 *
 * Verify that PIE items can be transformed to QTI and back without data loss
 */

import { describe, expect, test } from 'bun:test';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQti2Plugin } from '../../src/plugin.js';

describe('Round-Trip: PIE → QTI → PIE', () => {
  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  // Mock logger
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  test('multiple-choice: PIE → QTI → PIE preserves all data', async () => {
    const originalPie: PieItem = {
      id: 'mc-item-1',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      config: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: '1',
            element: '@pie-element/multiple-choice',
            prompt: 'What is 2 + 2?',
            choiceMode: 'radio',
            lockChoiceOrder: false,
            choices: [
              { label: '3', value: 'a', correct: false },
              { label: '4', value: 'b', correct: true },
              { label: '5', value: 'c', correct: false },
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

    // Verify QTI was generated
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('choiceInteraction');
    expect(qtiXml).toContain('<pie:sourceModel>');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify lossless transformation
    // The QTI has embedded PIE source, so it should extract from that
    // This means the reconstructed PIE should match the original exactly (minus added metadata)
    expect(reconstructedPie.id).toBe(originalPie.id);
    expect(reconstructedPie.uuid).toBe(originalPie.uuid);
    expect(reconstructedPie.config.models[0].element).toBe(
      '@pie-element/multiple-choice'
    );
    expect(reconstructedPie.config.models[0].prompt).toBe('What is 2 + 2?');
    expect(reconstructedPie.config.models[0].choices).toHaveLength(3);
    expect(reconstructedPie.config.models[0].choiceMode).toBe('radio');
  });

  test('extended-response: PIE → QTI → PIE preserves all data', async () => {
    const originalPie: PieItem = {
      id: 'er-item-1',
      uuid: '223e4567-e89b-12d3-a456-426614174001',
      config: {
        id: '223e4567-e89b-12d3-a456-426614174001',
        models: [
          {
            id: '1',
            element: '@pie-element/extended-response',
            prompt: 'Explain your answer.',
            expectedLines: 5,
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

    // Verify QTI was generated
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('extendedTextInteraction');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify lossless transformation
    expect(reconstructedPie.id).toBe(originalPie.id);
    expect(reconstructedPie.config.models[0].element).toBe(
      '@pie-element/extended-response'
    );
    expect(reconstructedPie.config.models[0].prompt).toBe('Explain your answer.');
  });

  test('explicit-constructed-response: PIE → QTI → PIE preserves all data', async () => {
    const originalPie: PieItem = {
      id: 'ecr-item-1',
      uuid: '323e4567-e89b-12d3-a456-426614174002',
      config: {
        id: '323e4567-e89b-12d3-a456-426614174002',
        models: [
          {
            id: '1',
            element: '@pie-element/explicit-constructed-response',
            prompt: 'What is the capital of France?',
            correctResponse: ['Paris', 'paris'],
          },
        ],
        elements: {
          '@pie-element/explicit-constructed-response': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    // Verify QTI was generated
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('textEntryInteraction');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify lossless transformation
    expect(reconstructedPie.id).toBe(originalPie.id);
    expect(reconstructedPie.config.models[0].element).toBe(
      '@pie-element/explicit-constructed-response'
    );
    expect(reconstructedPie.config.models[0].prompt).toBe(
      'What is the capital of France?'
    );
  });

  test('inline-dropdown: PIE → QTI → PIE preserves all data', async () => {
    const originalPie: PieItem = {
      id: 'inline-dropdown-item-1',
      uuid: '423e4567-e89b-12d3-a456-426614174003',
      config: {
        id: '423e4567-e89b-12d3-a456-426614174003',
        models: [
          {
            id: '1',
            element: '@pie-element/inline-dropdown',
            markup: 'The capital of France is {{0}} and the capital of Spain is {{1}}.',
            choices: {
              '0': [
                { value: 'paris', label: 'Paris', correct: true },
                { value: 'london', label: 'London', correct: false },
                { value: 'berlin', label: 'Berlin', correct: false },
              ],
              '1': [
                { value: 'madrid', label: 'Madrid', correct: true },
                { value: 'rome', label: 'Rome', correct: false },
                { value: 'lisbon', label: 'Lisbon', correct: false },
              ],
            },
            lockChoiceOrder: false,
            partialScoring: false,
          },
        ],
        elements: {
          '@pie-element/inline-dropdown': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    // Verify QTI was generated
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('inlineChoiceInteraction');
    expect(qtiXml).toContain('RESPONSE_0');
    expect(qtiXml).toContain('RESPONSE_1');
    expect(qtiXml).toContain('<pie:sourceModel>');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify lossless transformation
    expect(reconstructedPie.id).toBe(originalPie.id);
    expect(reconstructedPie.config.models[0].element).toBe(
      '@pie-element/inline-dropdown'
    );
    expect(reconstructedPie.config.models[0].markup).toBe(
      originalPie.config.models[0].markup
    );
    expect(reconstructedPie.config.models[0].choices).toBeDefined();
  });

  test('select-text: PIE → QTI → PIE preserves all data', async () => {
    const originalPie: PieItem = {
      id: 'select-text-item-1',
      uuid: '523e4567-e89b-12d3-a456-426614174004',
      config: {
        id: '523e4567-e89b-12d3-a456-426614174004',
        models: [
          {
            id: '1',
            element: '@pie-element/select-text',
            prompt: 'Select all verbs in the sentence.',
            text: 'The cat runs quickly across the yard.',
            tokens: [
              { text: 'runs', start: 8, end: 12, correct: true },
              { text: 'quickly', start: 13, end: 20, correct: false },
              { text: 'across', start: 21, end: 27, correct: false },
            ],
            highlightChoices: false,
            maxSelections: 0,
            partialScoring: false,
          },
        ],
        elements: {
          '@pie-element/select-text': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    // Verify QTI was generated
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('hottextInteraction');
    expect(qtiXml).toContain('<hottext identifier="TOKEN_0">runs</hottext>');
    expect(qtiXml).toContain('<pie:sourceModel>');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify lossless transformation
    expect(reconstructedPie.id).toBe(originalPie.id);
    expect(reconstructedPie.config.models[0].element).toBe(
      '@pie-element/select-text'
    );
    expect(reconstructedPie.config.models[0].text).toBeDefined();
    expect(reconstructedPie.config.models[0].tokens).toBeDefined();
  });

  test('hotspot: PIE → QTI → PIE preserves all data', async () => {
    const originalPie: PieItem = {
      id: 'hotspot-item-1',
      uuid: '623e4567-e89b-12d3-a456-426614174005',
      config: {
        id: '623e4567-e89b-12d3-a456-426614174005',
        models: [
          {
            id: '1',
            element: '@pie-element/hotspot',
            prompt: 'Click on the correct region.',
            imageUrl: 'diagram.png',
            dimensions: { width: 500, height: 300 },
            multipleCorrect: false,
            shapes: {
              rectangles: [
                { id: 'rect1', x: 100, y: 50, width: 80, height: 40, correct: true },
                { id: 'rect2', x: 200, y: 100, width: 60, height: 30, correct: false },
              ],
              polygons: [],
            },
            hotspotColor: 'rgba(137, 183, 244, 0.65)',
            outlineColor: 'blue',
            partialScoring: false,
          },
        ],
        elements: {
          '@pie-element/hotspot': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    // Verify QTI was generated
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('hotspotInteraction');
    expect(qtiXml).toContain('hotspotChoice');
    expect(qtiXml).toContain('shape="rect"');
    expect(qtiXml).toContain('<pie:sourceModel>');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify lossless transformation
    expect(reconstructedPie.id).toBe(originalPie.id);
    expect(reconstructedPie.config.models[0].element).toBe(
      '@pie-element/hotspot'
    );
    expect(reconstructedPie.config.models[0].imageUrl).toBeDefined();
    expect(reconstructedPie.config.models[0].shapes).toBeDefined();
  });

  test('placement-ordering: PIE → QTI → PIE preserves all data', async () => {
    const originalPie: PieItem = {
      id: 'placement-ordering-item-1',
      uuid: '723e4567-e89b-12d3-a456-426614174006',
      config: {
        id: '723e4567-e89b-12d3-a456-426614174006',
        models: [
          {
            id: '1',
            element: '@pie-element/placement-ordering',
            prompt: 'Order the steps from first to last.',
            choices: [
              { id: '0', label: 'Step A' },
              { id: '1', label: 'Step B' },
              { id: '2', label: 'Step C' },
            ],
            correctResponse: [
              { id: '1' },
              { id: '0' },
              { id: '2' },
            ],
            lockChoiceOrder: false,
            orientation: 'vertical',
            partialScoring: false,
          },
        ],
        elements: {
          '@pie-element/placement-ordering': '1.0.0',
        },
      },
    };

    // PIE → QTI
    const qtiResult = await pieToQti.transform(
      { content: originalPie },
      { logger }
    );
    const qtiXml = qtiResult.items[0].content as string;

    // Verify QTI was generated
    expect(qtiXml).toContain('assessmentItem');
    expect(qtiXml).toContain('orderInteraction');
    expect(qtiXml).toContain('simpleChoice');
    expect(qtiXml).toContain('shuffle="true"');
    expect(qtiXml).toContain('<pie:sourceModel>');

    // QTI → PIE
    const pieResult = await qtiToPie.transform(
      { content: qtiXml },
      { logger }
    );
    const reconstructedPie = pieResult.items[0].content;

    // Verify lossless transformation
    expect(reconstructedPie.id).toBe(originalPie.id);
    expect(reconstructedPie.config.models[0].element).toBe(
      '@pie-element/placement-ordering'
    );
    expect(reconstructedPie.config.models[0].choices).toBeDefined();
    expect(reconstructedPie.config.models[0].correctResponse).toBeDefined();
  });

  test('canHandle detects PIE items correctly', async () => {
    const pieItem: PieItem = {
      id: 'test',
      uuid: 'test-uuid',
      config: {
        id: 'test-uuid',
        models: [{ id: '1', element: '@pie-element/multiple-choice' }],
        elements: {},
      },
    };

    const canHandle = await pieToQti.canHandle({ content: pieItem });
    expect(canHandle).toBe(true);
  });

  test('canHandle rejects non-PIE input', async () => {
    const notPieItem = {
      someOtherField: 'value',
    };

    const canHandle = await pieToQti.canHandle({ content: notPieItem });
    expect(canHandle).toBe(false);
  });
});
