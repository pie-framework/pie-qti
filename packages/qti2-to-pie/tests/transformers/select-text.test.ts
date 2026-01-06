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
