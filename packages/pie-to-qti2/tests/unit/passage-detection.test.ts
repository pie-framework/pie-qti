/**
 * Passage Detection Tests
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem } from '@pie-qti/transform-types';
import {
  detectPassages,
  extractPassageIds,
  extractPassageReferencesFromQti,
  needsPassageResolution,
  validatePassageConfiguration,
} from '../../src/utils/passage-detection.js';

describe('Passage Detection', () => {
  test('should detect inline passages from config.models[]', () => {
    const pieItem: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [{ title: 'Test', text: '<p>Content</p>' }],
          },
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Question?',
            choices: [],
          },
        ],
        elements: {},
      },
    };

    const result = detectPassages(pieItem);

    expect(result.hasPassages).toBe(true);
    expect(result.inlinePassages).toHaveLength(1);
    expect(result.inlinePassages[0].id).toBe('passage-1');
    expect(result.externalPassage).toBeUndefined();
    expect(result.recommendedStrategy).toBe('inline');
  });

  test('should detect external passage from passage property (string)', () => {
    const pieItem: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      passage: 'passage-abc',
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Question?',
            choices: [],
          },
        ],
        elements: {},
      },
    };

    const result = detectPassages(pieItem);

    expect(result.hasPassages).toBe(true);
    expect(result.inlinePassages).toHaveLength(0);
    expect(result.externalPassage).toBeDefined();
    expect(result.externalPassage!.id).toBe('passage-abc');
    expect(result.recommendedStrategy).toBe('external');
  });

  test('should detect external passage from passage property (object)', () => {
    const pieItem: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      passage: {
        id: 'passage-def',
        externalId: 'passage-def-ext',
        config: {
          id: 'passage-def',
          models: [
            {
              id: 'p1',
              passages: [{ title: 'Title', text: '<p>Content</p>' }],
            },
          ],
        },
      },
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Question?',
            choices: [],
          },
        ],
        elements: {},
      },
    };

    const result = detectPassages(pieItem);

    expect(result.hasPassages).toBe(true);
    expect(result.externalPassage).toBeDefined();
    expect(result.externalPassage!.id).toBe('passage-def');
    expect(result.externalPassage!.stimulus).toBeDefined();
    expect(result.recommendedStrategy).toBe('external');
  });

  test('should detect no passages', () => {
    const pieItem: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Question?',
            choices: [],
          },
        ],
        elements: {},
      },
    };

    const result = detectPassages(pieItem);

    expect(result.hasPassages).toBe(false);
    expect(result.inlinePassages).toHaveLength(0);
    expect(result.externalPassage).toBeUndefined();
  });

  test('should extract passage IDs', () => {
    const pieItem: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [{ title: 'Test', text: '<p>Content</p>' }],
          },
          {
            id: 'passage-2',
            element: '@pie-element/passage',
            passages: [{ title: 'Test 2', text: '<p>Content 2</p>' }],
          },
        ],
        elements: {},
      },
    };

    const ids = extractPassageIds(pieItem);

    expect(ids).toEqual(['passage-1', 'passage-2']);
  });

  test('should identify items needing passage resolution', () => {
    const itemWithStringRef: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      passage: 'passage-abc',
      config: { id: 'uuid-1', models: [], elements: {} },
    };

    const itemWithObject: PieItem = {
      id: 'item-2',
      uuid: 'uuid-2',
      passage: {
        id: 'passage-def',
        config: { id: 'passage-def', models: [] },
      },
      config: { id: 'uuid-2', models: [], elements: {} },
    };

    const itemWithInline: PieItem = {
      id: 'item-3',
      uuid: 'uuid-3',
      config: {
        id: 'uuid-3',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [{ text: '<p>Content</p>' }],
          },
        ],
        elements: {},
      },
    };

    expect(needsPassageResolution(itemWithStringRef)).toBe(true);
    expect(needsPassageResolution(itemWithObject)).toBe(false); // Has full object
    expect(needsPassageResolution(itemWithInline)).toBe(false); // Inline passages
  });

  test('should validate passage configuration', () => {
    // Valid: inline only
    const validInline: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [{ text: '<p>Content</p>' }],
          },
        ],
        elements: {},
      },
    };

    const result1 = validatePassageConfiguration(validInline);
    expect(result1.valid).toBe(true);
    expect(result1.errors).toHaveLength(0);

    // Valid: external only
    const validExternal: PieItem = {
      id: 'item-2',
      uuid: 'uuid-2',
      passage: 'passage-abc',
      config: { id: 'uuid-2', models: [], elements: {} },
    };

    const result2 = validatePassageConfiguration(validExternal);
    expect(result2.valid).toBe(true);

    // Invalid: both inline and external
    const invalidBoth: PieItem = {
      id: 'item-3',
      uuid: 'uuid-3',
      passage: 'passage-abc',
      config: {
        id: 'uuid-3',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [{ text: '<p>Content</p>' }],
          },
        ],
        elements: {},
      },
    };

    const result3 = validatePassageConfiguration(invalidBoth);
    expect(result3.valid).toBe(false);
    expect(result3.errors.length).toBeGreaterThan(0);
    expect(result3.errors[0]).toContain('both inline passages');

    // Invalid: empty passages array
    const invalidEmpty: PieItem = {
      id: 'item-4',
      uuid: 'uuid-4',
      config: {
        id: 'uuid-4',
        models: [
          {
            id: 'passage-1',
            element: '@pie-element/passage',
            passages: [],
          },
        ],
        elements: {},
      },
    };

    const result4 = validatePassageConfiguration(invalidEmpty);
    expect(result4.valid).toBe(false);
    expect(result4.errors[0]).toContain('no passages array or is empty');
  });

  test('should extract passage references from QTI XML', () => {
    const qtiXml = `<?xml version="1.0"?>
<assessmentItem identifier="item-1">
  <itemBody>
    <object data="passages/passage-abc.xml" type="text/html"></object>
    <choiceInteraction>...</choiceInteraction>
  </itemBody>
</assessmentItem>`;

    const refs = extractPassageReferencesFromQti(qtiXml);

    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBe('passage-abc');
    expect(refs[0].type).toBe('object');
    expect(refs[0].href).toBe('passages/passage-abc.xml');
  });

  test('should extract inline passage references from QTI XML', () => {
    const qtiXml = `<?xml version="1.0"?>
<assessmentItem identifier="item-1">
  <itemBody>
    <div class="stimulus" data-pie-passage-id="passage-inline-1">
      <p>Passage content</p>
    </div>
    <choiceInteraction>...</choiceInteraction>
  </itemBody>
</assessmentItem>`;

    const refs = extractPassageReferencesFromQti(qtiXml);

    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBe('passage-inline-1');
    expect(refs[0].type).toBe('inline');
  });
});
