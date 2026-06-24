import { describe, expect, test } from 'bun:test';
import { normalizeQtiSharedContext } from '../src/index.js';

describe('normalizeQtiSharedContext', () => {
  test('splits passage blocks from rubric blocks', () => {
    const context = normalizeQtiSharedContext({
      rubricBlocks: [
        { identifier: 'passage-1', use: 'passage', content: '<p>Passage</p>', view: ['candidate'] },
        { identifier: 'rubric-1', use: 'rubric', content: '<p>Rubric</p>', view: ['candidate'] },
      ],
      role: 'candidate',
    });

    expect(context.passages).toEqual([
      {
        identifier: 'passage-1',
        kind: 'passage',
        scope: 'section',
        view: ['candidate'],
        rawHtml: '<p>Passage</p>',
      },
    ]);
    expect(context.rubricBlocks).toEqual([
      {
        identifier: 'rubric-1',
        kind: 'rubric',
        scope: 'section',
        view: ['candidate'],
        rawHtml: '<p>Rubric</p>',
      },
    ]);
  });

  test('filters scorer-only rubric blocks from candidate context', () => {
    const context = normalizeQtiSharedContext({
      rubricBlocks: [
        { identifier: 'candidate-rubric', content: '<p>Candidate</p>', view: ['candidate'] },
        { identifier: 'scorer-rubric', content: '<p>Scorer</p>', view: ['scorer'] },
      ],
      role: 'candidate',
    });

    expect(context.rubricBlocks.map((block) => block.identifier)).toEqual(['candidate-rubric']);
  });

  test('maps instruction blocks to instruction-kind rubric blocks', () => {
    const context = normalizeQtiSharedContext({
      rubricBlocks: [{ identifier: 'directions', use: 'instructions', content: '<p>Directions</p>', view: ['candidate'] }],
      role: 'candidate',
    });

    expect(context.rubricBlocks).toEqual([
      {
        identifier: 'directions',
        kind: 'instructions',
        scope: 'section',
        view: ['candidate'],
        rawHtml: '<p>Directions</p>',
      },
    ]);
  });

  test('returns empty non-rubric shared context collections', () => {
    const context = normalizeQtiSharedContext({ rubricBlocks: [], role: 'candidate' });

    expect(context.stimuli).toEqual([]);
    expect(context.testFeedback).toEqual([]);
    expect(context.stylesheets).toEqual([]);
    expect(context.catalogSources).toEqual([]);
    expect(context.assetDiagnostics).toEqual([]);
  });
});
