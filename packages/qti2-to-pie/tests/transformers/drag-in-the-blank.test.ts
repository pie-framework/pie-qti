/**
 * Drag-in-the-Blank Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformDragInTheBlank } from '../../src/transformers/drag-in-the-blank.js';
import { createQtiWrapper } from '../test-utils.js';

describe('transformDragInTheBlank', () => {
  test('should transform basic QTI gapMatchInteraction to PIE drag-in-the-blank', () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
        <correctResponse>
          <value>choice1 gap1</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <gapMatchInteraction responseIdentifier="RESPONSE">
          <prompt>Drag the correct answer:</prompt>
          <gapText identifier="choice1">cat</gapText>
          <gapText identifier="choice2">dog</gapText>
          <p>The <gap identifier="gap1"/> is a feline.</p>
        </gapMatchInteraction>
      </itemBody>
    `);

    const result = transformDragInTheBlank(qtiXml, 'ditb-001');

    expect(result.id).toBe('ditb-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/drag-in-the-blank');
    expect(model.prompt).toBe('Drag the correct answer:');
    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('feline');
    expect(model.choices).toHaveLength(2);
    expect(model.choices[0]).toEqual({ id: '0', value: 'cat' });
    expect(model.choices[1]).toEqual({ id: '1', value: 'dog' });
    expect(model.correctResponse).toEqual({ '0': '0' }); // gap 0 -> choice 0
    expect(result.metadata?.searchMetaData?.itemType).toBe('DITB');
  });

  test('should handle multiple gaps', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>H gap1</value>
            <value>O gap2</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="H">hydrogen</gapText>
            <gapText identifier="O">oxygen</gapText>
            <gapText identifier="N">nitrogen</gapText>
            <p>Water is made of <gap identifier="gap1"/> and <gap identifier="gap2"/>.</p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-002');
    const model = result.config.models[0];

    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('{{1}}');
    expect(model.choices).toHaveLength(3);
    expect(model.correctResponse['0']).toBe('0'); // gap1 -> hydrogen (choice 0)
    expect(model.correctResponse['1']).toBe('1'); // gap2 -> oxygen (choice 1)
  });

  test('should handle shuffle attribute (lockChoiceOrder)', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <gapText identifier="A">Choice</gapText>
            <p>Drag here: <gap identifier="gap1"/></p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-003');
    const model = result.config.models[0];

    expect(model.lockChoiceOrder).toBe(true); // shuffle=false means locked
  });

  test('should detect duplicates from matchMax attribute', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
            <value>A gap2</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="A" matchMax="0">Reusable</gapText>
            <p><gap identifier="gap1"/> and <gap identifier="gap2"/></p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-004');
    const model = result.config.models[0];

    expect(model.duplicates).toBe(true); // matchMax=0 means unlimited uses
  });

  test('should detect duplicates from repeated correct answers', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>same gap1</value>
            <value>same gap2</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="same">Repeated</gapText>
            <gapText identifier="other">Other</gapText>
            <p><gap identifier="gap1"/> <gap identifier="gap2"/></p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-005');
    const model = result.config.models[0];

    expect(model.duplicates).toBe(true); // Same choice used twice
  });

  test('should handle modalFeedback as rationale', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="A">Choice</gapText>
            <p><gap identifier="gap1"/></p>
          </gapMatchInteraction>
        </itemBody>
        <modalFeedback>This is the rationale explaining the answer.</modalFeedback>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-006');
    const model = result.config.models[0];

    expect(model.rationale).toContain('rationale explaining');
  });

  test('should handle mapEntry for correct responses', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <mapping>
            <mapEntry mapKey="A gap1" mappedValue="1"/>
            <mapEntry mapKey="B gap1" mappedValue="-1"/>
          </mapping>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="A">Correct</gapText>
            <gapText identifier="B">Wrong</gapText>
            <p><gap identifier="gap1"/></p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-007');
    const model = result.config.models[0];

    // Should only include positive mappedValue entries
    expect(model.correctResponse['0']).toBe('0'); // A (positive score)
  });

  test('should throw error if no itemBody found', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
          </correctResponse>
        </responseDeclaration>
      </assessmentItem>
    `;

    expect(() => transformDragInTheBlank(qtiXml, 'ditb-008')).toThrow(
      /Missing required element: itemBody/
    );
  });

  test('should throw error if no gapMatchInteraction found', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>
      </assessmentItem>
    `;

    expect(() => transformDragInTheBlank(qtiXml, 'ditb-009')).toThrow(
      /Missing required interaction: gapMatchInteraction/
    );
  });

  test('should support options', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="A">Choice</gapText>
            <p><gap identifier="gap1"/></p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-010', {
      partialScoring: true,
      lockChoiceOrder: false,
      duplicates: true,
      choicesPosition: 'above',
      rationale: 'Custom rationale',
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
    expect(model.lockChoiceOrder).toBe(false);
    expect(model.duplicates).toBe(true);
    expect(model.choicesPosition).toBe('above');
    expect(model.rationale).toBe('Custom rationale');
  });

  test('should handle HTML entities in choices', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="A">&lt;html&gt; code</gapText>
            <p><gap identifier="gap1"/></p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-011');
    const model = result.config.models[0];

    expect(model.choices[0].value).toContain('<html>');
  });

  test('should handle self-closing gap tags', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A gap1</value>
            <value>B gap2</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <gapMatchInteraction responseIdentifier="RESPONSE">
            <gapText identifier="A">First</gapText>
            <gapText identifier="B">Second</gapText>
            <p><gap identifier="gap1"/> and <gap identifier="gap2"/></p>
          </gapMatchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformDragInTheBlank(qtiXml, 'ditb-012');
    const model = result.config.models[0];

    expect(model.markup).toContain('{{0}}');
    expect(model.markup).toContain('{{1}}');
    expect(model.correctResponse['0']).toBe('0');
    expect(model.correctResponse['1']).toBe('1');
  });
});
