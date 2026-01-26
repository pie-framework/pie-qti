/**
 * Placement Ordering Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformPlacementOrdering } from '../../src/transformers/placement-ordering.js';
import { createQtiWrapper } from '../test-utils.js';

describe('transformPlacementOrdering', () => {
  test('should transform basic QTI orderInteraction to PIE placement-ordering', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>C</value>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
            <prompt>Arrange these items in alphabetical order:</prompt>
            <simpleChoice identifier="A">Apple</simpleChoice>
            <simpleChoice identifier="B">Banana</simpleChoice>
            <simpleChoice identifier="C">Cherry</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-001');

    expect(result.id).toBe('po-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/placement-ordering');
    expect(model.prompt).toBe('Arrange these items in alphabetical order:');
    expect(model.lockChoiceOrder).toBe(false); // shuffle=true means unlocked
    expect(model.choices).toHaveLength(3);
    expect(model.choices[0]).toEqual({ id: '0', label: 'Apple' });
    expect(model.choices[1]).toEqual({ id: '1', label: 'Banana' });
    expect(model.choices[2]).toEqual({ id: '2', label: 'Cherry' });

    // Correct response maps choice identifiers to indices
    expect(model.correctResponse).toHaveLength(3);
    expect(model.correctResponse[0]).toEqual({ id: '2' }); // C = index 2
    expect(model.correctResponse[1]).toEqual({ id: '0' }); // A = index 0
    expect(model.correctResponse[2]).toEqual({ id: '1' }); // B = index 1

    expect(result.metadata?.searchMetaData?.itemType).toBe('PO');
  });

  test('should handle vertical orientation', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE" orientation="vertical">
            <prompt>Order these steps:</prompt>
            <simpleChoice identifier="A">First step</simpleChoice>
            <simpleChoice identifier="B">Second step</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-002');
    const model = result.config.models[0];

    expect(model.orientation).toBe('vertical');
  });

  test('should handle horizontal orientation', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE" orientation="horizontal">
            <prompt>Order these:</prompt>
            <simpleChoice identifier="A">One</simpleChoice>
            <simpleChoice identifier="B">Two</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-003');
    const model = result.config.models[0];

    expect(model.orientation).toBe('horizontal');
  });

  test('should lock choice order when shuffle=false', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE" shuffle="false">
            <prompt>Order these:</prompt>
            <simpleChoice identifier="A">One</simpleChoice>
            <simpleChoice identifier="B">Two</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-004');
    const model = result.config.models[0];

    expect(model.lockChoiceOrder).toBe(true); // shuffle=false means locked
  });

  test('should handle prompt outside orderInteraction element', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Arrange the following in order:</p>
          <orderInteraction responseIdentifier="RESPONSE">
            <simpleChoice identifier="A">First</simpleChoice>
            <simpleChoice identifier="B">Second</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-005');
    const model = result.config.models[0];

    expect(model.prompt).toContain('Arrange the following in order:');
  });

  test('should handle HTML content in choices', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE">
            <prompt>Order these:</prompt>
            <simpleChoice identifier="A"><strong>Bold</strong> text</simpleChoice>
            <simpleChoice identifier="B"><em>Italic</em> text</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-006');
    const model = result.config.models[0];

    expect(model.choices[0].label).toContain('<strong>Bold</strong>');
    expect(model.choices[1].label).toContain('<em>Italic</em>');
  });

  test('should support partial scoring option', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE">
            <prompt>Order these:</prompt>
            <simpleChoice identifier="A">First</simpleChoice>
            <simpleChoice identifier="B">Second</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-007', {
      partialScoring: true,
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
  });

  test('should use default orientation when not specified', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE">
            <simpleChoice identifier="A">Item</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-008');
    const model = result.config.models[0];

    expect(model.orientation).toBe('vertical'); // default
  });

  test('should override default orientation with option', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE">
            <simpleChoice identifier="A">Item</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-009', {
      defaultOrientation: 'horizontal',
    });

    const model = result.config.models[0];
    expect(model.orientation).toBe('horizontal');
  });

  test('should handle missing prompt gracefully', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE">
            <simpleChoice identifier="A">Item</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-010');
    const model = result.config.models[0];

    expect(model.prompt).toBe('');
  });

  test('should handle missing correctResponse gracefully', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE">
            <prompt>Order these:</prompt>
            <simpleChoice identifier="A">First</simpleChoice>
            <simpleChoice identifier="B">Second</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-011');
    const model = result.config.models[0];

    expect(model.correctResponse).toEqual([]);
  });

  test('should throw error if no orderInteraction found', () => {
    const qtiXml = createQtiWrapper(`
<itemBody>
          <p>No interaction here</p>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    expect(() => transformPlacementOrdering(qtiXml, 'po-012')).toThrow(
      /Missing required interaction: orderInteraction/
    );
  });

  test('should handle complex ordering scenario', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
          <correctResponse>
            <value>step4</value>
            <value>step2</value>
            <value>step1</value>
            <value>step3</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <orderInteraction responseIdentifier="RESPONSE" shuffle="true" orientation="vertical">
            <prompt>Arrange these historical events in chronological order (earliest first):</prompt>
            <simpleChoice identifier="step1">Declaration of Independence (1776)</simpleChoice>
            <simpleChoice identifier="step2">American Civil War begins (1861)</simpleChoice>
            <simpleChoice identifier="step3">World War I begins (1914)</simpleChoice>
            <simpleChoice identifier="step4">American Revolutionary War begins (1775)</simpleChoice>
          </orderInteraction>
        </itemBody>    `, 'po-PLACEHOLDER', 'Placement Ordering Test');

    const result = transformPlacementOrdering(qtiXml, 'po-013');
    const model = result.config.models[0];

    expect(model.choices).toHaveLength(4);
    expect(model.correctResponse).toHaveLength(4);
    expect(model.lockChoiceOrder).toBe(false);
    expect(model.orientation).toBe('vertical');

    // Verify correct response order
    expect(model.correctResponse[0].id).toBe('3'); // step4 is at index 3
    expect(model.correctResponse[1].id).toBe('1'); // step2 is at index 1
    expect(model.correctResponse[2].id).toBe('0'); // step1 is at index 0
    expect(model.correctResponse[3].id).toBe('2'); // step3 is at index 2
  });
});
