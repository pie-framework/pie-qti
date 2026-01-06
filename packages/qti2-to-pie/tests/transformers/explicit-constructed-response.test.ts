/**
 * Explicit Constructed Response Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformExplicitConstructedResponse } from '../../src/transformers/explicit-constructed-response.js';
import { createQtiWrapper } from '../test-utils.js';

describe('transformExplicitConstructedResponse', () => {
  test('should transform basic QTI textEntryInteraction to PIE explicit-constructed-response', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>Paris</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>The capital of France is <textEntryInteraction responseIdentifier="RESPONSE_1" expectedLength="15" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-001');

    expect(result.id).toBe('ecr-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/explicit-constructed-response');
    expect(model.markup).toBe('<p>The capital of France is {{0}}.</p>');
    expect(model.choices).toEqual({
      '0': [{ label: 'Paris', value: '0' }],
    });
    expect(model.maxLengthPerChoice).toEqual([15]);
    expect(result.metadata?.searchMetaData?.itemType).toBe('ECR');
  });

  test('should handle multiple text entry interactions', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>hydrogen</value>
            <value>H</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_2" cardinality="single" baseType="string">
          <correctResponse>
            <value>oxygen</value>
            <value>O</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Water is made of <textEntryInteraction responseIdentifier="RESPONSE_1" expectedLength="10" />
          and <textEntryInteraction responseIdentifier="RESPONSE_2" expectedLength="10" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-002');
    const model = result.config.models[0];

    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('{{1}}');
    expect(model.choices['0']).toHaveLength(2);
    expect(model.choices['0'][0]).toEqual({ label: 'hydrogen', value: '0' });
    expect(model.choices['0'][1]).toEqual({ label: 'H', value: '1' });
    expect(model.choices['1']).toHaveLength(2);
    expect(model.choices['1'][0]).toEqual({ label: 'oxygen', value: '0' });
    expect(model.choices['1'][1]).toEqual({ label: 'O', value: '1' });
    expect(model.maxLengthPerChoice).toEqual([10, 10]);
  });

  test('should handle audio in prompt', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p><audio src="prompt.mp3" controls></audio></p>
          <p>Fill in the blank: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-003');
    const model = result.config.models[0];

    expect(model.prompt).toContain('<audio');
    expect(model.prompt).toContain('prompt.mp3');
    expect(model.markup).not.toContain('<audio');
    expect(model.markup).toContain('{{0}}');
  });

  test('should handle audio with link', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p><audio src="prompt.mp3" controls></audio><a href="transcript.pdf">Transcript</a></p>
          <p>Fill in the blank: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-004');
    const model = result.config.models[0];

    expect(model.prompt).toContain('<audio');
    expect(model.prompt).toContain('<a href="transcript.pdf">');
    expect(model.markup).not.toContain('<audio');
    expect(model.markup).not.toContain('Transcript');
  });

  test('should handle missing expectedLength', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Fill in: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-005');
    const model = result.config.models[0];

    expect(model.maxLengthPerChoice).toBeUndefined();
  });

  test('should handle partial expectedLength (some but not all)', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>first</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_2" cardinality="single" baseType="string">
          <correctResponse>
            <value>second</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p><textEntryInteraction responseIdentifier="RESPONSE_1" expectedLength="10" />
          and <textEntryInteraction responseIdentifier="RESPONSE_2" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-006');
    const model = result.config.models[0];

    // Should return undefined if not all interactions have expectedLength
    expect(model.maxLengthPerChoice).toBeUndefined();
  });

  test('should handle missing correctResponse gracefully', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
        </responseDeclaration>
        <itemBody>
          <p>Fill in: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-007');
    const model = result.config.models[0];

    expect(model.choices['0']).toEqual([]);
  });

  test('should throw error if no itemBody found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    expect(() => transformExplicitConstructedResponse(qtiXml, 'ecr-008')).toThrow(
      /Missing required element: itemBody/
    );
  });

  test('should throw error if no textEntryInteraction found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    expect(() => transformExplicitConstructedResponse(qtiXml, 'ecr-009')).toThrow(
      /Missing required interaction: textEntryInteraction/
    );
  });

  test('should support partial scoring option', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Fill in: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-010', {
      partialScoring: true,
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
  });

  test('should support custom note option', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Fill in: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const customNote = 'This is a custom note for students.';
    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-011', {
      note: customNote,
    });

    const model = result.config.models[0];
    expect(model.note).toBe(customNote);
  });

  test('should have default note when not specified', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>answer</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Fill in: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-012');
    const model = result.config.models[0];

    expect(model.note).toContain('most common correct answer');
    expect(model.note).toContain('additional correct');
  });

  test('should handle complex markup with multiple paragraphs', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>first</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_2" cardinality="single" baseType="string">
          <correctResponse>
            <value>second</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_3" cardinality="single" baseType="string">
          <correctResponse>
            <value>third</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>First question: <textEntryInteraction responseIdentifier="RESPONSE_1" expectedLength="20" /></p>
          <p>Second question: <textEntryInteraction responseIdentifier="RESPONSE_2" expectedLength="20" /></p>
          <p>Third question: <textEntryInteraction responseIdentifier="RESPONSE_3" expectedLength="20" /></p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-013');
    const model = result.config.models[0];

    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('{{1}}');
    expect(model.markup).toContain('{{2}}');
    expect(model.choices['0']).toEqual([{ label: 'first', value: '0' }]);
    expect(model.choices['1']).toEqual([{ label: 'second', value: '0' }]);
    expect(model.choices['2']).toEqual([{ label: 'third', value: '0' }]);
    expect(model.maxLengthPerChoice).toEqual([20, 20, 20]);
  });

  test('should preserve HTML formatting in markup', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_1" cardinality="single" baseType="string">
          <correctResponse>
            <value>bold</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>The word <strong>bold</strong> should be entered here: <textEntryInteraction responseIdentifier="RESPONSE_1" />.</p>
        </itemBody>    `, 'ecr-PLACEHOLDER', 'ECR Test');

    const result = transformExplicitConstructedResponse(qtiXml, 'ecr-014');
    const model = result.config.models[0];

    expect(model.markup).toContain('<strong>bold</strong>');
    expect(model.markup).toContain('{{0}}');
  });
});
