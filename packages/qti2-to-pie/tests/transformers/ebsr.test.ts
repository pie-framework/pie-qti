/**
 * EBSR Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformEbsr } from '../../src/transformers/ebsr.js';
import { createQtiWrapper } from '../test-utils.js';

describe('transformEbsr', () => {
  test('should transform basic QTI EBSR (two choiceInteractions) to PIE ebsr', () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>X</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <p>Read the passage below:</p>
        <choiceInteraction responseIdentifier="RESPONSE_A">
          <prompt>Part A: What is the main idea?</prompt>
          <simpleChoice identifier="A">Choice A</simpleChoice>
          <simpleChoice identifier="B">Choice B</simpleChoice>
        </choiceInteraction>
        <choiceInteraction responseIdentifier="RESPONSE_B">
          <prompt>Part B: Which evidence supports your answer?</prompt>
          <simpleChoice identifier="X">Evidence X</simpleChoice>
          <simpleChoice identifier="Y">Evidence Y</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `, 'ebsr-001', 'Basic EBSR');

    const result = transformEbsr(qtiXml, 'ebsr-001');

    expect(result.id).toBe('ebsr-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/ebsr');
    expect(model.partialScoring).toBe(true);
    expect(model.partLabels).toBe(false);
    expect(model.partLabelType).toBe('Letters');

    // Check Part A
    expect(model.partA.prompt).toContain('Read the passage');
    expect(model.partA.prompt).toContain('Part A: What is the main idea?');
    expect(model.partA.choices).toHaveLength(2);
    expect(model.partA.choices[0].value).toBe('A');
    expect(model.partA.choices[0].correct).toBe(true);
    expect(model.partA.choices[1].correct).toBe(false);
    expect(model.partA.choiceMode).toBe('radio');

    // Check Part B
    expect(model.partB.prompt).toContain('Part B');
    expect(model.partB.choices).toHaveLength(2);
    expect(model.partB.choices[0].value).toBe('X');
    expect(model.partB.choices[0].correct).toBe(true);
    expect(model.partB.choiceMode).toBe('radio');

    expect(result.metadata?.searchMetaData?.itemType).toBe('EBSR');
  });

  test('should handle multiple correct answers (checkbox mode)', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>X</value>
            <value>Y</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A" maxChoices="2">
            <prompt>Select all that apply:</prompt>
            <simpleChoice identifier="A">A</simpleChoice>
            <simpleChoice identifier="B">B</simpleChoice>
            <simpleChoice identifier="C">C</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B" maxChoices="2">
            <prompt>Select evidence:</prompt>
            <simpleChoice identifier="X">X</simpleChoice>
            <simpleChoice identifier="Y">Y</simpleChoice>
            <simpleChoice identifier="Z">Z</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-002');
    const model = result.config.models[0];

    expect(model.partA.choiceMode).toBe('checkbox');
    expect(model.partA.choices[0].correct).toBe(true);
    expect(model.partA.choices[1].correct).toBe(true);
    expect(model.partA.choices[2].correct).toBe(false);

    expect(model.partB.choiceMode).toBe('checkbox');
    expect(model.partB.choices[0].correct).toBe(true);
    expect(model.partB.choices[1].correct).toBe(true);
    expect(model.partB.choices[2].correct).toBe(false);
  });

  test('should handle shuffle attribute (lockChoiceOrder)', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A" shuffle="false">
            <prompt>Part A</prompt>
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B" shuffle="true">
            <prompt>Part B</prompt>
            <simpleChoice identifier="X">X</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-003');
    const model = result.config.models[0];

    expect(model.partA.lockChoiceOrder).toBe(true); // shuffle=false
    expect(model.partB.lockChoiceOrder).toBe(false); // shuffle=true
  });

  test('should support options', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>Part A</prompt>
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt>Part B</prompt>
            <simpleChoice identifier="X">X</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-004', {
      partialScoring: false,
      partLabels: true,
      partLabelType: 'Numbers',
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(false);
    expect(model.partLabels).toBe(true);
    expect(model.partLabelType).toBe('Numbers');
  });

  test('should handle mapEntry for correct responses', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <mapping>
            <mapEntry mapKey="A" mappedValue="1"/>
            <mapEntry mapKey="B" mappedValue="-1"/>
          </mapping>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <mapping>
            <mapEntry mapKey="X" mappedValue="1"/>
            <mapEntry mapKey="Y" mappedValue="0"/>
          </mapping>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>Part A</prompt>
            <simpleChoice identifier="A">Correct</simpleChoice>
            <simpleChoice identifier="B">Wrong</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt>Part B</prompt>
            <simpleChoice identifier="X">Correct</simpleChoice>
            <simpleChoice identifier="Y">Wrong</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-005');
    const model = result.config.models[0];

    // Should only include positive mappedValue entries
    expect(model.partA.choices[0].correct).toBe(true); // A (positive)
    expect(model.partA.choices[1].correct).toBe(false); // B (negative)
    expect(model.partB.choices[0].correct).toBe(true); // X (positive)
    expect(model.partB.choices[1].correct).toBe(false); // Y (zero)
  });

  test('should handle HTML entities in choices', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>Part A</prompt>
            <simpleChoice identifier="A">&lt;html&gt; code</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt>Part B</prompt>
            <simpleChoice identifier="X">&lt;div&gt; tag</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-006');
    const model = result.config.models[0];

    expect(model.partA.choices[0].label).toContain('<html>');
    expect(model.partB.choices[0].label).toContain('<div>');
  });

  test('should detect feedbackEnabled from feedbackInline', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>Part A</prompt>
            <simpleChoice identifier="A">
              Choice A
              <feedbackInline>This is correct!</feedbackInline>
            </simpleChoice>
            <simpleChoice identifier="B">Choice B</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt>Part B</prompt>
            <simpleChoice identifier="X">Evidence X</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-007');
    const model = result.config.models[0];

    expect(model.partA.feedbackEnabled).toBe(true);
    expect(model.partA.choices[0].feedback).toContain('This is correct!');
    expect(model.partB.feedbackEnabled).toBe(false);
  });

  test('should handle shared prompt before both interactions', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>This is a shared passage that applies to both parts.</p>
          <p>It contains important context information.</p>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>Part A: Question about passage</prompt>
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt>Part B: Supporting evidence</prompt>
            <simpleChoice identifier="X">X</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-008');
    const model = result.config.models[0];

    expect(model.partA.prompt).toContain('shared passage');
    expect(model.partA.prompt).toContain('Part A: Question about passage');
    expect(model.partB.prompt).toContain('Part B: Supporting evidence');
    expect(model.partB.prompt).not.toContain('shared passage'); // Only in Part A
  });

  test('should handle prompts inside interactions only', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>What is the answer to Part A?</prompt>
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt>What is the answer to Part B?</prompt>
            <simpleChoice identifier="X">X</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-009');
    const model = result.config.models[0];

    expect(model.partA.prompt).toBe('What is the answer to Part A?');
    expect(model.partB.prompt).toBe('What is the answer to Part B?');
  });

  test('should throw error if no itemBody found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    expect(() => transformEbsr(qtiXml, 'ebsr-010')).toThrow(
      /Missing required element: itemBody/
    );
  });

  test('should throw error if less than 2 choiceInteractions', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>Only one part</prompt>
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    expect(() => transformEbsr(qtiXml, 'ebsr-011')).toThrow(
      /Insufficient choiceInteraction elements/
    );
  });

  test('should handle missing correctResponse gracefully', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt>Part A</prompt>
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt>Part B</prompt>
            <simpleChoice identifier="X">X</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-012');
    const model = result.config.models[0];

    // All choices should be marked as not correct
    expect(model.partA.choices[0].correct).toBe(false);
    expect(model.partB.choices[0].correct).toBe(false);
  });

  test('should handle HTML content in prompts', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <div class="passage">
            <p><strong>Read this carefully:</strong></p>
            <p>Important content with <em>emphasis</em>.</p>
          </div>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <prompt><p>Part A: <strong>Bold question</strong></p></prompt>
            <simpleChoice identifier="A">A</simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <prompt><p>Part B: <em>Italic question</em></p></prompt>
            <simpleChoice identifier="X">X</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'ebsr-PLACEHOLDER', 'EBSR Test');

    const result = transformEbsr(qtiXml, 'ebsr-013');
    const model = result.config.models[0];

    expect(model.partA.prompt).toContain('<strong>');
    expect(model.partA.prompt).toContain('<em>emphasis</em>');
    expect(model.partB.prompt).toContain('<em>Italic question</em>');
  });
});
