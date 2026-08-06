/**
 * Select Text Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformSelectText } from '../../src/transformers/select-text.js';
import { createQtiWrapper, createResponseDeclaration } from '../test-utils.js';

describe('transformSelectText', () => {
  test('should transform basic QTI hottextInteraction to PIE select-text', () => {
    const qtiXml = createQtiWrapper(`
      ${createResponseDeclaration('RESPONSE', 'multiple', ['choice1'])}
      <itemBody>
        <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <prompt>Select the noun:</prompt>
          The <hottext identifier="choice1">cat</hottext> sat on the <hottext identifier="choice2">mat</hottext>.
        </hottextInteraction>
      </itemBody>
    `);

    const result = transformSelectText(qtiXml, 'st-001');

    expect(result.id).toBe('st-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/select-text');
    expect(model.prompt).toBe('Select the noun:');
    expect(model.maxSelections).toBe(1);
    expect(model.text).toContain('cat');
    expect(model.text).toContain('mat');
    expect(model.tokens).toHaveLength(2);

    // First token (cat) should be correct
    const catToken = model.tokens.find((t: any) => t.text === 'cat');
    expect(catToken).toBeDefined();
    expect(catToken?.correct).toBe(true);

    // Second token (mat) should be incorrect
    const matToken = model.tokens.find((t: any) => t.text === 'mat');
    expect(matToken).toBeDefined();
    expect(matToken?.correct).toBe(false);

    expect(result.metadata?.searchMetaData?.itemType).toBe('ST');
  });

  test('should handle multiple correct answers', () => {
    const qtiXml = createQtiWrapper(`
      ${createResponseDeclaration('RESPONSE', 'multiple', ['adj1', 'adj2'])}
      <itemBody>
        <hottextInteraction responseIdentifier="RESPONSE" maxChoices="2">
          <prompt>Select all adjectives:</prompt>
          The <hottext identifier="adj1">quick</hottext> <hottext identifier="noun1">fox</hottext> jumps over the <hottext identifier="adj2">lazy</hottext> <hottext identifier="noun2">dog</hottext>.
        </hottextInteraction>
      </itemBody>
    `);

    const result = transformSelectText(qtiXml, 'st-002');
    const model = result.config.models[0];

    expect(model.maxSelections).toBe(2);
    expect(model.tokens).toHaveLength(4);

    const correctTokens = model.tokens.filter((t: any) => t.correct);
    expect(correctTokens).toHaveLength(2);
    expect(correctTokens.some((t: any) => t.text === 'quick')).toBe(true);
    expect(correctTokens.some((t: any) => t.text === 'lazy')).toBe(true);
  });

  test('should handle unlimited selections when maxChoices not specified', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
            <value>word2</value>
            <value>word3</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            <prompt>Select all correct words:</prompt>
            <hottext identifier="word1">First</hottext>, <hottext identifier="word2">second</hottext>, and <hottext identifier="word3">third</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-003');
    const model = result.config.models[0];

    // Default maxSelections is 1, but should become 0 (unlimited) when correct answers exceed it
    expect(model.maxSelections).toBe(0);
  });

  test('should handle prompt outside hottextInteraction', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Select the correct word below:</p>
          <hottextInteraction responseIdentifier="RESPONSE">
            This is <hottext identifier="word1">correct</hottext> or <hottext identifier="word2">incorrect</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-004');
    const model = result.config.models[0];

    expect(model.prompt).toContain('Select the correct word below');
  });

  test('should handle missing prompt gracefully', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            Select: <hottext identifier="word1">this</hottext> or <hottext identifier="word2">that</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-005');
    const model = result.config.models[0];

    expect(model.prompt).toBe('');
  });

  test('should handle self-closed hottext tags', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            <hottext identifier="empty"/> Select <hottext identifier="word1">this</hottext> word.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-006');
    const model = result.config.models[0];

    // Should have tokens (self-closed tag removal handled by removeSelfClosedHottextTags)
    expect(model.tokens.length).toBeGreaterThanOrEqual(1);
    const thisToken = model.tokens.find((t: any) => t.text === 'this');
    expect(thisToken).toBeDefined();
    expect(thisToken?.correct).toBe(true);
  });

  test('should handle HTML entities in text', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            Use &lt; and &gt; symbols: <hottext identifier="word1">correct</hottext> &amp; <hottext identifier="word2">wrong</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-007');
    const model = result.config.models[0];

    expect(model.text).toContain('<');
    expect(model.text).toContain('>');
    expect(model.text).toContain('&');
  });

  test('should throw error if no hottextInteraction found', () => {
    const qtiXml = `
      <assessmentItem>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>
      </assessmentItem>
    `;

    expect(() => transformSelectText(qtiXml, 'st-008')).toThrow(
      /Missing required interaction: hottextInteraction/
    );
  });

  test('should support partial scoring option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            Select <hottext identifier="word1">this</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-009', {
      partialScoring: true,
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
  });

  test('should support highlightChoices option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            Select <hottext identifier="word1">this</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-010', {
      highlightChoices: true,
    });

    const model = result.config.models[0];
    expect(model.highlightChoices).toBe(true);
  });

  test('should support custom maxSelections option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            Select <hottext identifier="word1">this</hottext> or <hottext identifier="word2">that</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-011', {
      maxSelections: 2,
    });

    const model = result.config.models[0];
    expect(model.maxSelections).toBe(2);
  });

  test('should handle missing correctResponse gracefully', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            Select <hottext identifier="word1">this</hottext> or <hottext identifier="word2">that</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-012');
    const model = result.config.models[0];

    // All tokens should be marked as incorrect when no correct response
    expect(model.tokens.every((t: any) => !t.correct)).toBe(true);
  });

  test('should handle complex text with multiple sentences', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>verb1</value>
            <value>verb2</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE" maxChoices="2">
            <prompt>Select all verbs in the passage:</prompt>
            The student <hottext identifier="verb1">walked</hottext> to the <hottext identifier="noun1">library</hottext>.
            She <hottext identifier="verb2">studied</hottext> for her <hottext identifier="noun2">exam</hottext>.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-013');
    const model = result.config.models[0];

    expect(model.tokens).toHaveLength(4);
    expect(model.text).toContain('walked');
    expect(model.text).toContain('library');
    expect(model.text).toContain('studied');
    expect(model.text).toContain('exam');

    const walkToken = model.tokens.find((t: any) => t.text === 'walked');
    const studyToken = model.tokens.find((t: any) => t.text === 'studied');
    const libToken = model.tokens.find((t: any) => t.text === 'library');
    const examToken = model.tokens.find((t: any) => t.text === 'exam');

    expect(walkToken?.correct).toBe(true);
    expect(studyToken?.correct).toBe(true);
    expect(libToken?.correct).toBe(false);
    expect(examToken?.correct).toBe(false);
  });

  test('should correctly calculate token start and end positions', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>word1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hottextInteraction responseIdentifier="RESPONSE">
            First <hottext identifier="word1">second</hottext> third <hottext identifier="word2">fourth</hottext> fifth.
          </hottextInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformSelectText(qtiXml, 'st-014');
    const model = result.config.models[0];

    const secondToken = model.tokens.find((t: any) => t.text === 'second');
    const fourthToken = model.tokens.find((t: any) => t.text === 'fourth');

    expect(secondToken).toBeDefined();
    expect(fourthToken).toBeDefined();

    // Verify positions are valid and sensible
    expect(secondToken!.start).toBeGreaterThanOrEqual(0);
    expect(secondToken!.end).toBeGreaterThan(secondToken!.start);
    expect(fourthToken!.start).toBeGreaterThanOrEqual(0);
    expect(fourthToken!.end).toBeGreaterThan(fourthToken!.start);

    // Verify text contains the expected words
    expect(model.text).toContain('second');
    expect(model.text).toContain('fourth');
    expect(model.text).toContain('First');
    expect(model.text).toContain('third');
    expect(model.text).toContain('fifth');

    // Verify correct answer marking
    expect(secondToken!.correct).toBe(true);
    expect(fourthToken!.correct).toBe(false);
  });
});

interface OffsetToken {
  text: string;
  start: number;
  end: number;
  correct?: boolean;
}

/**
 * Build a model from an exact `hottextInteraction` body.
 *
 * The body is interpolated verbatim, with no added indentation, because these tests are
 * about which string the token offsets index — a helper that normalized the passage for us
 * would remove the very thing under test.
 */
function selectTextModel(interactionBody: string, correctValue = 'T2') {
  const qtiXml = createQtiWrapper(
    `${createResponseDeclaration('RESPONSE', 'multiple', [correctValue])}
      <itemBody>
        <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">${interactionBody}</hottextInteraction>
      </itemBody>`,
    'ht-1'
  );

  const model = transformSelectText(qtiXml, 'ht-1').config.models[0];
  return model as unknown as { text: string; tokens: OffsetToken[] };
}

/**
 * PIE's select-text model requires `start`/`end` and its controller scores by comparing them
 * alone (`pie-elements` - `packages/select-text/controller/src/index.js`), so an offset that
 * does not index the emitted `text` is a wrong answer key, not a cosmetic slip. The element's
 * view currently masks bad offsets by re-resolving tokens with a string search — a separate
 * defect in `pie-elements` — so the conversion must not lean on that forgiveness.
 */
describe('transformSelectText token offsets', () => {
  /**
   * The invariant is asserted across every shape rather than a few chosen ones, because the
   * regression this guards was invisible on the obvious example: a `<prompt>` used to get the
   * passage trimmed before offsets were measured, so a prompt-bearing probe passed while
   * prompt-less items were broken. Any shape whose normalization moves the passage has to
   * appear here, not in a comment.
   */
  test.each([
    [
      'no prompt, leading newline + indent',
      '\n      <p>The <hottext identifier="T2">cat</hottext> sat.</p>\n    ',
    ],
    [
      'prompt present',
      '\n      <prompt>Pick one.</prompt>\n      <p>The <hottext identifier="T2">cat</hottext> sat.</p>\n    ',
    ],
    ['no surrounding whitespace at all', '<p>The <hottext identifier="T2">cat</hottext> sat.</p>'],
    [
      'leading text before any markup',
      '\n  Bare text. <hottext identifier="T2">cat</hottext> tail.\n  ',
    ],
    ['token first, at position 0', '<hottext identifier="T2">cat</hottext> sat on the mat.'],
    ['token last, at end of passage', '<p>It sat: <hottext identifier="T2">cat</hottext></p>'],
    [
      'duplicate token text, earlier plain-text twin',
      '\n      <p>The cat is old. The <hottext identifier="T2">cat</hottext> is new.</p>\n    ',
    ],
    [
      'duplicate token text, later plain-text twin',
      '\n      <p>The <hottext identifier="T2">cat</hottext> is new. The cat is old.</p>\n    ',
    ],
    [
      'entity before the token',
      '\n      <p>Salt &amp; pepper, then <hottext identifier="T2">cat</hottext>.</p>\n    ',
    ],
    [
      'nested markup inside the token',
      '\n      <p>A <hottext identifier="T2"><em>cat</em></hottext> sat.</p>\n    ',
    ],
    [
      'self-closed empty hottext before the token',
      '\n      <p><hottext identifier="T0"/>A <hottext identifier="T2">cat</hottext> sat.</p>\n    ',
    ],
    ['single-quoted identifier', "\n      <p>A <hottext identifier='T2'>cat</hottext> sat.</p>\n    "],
    [
      'attribute value containing a bare >',
      '\n      <p>A <hottext identifier="T2" title="a>b">cat</hottext> sat.</p>\n    ',
    ],
    [
      'several tokens, some repeating',
      '\n      <p>A <hottext identifier="T1">red</hottext> hat, a <hottext identifier="T2">red</hottext> ball, a <hottext identifier="T3">blue</hottext> hat.</p>\n    ',
    ],
  ])('offsets index the emitted text: %s', (_label, body) => {
    const { text, tokens } = selectTextModel(body);

    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(text.slice(token.start, token.end)).toBe(token.text);
    }
    // No leftover hottext markup, and offsets stay ordered and non-overlapping.
    expect(text).not.toContain('<hottext');
    expect(text).not.toContain('</hottext>');
    for (const [index, token] of tokens.entries()) {
      if (index > 0) expect(token.start).toBeGreaterThanOrEqual(tokens[index - 1]!.end);
    }
  });

  test('a duplicated token resolves to its own occurrence, not the first', () => {
    const { text, tokens } = selectTextModel(`
      <p>The cat is old. The <hottext identifier="T2">cat</hottext> is new.</p>
    `);

    expect(text).toBe('<p>The cat is old. The cat is new.</p>');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.start).toBe(text.lastIndexOf('cat'));
  });

  test('a hottext with no identifier does not inherit the next tag identifier', () => {
    // Regression: the identifier was read from the whole remaining string, so an
    // identifier-less tag picked up its neighbour's and was marked correct.
    const { tokens } = selectTextModel(
      `<p><hottext>alpha</hottext> and <hottext identifier="T2">beta</hottext></p>`
    );

    expect(tokens.map((token) => [token.text, token.correct])).toEqual([
      ['alpha', false],
      ['beta', true],
    ]);
  });

  test('a single-quoted identifier is still matched', () => {
    // Regression: only `identifier="` was recognised, so a single-quoted tag was never
    // unwrapped — the raw markup stayed in the passage and no token was emitted.
    const { text, tokens } = selectTextModel("<p>A <hottext identifier='T2'>cat</hottext> sat.</p>");

    expect(text).toBe('<p>A cat sat.</p>');
    expect(tokens.map((token) => [token.text, token.correct])).toEqual([['cat', true]]);
  });

  test('an attribute value containing > does not truncate the tag', () => {
    // Regression: the tag was ended at the first `>`, mid-attribute, corrupting the passage
    // with the attribute remainder as literal text.
    const { text, tokens } = selectTextModel(
      '<p>A <hottext identifier="T2" title="a>b">cat</hottext> sat.</p>'
    );

    expect(text).toBe('<p>A cat sat.</p>');
    expect(tokens.map((token) => token.text)).toEqual(['cat']);
  });
});
