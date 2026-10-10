import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import { removeUnmappedFeedback } from '../../src/utils/feedback-removal.js';

const remove = (xml: string, interactionTypes: string[]) =>
  removeUnmappedFeedback(
    xml,
    parse(xml, { lowerCaseTagName: false, comment: false }).getElementsByTagName('assessmentItem')[0]!,
    'item-1',
    new Set(interactionTypes)
  );

describe('removeUnmappedFeedback', () => {
  test('cuts feedback by source offset and leaves the rest of the document unchanged', () => {
    const xml =
      '<assessmentItem><itemBody><p><![CDATA[a < b]]> &amp; x<feedbackInline identifier="A">hint</feedbackInline></p>' +
      '<feedbackBlock identifier="B"><p>Block <feedbackInline identifier="C">nested</feedbackInline></p></feedbackBlock>' +
      '<choiceInteraction responseIdentifier="R"><simpleChoice identifier="A"/></choiceInteraction></itemBody></assessmentItem>';

    const result = remove(xml, ['choiceInteraction']);

    expect(result.xml).toBe(
      '<assessmentItem><itemBody><p><![CDATA[a < b]]> &amp; x</p>' +
        '<choiceInteraction responseIdentifier="R"><simpleChoice identifier="A"/></choiceInteraction></itemBody></assessmentItem>'
    );
    expect(result.warning?.message).toContain('1 feedbackBlock, 2 feedbackInline');
  });

  test('returns the input unchanged when every feedback element is mapped', () => {
    const xml =
      '<assessmentItem><itemBody><p>Pick <inlineChoiceInteraction responseIdentifier="R"/>' +
      '<feedbackInline identifier="A">hint</feedbackInline></p></itemBody></assessmentItem>';

    const result = remove(xml, ['inlineChoiceInteraction']);

    expect(result.xml).toBe(xml);
    expect(result.warning).toBeUndefined();
  });

  test('keeps only the first modalFeedback for drag-in-the-blank', () => {
    const xml =
      '<assessmentItem><itemBody><gapMatchInteraction responseIdentifier="R"/></itemBody>' +
      '<modalFeedback identifier="A">first</modalFeedback><modalFeedback identifier="B">second</modalFeedback></assessmentItem>';

    const result = remove(xml, ['gapMatchInteraction']);

    expect(result.xml).toContain('first');
    expect(result.xml).not.toContain('second');
    expect(result.warning?.message).toContain('1 modalFeedback');
  });
});
