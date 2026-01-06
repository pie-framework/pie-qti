/**
 * Match List Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformMatchList } from '../../src/transformers/match-list.js';
import { createQtiWrapper } from '../test-utils.js';

describe('transformMatchList', () => {
  test('should transform basic QTI matchInteraction to PIE match-list', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
            <value>B Y</value>
            <value>C Z</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Match each item with its correct answer:</p>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Question 1</simpleAssociableChoice>
              <simpleAssociableChoice identifier="B">Question 2</simpleAssociableChoice>
              <simpleAssociableChoice identifier="C">Question 3</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Answer A</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Y">Answer B</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Z">Answer C</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-001');

    expect(result.id).toBe('ml-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/match-list');
    expect(model.prompt).toContain('Match each item');
    expect(model.lockChoiceOrder).toBe(true); // shuffle=false means locked
    expect(model.duplicates).toBe(false);

    // Check prompts
    expect(model.prompts).toHaveLength(3);
    expect(model.prompts[0]).toEqual({
      id: 0,
      title: 'Question 1',
      relatedAnswer: 0, // Maps to Answer A (index 0)
    });
    expect(model.prompts[1]).toEqual({
      id: 1,
      title: 'Question 2',
      relatedAnswer: 1, // Maps to Answer B (index 1)
    });
    expect(model.prompts[2]).toEqual({
      id: 2,
      title: 'Question 3',
      relatedAnswer: 2, // Maps to Answer C (index 2)
    });

    // Check answers
    expect(model.answers).toHaveLength(3);
    expect(model.answers[0]).toEqual({ id: 0, title: 'Answer A' });
    expect(model.answers[1]).toEqual({ id: 1, title: 'Answer B' });
    expect(model.answers[2]).toEqual({ id: 2, title: 'Answer C' });

    expect(result.metadata?.searchMetaData?.itemType).toBe('ML');
  });

  test('should handle shuffle=true', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="true">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Prompt</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Answer</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-002');
    const model = result.config.models[0];

    expect(model.lockChoiceOrder).toBe(false); // shuffle=true means not locked
  });

  test('should detect duplicate answers', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
            <value>B X</value>
            <value>C Y</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Red</simpleAssociableChoice>
              <simpleAssociableChoice identifier="B">Crimson</simpleAssociableChoice>
              <simpleAssociableChoice identifier="C">Blue</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Color of fire</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Y">Color of sky</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-003');
    const model = result.config.models[0];

    expect(model.duplicates).toBe(true); // Both A and B map to X
  });

  test('should handle prompt inside interaction', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <prompt>Match the countries with their capitals.</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">France</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Paris</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-004');
    const model = result.config.models[0];

    expect(model.prompt).toBe('Match the countries with their capitals.');
  });

  test('should handle prompt before interaction', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Read the instructions carefully.</p>
          <p>Match the following items.</p>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Item 1</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Choice 1</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-005');
    const model = result.config.models[0];

    expect(model.prompt).toContain('Read the instructions');
    expect(model.prompt).toContain('Match the following');
  });

  test('should handle HTML content in choices', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
            <value>B Y</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A"><strong>Bold</strong> text</simpleAssociableChoice>
              <simpleAssociableChoice identifier="B"><em>Italic</em> text</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X"><code>Code</code> block</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Y"><span class="highlight">Highlighted</span></simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-006');
    const model = result.config.models[0];

    expect(model.prompts[0].title).toBe('<strong>Bold</strong> text');
    expect(model.prompts[1].title).toBe('<em>Italic</em> text');
    expect(model.answers[0].title).toBe('<code>Code</code> block');
    expect(model.answers[1].title).toBe('<span class="highlight">Highlighted</span>');
  });

  test('should handle mapping instead of correctResponse', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <mapping>
            <mapEntry mapKey="A X" mappedValue="1"/>
            <mapEntry mapKey="B Y" mappedValue="1"/>
          </mapping>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Question A</simpleAssociableChoice>
              <simpleAssociableChoice identifier="B">Question B</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Answer X</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Y">Answer Y</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-007');
    const model = result.config.models[0];

    expect(model.prompts[0].relatedAnswer).toBe(0); // A maps to X (index 0)
    expect(model.prompts[1].relatedAnswer).toBe(1); // B maps to Y (index 1)
  });

  test('should support options', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="true">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Prompt</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Answer</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-008', {
      lockChoiceOrder: true, // Override shuffle=true
      duplicates: true,
    });

    const model = result.config.models[0];
    expect(model.lockChoiceOrder).toBe(true);
    expect(model.duplicates).toBe(true);
  });

  test('should throw error if no itemBody found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
          </correctResponse>
        </responseDeclaration>    `, 'ml-PLACEHOLDER', 'Match List Test');

    expect(() => transformMatchList(qtiXml, 'ml-009')).toThrow(/Missing required element: itemBody/);
  });

  test('should throw error if no matchInteraction found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    expect(() => transformMatchList(qtiXml, 'ml-010')).toThrow(/Missing required interaction: matchInteraction/);
  });

  test('should throw error if simpleMatchSet missing', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Only one set</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    expect(() => transformMatchList(qtiXml, 'ml-011')).toThrow('matchInteraction must have 2 simpleMatchSet elements');
  });

  test('should handle unbalanced sets (more answers than prompts)', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A X</value>
            <value>B Y</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Question 1</simpleAssociableChoice>
              <simpleAssociableChoice identifier="B">Question 2</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="X">Answer 1</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Y">Answer 2</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Z">Distractor</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-012');
    const model = result.config.models[0];

    expect(model.prompts).toHaveLength(2);
    expect(model.answers).toHaveLength(3); // Includes distractor
  });

  test('should handle complex matching scenario', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>CAT MAMMAL</value>
            <value>EAGLE BIRD</value>
            <value>SALMON FISH</value>
            <value>FROG AMPHIBIAN</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Match each animal with its class:</p>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="true">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="CAT">Cat</simpleAssociableChoice>
              <simpleAssociableChoice identifier="EAGLE">Eagle</simpleAssociableChoice>
              <simpleAssociableChoice identifier="SALMON">Salmon</simpleAssociableChoice>
              <simpleAssociableChoice identifier="FROG">Frog</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="MAMMAL">Mammal</simpleAssociableChoice>
              <simpleAssociableChoice identifier="BIRD">Bird</simpleAssociableChoice>
              <simpleAssociableChoice identifier="FISH">Fish</simpleAssociableChoice>
              <simpleAssociableChoice identifier="AMPHIBIAN">Amphibian</simpleAssociableChoice>
              <simpleAssociableChoice identifier="REPTILE">Reptile</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>    `, 'ml-PLACEHOLDER', 'Match List Test');

    const result = transformMatchList(qtiXml, 'ml-013');
    const model = result.config.models[0];

    expect(model.prompts).toHaveLength(4);
    expect(model.answers).toHaveLength(5); // 4 correct + 1 distractor
    expect(model.lockChoiceOrder).toBe(false); // shuffle=true

    // Check specific mappings
    expect(model.prompts[0]).toEqual({ id: 0, title: 'Cat', relatedAnswer: 0 }); // MAMMAL
    expect(model.prompts[1]).toEqual({ id: 1, title: 'Eagle', relatedAnswer: 1 }); // BIRD
    expect(model.prompts[2]).toEqual({ id: 2, title: 'Salmon', relatedAnswer: 2 }); // FISH
    expect(model.prompts[3]).toEqual({ id: 3, title: 'Frog', relatedAnswer: 3 }); // AMPHIBIAN
  });
});
