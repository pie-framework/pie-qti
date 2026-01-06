/**
 * Inline Dropdown Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformInlineDropdown } from '../../src/transformers/inline-dropdown.js';
import { createQtiWrapper, createResponseDeclaration } from '../test-utils.js';

describe('transformInlineDropdown', () => {
  test('should transform basic QTI inlineChoiceInteraction to PIE inline-dropdown', () => {
    const qtiXml = createQtiWrapper(`
      ${createResponseDeclaration('RESPONSE_1', 'single', ['Paris'])}
      <itemBody>
        <p>The capital of France is <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
          <inlineChoice identifier="Paris">Paris</inlineChoice>
          <inlineChoice identifier="London">London</inlineChoice>
          <inlineChoice identifier="Berlin">Berlin</inlineChoice>
        </inlineChoiceInteraction>.</p>
      </itemBody>
    `);

    const result = transformInlineDropdown(qtiXml, 'id-001');

    expect(result.id).toBe('id-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/inline-dropdown');
    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('capital of France');
    expect(model.choices['0']).toHaveLength(3);
    expect(model.choices['0'][0]).toEqual({
      value: 'Paris',
      label: 'Paris',
      correct: true,
    });
    expect(model.choices['0'][1]).toEqual({
      value: 'London',
      label: 'London',
      correct: false,
    });
    expect(model.choices['0'][2]).toEqual({
      value: 'Berlin',
      label: 'Berlin',
      correct: false,
    });
    expect(result.metadata?.searchMetaData?.itemType).toBe('ID');
  });

  test('should handle multiple inline choice interactions', () => {
    const qtiXml = createQtiWrapper(`
      ${createResponseDeclaration('RESPONSE_1', 'single', ['H'])}
      ${createResponseDeclaration('RESPONSE_2', 'single', ['O'])}
      <itemBody>
        <p>Water is made of <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
          <inlineChoice identifier="H">hydrogen</inlineChoice>
          <inlineChoice identifier="C">carbon</inlineChoice>
        </inlineChoiceInteraction>
        and <inlineChoiceInteraction responseIdentifier="RESPONSE_2">
          <inlineChoice identifier="O">oxygen</inlineChoice>
          <inlineChoice identifier="N">nitrogen</inlineChoice>
        </inlineChoiceInteraction>.</p>
      </itemBody>
    `);

    const result = transformInlineDropdown(qtiXml, 'id-002');
    const model = result.config.models[0];

    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('{{1}}');
    expect(Object.keys(model.choices)).toHaveLength(2);
    expect(model.choices['0']).toHaveLength(2);
    expect(model.choices['1']).toHaveLength(2);

    // Check correct answers
    const h = model.choices['0'].find((c: any) => c.value === 'H');
    const o = model.choices['1'].find((c: any) => c.value === 'O');
    expect(h?.correct).toBe(true);
    expect(o?.correct).toBe(true);
  });

  test('should handle shuffle attribute (lockChoiceOrder)', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <inlineChoiceInteraction responseIdentifier="RESPONSE_1" shuffle="false">
            <inlineChoice identifier="A">Choice A</inlineChoice>
            <inlineChoice identifier="B">Choice B</inlineChoice>
          </inlineChoiceInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-003');
    const model = result.config.models[0];

    expect(model.lockChoiceOrder).toBe(true); // shuffle=false means locked
  });

  test('should handle shuffle=true (unlocked choice order)', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <inlineChoiceInteraction responseIdentifier="RESPONSE_1" shuffle="true">
            <inlineChoice identifier="A">Choice A</inlineChoice>
            <inlineChoice identifier="B">Choice B</inlineChoice>
          </inlineChoiceInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-004');
    const model = result.config.models[0];

    expect(model.lockChoiceOrder).toBe(false); // shuffle=true means unlocked
  });

  test('should handle audio in prompt', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p><audio src="prompt.mp3" controls></audio></p>
          <p>Fill in the blank: <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="A">Correct</inlineChoice>
            <inlineChoice identifier="B">Wrong</inlineChoice>
          </inlineChoiceInteraction>.</p>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-005');
    const model = result.config.models[0];

    expect(model.prompt).toContain('<audio');
    expect(model.prompt).toContain('prompt.mp3');
    expect(model.markup).not.toContain('<audio');
    expect(model.markup).toContain('{{0}}');
  });

  test('should handle audio with link', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p><audio src="prompt.mp3" controls></audio><a href="transcript.pdf">Transcript</a></p>
          <p>Select: <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="A">Correct</inlineChoice>
          </inlineChoiceInteraction>.</p>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-006');
    const model = result.config.models[0];

    expect(model.prompt).toContain('<audio');
    expect(model.prompt).toContain('<a href="transcript.pdf">');
    expect(model.markup).not.toContain('<audio');
  });

  test('should handle feedbackInline as rationale', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Select: <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="A">Correct</inlineChoice>
            <inlineChoice identifier="B">Wrong</inlineChoice>
          </inlineChoiceInteraction>.</p>
          <feedbackInline>The correct answer is A because...</feedbackInline>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-007');
    const model = result.config.models[0];

    expect(model.rationale).toContain('The correct answer is A');
    expect(model.markup).not.toContain('feedbackInline');
  });

  test('should throw error if no itemBody found', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
      </assessmentItem>
    `;

    expect(() => transformInlineDropdown(qtiXml, 'id-008')).toThrow(
      /Missing required element: itemBody/
    );
  });

  test('should throw error if no inlineChoiceInteraction found', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>
      </assessmentItem>
    `;

    expect(() => transformInlineDropdown(qtiXml, 'id-009')).toThrow(
      /Missing required interaction: inlineChoiceInteraction/
    );
  });

  test('should support partial scoring option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="A">Correct</inlineChoice>
          </inlineChoiceInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-010', {
      partialScoring: true,
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
  });

  test('should support custom lockChoiceOrder option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="A">Correct</inlineChoice>
          </inlineChoiceInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-011', {
      lockChoiceOrder: true,
    });

    const model = result.config.models[0];
    expect(model.lockChoiceOrder).toBe(true);
  });

  test('should support custom rationale option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="A">Correct</inlineChoice>
          </inlineChoiceInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const customRationale = 'This is a custom rationale.';
    const result = transformInlineDropdown(qtiXml, 'id-012', {
      rationale: customRationale,
    });

    const model = result.config.models[0];
    expect(model.rationale).toBe(customRationale);
  });

  test('should handle missing correctResponse gracefully', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
        </responseDeclaration>
        <itemBody>
          <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="A">Choice A</inlineChoice>
            <inlineChoice identifier="B">Choice B</inlineChoice>
          </inlineChoiceInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-013');
    const model = result.config.models[0];

    // All choices should be marked as incorrect when no correct response
    expect(model.choices['0'].every((c: any) => !c.correct)).toBe(true);
  });

  test('should handle complex markup with multiple sentences', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>verb1</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_2" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>noun1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>The student <inlineChoiceInteraction responseIdentifier="RESPONSE_1">
            <inlineChoice identifier="verb1">walked</inlineChoice>
            <inlineChoice identifier="verb2">runs</inlineChoice>
          </inlineChoiceInteraction> to the <inlineChoiceInteraction responseIdentifier="RESPONSE_2">
            <inlineChoice identifier="noun1">library</inlineChoice>
            <inlineChoice identifier="noun2">store</inlineChoice>
          </inlineChoiceInteraction>.</p>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformInlineDropdown(qtiXml, 'id-014');
    const model = result.config.models[0];

    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('{{1}}');
    expect(model.markup).toContain('The student');
    expect(model.markup).toContain('to the');

    const walked = model.choices['0'].find((c: any) => c.value === 'verb1');
    const library = model.choices['1'].find((c: any) => c.value === 'noun1');
    expect(walked?.correct).toBe(true);
    expect(library?.correct).toBe(true);
  });
});
