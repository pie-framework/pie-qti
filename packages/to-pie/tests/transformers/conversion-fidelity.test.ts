/**
 * Conversion fidelity conformance tests
 *
 * Locks in the four converter defects that let a QTI item convert into a PIE
 * item that renders but is wrong:
 *
 *  1. the answer key derived from `mapping`/`mapEntry` when `correctResponse` is
 *     absent, in every transformer rather than three of them
 *  2. `partialScoring` and item weight derived from the source
 *  3. choice cardinality that accounts for the discovered answer count
 *  4. `choiceInteraction/@orientation` carried into the PIE choice layout
 *
 * Fixtures live in `tests/fixtures/conversion-fidelity/`. The mapping-only
 * shapes are synthesized on purpose: across 89,836 items in the Region 10 /
 * TEKSbank delivery every mapping-bearing response also declares a
 * `correctResponse`, so no real item exercises the fallback.
 */

import { describe, expect, test } from 'bun:test';
import { transformAssociateToCategorize } from '../../src/transformers/associate-to-categorize.js';
import { transformDragInTheBlank } from '../../src/transformers/drag-in-the-blank.js';
import { transformExplicitConstructedResponse } from '../../src/transformers/explicit-constructed-response.js';
import { transformHotspot } from '../../src/transformers/hotspot.js';
import { transformImageClozeAssociation } from '../../src/transformers/image-cloze-association.js';
import { transformInlineDropdown } from '../../src/transformers/inline-dropdown.js';
import { transformMatch } from '../../src/transformers/match.js';
import { transformMatchList } from '../../src/transformers/match-list.js';
import { transformMultipleChoice } from '../../src/transformers/multiple-choice.js';
import { transformPlacementOrdering } from '../../src/transformers/placement-ordering.js';
import { transformSelectText } from '../../src/transformers/select-text.js';
import { loadFixture, parseQtiItem } from '../test-utils.js';

function fixture(name: string): string {
  return loadFixture(`conversion-fidelity/${name}`);
}

/** Identifiers of the choices a multiple-choice model marks correct. */
function correctChoices(model: { choices: Array<{ value: string; correct?: boolean }> }): string[] {
  return model.choices.filter(choice => choice.correct).map(choice => choice.value);
}

describe('answer key derived from mapping/mapEntry', () => {
  test('choiceInteraction with no correctResponse', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('mapping-only-choice')),
      'cf-001'
    );
    const model = result.config.models[0];

    expect(model.correctResponse).toEqual(['choiceB']);
    expect(correctChoices(model)).toEqual(['choiceB']);
  });

  test('inlineChoiceInteraction with no correctResponse', () => {
    const result = transformInlineDropdown(fixture('mapping-only-inline-choice'), 'cf-002');
    const model = result.config.models[0];

    expect(model.choices['0'].filter((c: { correct: boolean }) => c.correct).map((c: { value: string }) => c.value)).toEqual(['warm']);
    expect(model.choices['1'].filter((c: { correct: boolean }) => c.correct).map((c: { value: string }) => c.value)).toEqual(['rises']);
  });

  test('orderInteraction with no correctResponse uses mapEntry document order', () => {
    const result = transformPlacementOrdering(fixture('mapping-only-order'), 'cf-003');
    const model = result.config.models[0];

    // Choices are in document order pupa, adult, egg, larva -> indices 0..3.
    // The mapping declares egg, larva, pupa, adult, so the correct sequence is
    // 2, 3, 0, 1.
    expect(model.correctResponse.map((entry: { id: string }) => entry.id)).toEqual(['2', '3', '0', '1']);
  });

  test('hottextInteraction with no correctResponse', () => {
    const result = transformSelectText(fixture('mapping-only-hottext'), 'cf-004');
    const model = result.config.models[0];

    expect(model.tokens.filter((t: { correct: boolean }) => t.correct).map((t: { text: string }) => t.text)).toEqual([
      'sat',
      'slept',
    ]);
  });

  test('matchInteraction with no correctResponse', () => {
    const model = transformMatch(fixture('mapping-only-match'), 'cf-005').config.models[0];

    // Rows are dog, salmon; columns are mammal, fish.
    expect(model.rows[0].values).toEqual([true, false]);
    expect(model.rows[1].values).toEqual([false, true]);
  });

  test('matchInteraction with no correctResponse (match-list)', () => {
    const model = transformMatchList(fixture('mapping-only-match'), 'cf-006').config.models[0];

    expect(model.prompts[0].relatedAnswer).toBe(0);
    expect(model.prompts[1].relatedAnswer).toBe(1);
  });

  test('hotspotInteraction with no correctResponse', () => {
    const model = transformHotspot(fixture('mapping-only-hotspot'), 'cf-007').config.models[0];

    const correct = model.shapes.rectangles
      .filter((r: { correct: boolean }) => r.correct)
      .map((r: { id: string }) => r.id);
    expect(correct).toEqual(['hotspot2']);
  });

  test('textEntryInteraction with no correctResponse promotes mapKeys to accepted answers', () => {
    const model = transformExplicitConstructedResponse(
      fixture('mapping-only-text-entry'),
      'cf-008'
    ).config.models[0];

    expect(model.choices['0'].map((c: { label: string }) => c.label)).toEqual(['Paris', 'paris']);
    expect(model.choices['1'].map((c: { label: string }) => c.label)).toEqual(['London']);
  });

  test('gapMatchInteraction with no correctResponse', () => {
    const model = transformDragInTheBlank(fixture('mapping-only-gap-match'), 'cf-009')
      .config.models[0];

    // Gap index -> choice index. cat is choice 0, salmon is choice 1.
    expect(model.correctResponse).toEqual({ '0': '0', '1': '1' });
  });

  test('graphicGapMatchInteraction with no correctResponse', () => {
    const model = transformImageClozeAssociation(
      fixture('mapping-only-graphic-gap-match'),
      'cf-010'
    ).config.models[0];

    expect(model.validation.validResponse.value).toEqual([
      { images: ['<img src="image1.png">'] },
      { images: ['<img src="image2.png">'] },
    ]);
  });

  test('associateInteraction with no correctResponse', () => {
    const model = transformAssociateToCategorize(fixture('mapping-only-associate'), 'cf-011')
      .config.models[0];

    expect(model.correctResponse).toEqual({ apple: ['fruit'], carrot: ['vegetable'] });
  });
});

describe('mapping answer key is filtered by sign', () => {
  test('only strictly positive mappedValues become correct', async () => {
    const model = (
      await transformMultipleChoice(parseQtiItem(fixture('mapping-mixed-signs-choice')), 'cf-020')
    ).config.models[0];

    // choiceB scores 0 and choiceC scores -1: distractors, not answers.
    expect(correctChoices(model)).toEqual(['choiceA', 'choiceD']);
  });

  test('an all-zero mapping does not mark every choice correct', async () => {
    const model = (
      await transformMultipleChoice(
        parseQtiItem(fixture('mapping-all-zero-with-correct-response')),
        'cf-021'
      )
    ).config.models[0];

    // The real key is in correctResponse. Reading the mapping without the sign
    // check would mark all four choices correct.
    expect(correctChoices(model)).toEqual(['choiceB']);
    expect(model.choiceMode).toBe('radio');
  });

  test('an all-zero mapping yields no item weight', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('mapping-all-zero-with-correct-response')),
      'cf-022'
    );

    // upperBound="0" is not a usable weight and nothing scores positively.
    expect(result.metadata?.searchMetaData?.maxScore).toBeUndefined();
    // The mapping is still present, so partial credit was declared.
    expect(result.config.models[0].partialScoring).toBe(true);
  });
});

describe('a declared correctResponse always wins', () => {
  test('mapping does not overwrite a declared key it disagrees with', async () => {
    const model = (
      await transformMultipleChoice(
        parseQtiItem(fixture('mapping-disagrees-with-correct-response')),
        'cf-030'
      )
    ).config.models[0];

    expect(model.correctResponse).toEqual(['choiceB']);
    expect(correctChoices(model)).toEqual(['choiceB']);
  });
});

describe('partialScoring and item weight derived from the source', () => {
  test('no mapping means no partial scoring and no weight', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('orientation-absent')),
      'cf-040'
    );

    expect(result.config.models[0].partialScoring).toBe(false);
    expect(result.metadata?.searchMetaData?.maxScore).toBeUndefined();
  });

  test('a mapping implies partial scoring', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('mapping-only-choice')),
      'cf-041'
    );

    expect(result.config.models[0].partialScoring).toBe(true);
  });

  test('weight comes from mapping/@upperBound first', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('weight-from-upper-bound')),
      'cf-042'
    );

    // upperBound=3 beats MAXSCORE=9 and the summed mapEntry values of 5.
    expect(result.metadata?.searchMetaData?.maxScore).toBe(3);
  });

  test('weight falls back to the MAXSCORE outcome', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('weight-from-max-score-outcome')),
      'cf-043'
    );

    // MAXSCORE=4 beats the summed mapEntry values of 2.
    expect(result.metadata?.searchMetaData?.maxScore).toBe(4);
  });

  test('weight falls back to the summed positive mapEntry values', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('weight-from-summed-map-entries')),
      'cf-044'
    );

    // 0.5 + 1.5; the -1 entry is not subtracted.
    expect(result.metadata?.searchMetaData?.maxScore).toBe(2);
  });

  test('a non-numeric upperBound is rejected rather than parsed to NaN', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('weight-invalid-upper-bound')),
      'cf-045'
    );

    // upperBound="Max:3" is real TEKSbank content. Number() gives NaN.
    expect(result.metadata?.searchMetaData?.maxScore).toBe(2);
    expect(Number.isNaN(result.metadata?.searchMetaData?.maxScore)).toBe(false);
  });

  test('an upperBound with a trailing space still parses', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('weight-upper-bound-trailing-space')),
      'cf-046'
    );

    // upperBound="2 " is real TEKSbank content and is a usable weight.
    expect(result.metadata?.searchMetaData?.maxScore).toBe(2);
  });
});

describe('choice cardinality accounts for the answer count', () => {
  test('two correct answers with maxChoices absent become a checkbox group', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('multi-answer-missing-max-choices')),
      'cf-050'
    );

    expect(result.config.models[0].choiceMode).toBe('checkbox');
    expect(result.metadata?.searchMetaData?.itemType).toBe('MCA');
  });

  test('two correct answers override a contradicting maxChoices="1"', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('multi-answer-max-choices-one')),
      'cf-051'
    );

    expect(result.config.models[0].choiceMode).toBe('checkbox');
    expect(result.metadata?.searchMetaData?.itemType).toBe('MCA');
  });

  test('cardinality is derived after the mapping-based answer key', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('multi-answer-from-mapping-missing-max-choices')),
      'cf-052'
    );
    const model = result.config.models[0];

    expect(correctChoices(model)).toEqual(['choiceA', 'choiceC']);
    expect(model.choiceMode).toBe('checkbox');
  });

  test('a single correct answer with maxChoices absent stays a radio group', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('orientation-absent')),
      'cf-053'
    );

    expect(result.config.models[0].choiceMode).toBe('radio');
    expect(result.metadata?.searchMetaData?.itemType).toBe('MC');
  });
});

describe('choiceInteraction/@orientation carried into the PIE layout', () => {
  test.each([
    ['horizontal', 'horizontal'],
    ['vertical', 'vertical'],
  ])('orientation="%s" passes through as choicesLayout="%s"', async (orientation, expected) => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture(`orientation-${orientation}`)),
      `cf-060-${orientation}`
    );

    expect(result.config.models[0].choicesLayout).toBe(expected);
    expect(result.config.models[0].gridColumns).toBeUndefined();
  });

  test.each(['grid', 'stacked'])('orientation="%s" becomes a two-column grid', async orientation => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture(`orientation-${orientation}`)),
      `cf-061-${orientation}`
    );

    expect(result.config.models[0].choicesLayout).toBe('grid');
    expect(result.config.models[0].gridColumns).toBe(2);
  });

  test('an absent orientation emits no layout, leaving the PIE default', async () => {
    const result = await transformMultipleChoice(
      parseQtiItem(fixture('orientation-absent')),
      'cf-062'
    );

    expect(result.config.models[0].choicesLayout).toBeUndefined();
    expect(result.config.models[0].gridColumns).toBeUndefined();
  });
});

describe('spatial interaction with unknown image dimensions', () => {
  test('a hotspot image with no width/height fails loudly', () => {
    // coords are in source-image pixel space, so a guessed size misplaces every
    // region. Failing is the only honest outcome.
    expect(() => transformHotspot(fixture('hotspot-missing-dimensions'), 'cf-070')).toThrow(
      /Cannot determine image dimensions/
    );
  });
});
