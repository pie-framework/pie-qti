/**
 * Match Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformMatch } from '../../src/transformers/match.js';
import { createQtiWrapper, } from '../test-utils.js';

describe('transformMatch', () => {
  test('should transform basic QTI matchInteraction to PIE match', () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
        <correctResponse>
          <value>A C</value>
          <value>B D</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <matchInteraction responseIdentifier="RESPONSE" shuffle="true">
          <prompt>Match each animal to its category:</prompt>
          <simpleMatchSet>
            <simpleAssociableChoice identifier="A">Dog</simpleAssociableChoice>
            <simpleAssociableChoice identifier="B">Salmon</simpleAssociableChoice>
          </simpleMatchSet>
          <simpleMatchSet>
            <simpleAssociableChoice identifier="C">Mammal</simpleAssociableChoice>
            <simpleAssociableChoice identifier="D">Fish</simpleAssociableChoice>
          </simpleMatchSet>
        </matchInteraction>
      </itemBody>
    `);

    const result = transformMatch(qtiXml, 'ma-001');

    expect(result.id).toBe('ma-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/match');
    expect(model.prompt).toBe('Match each animal to its category:');
    expect(model.lockChoiceOrder).toBe(false); // shuffle=true means unlocked
    expect(model.choiceMode).toBe('radio');
    expect(model.layout).toBe(2); // 2 options

    // Headers: first is empty, then the option labels
    expect(model.headers).toEqual(['', 'Mammal', 'Fish']);

    // Rows: stems with their correct answer values
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0]).toEqual({
      id: '1',
      title: 'Dog',
      values: [true, false], // A matches C (Mammal)
    });
    expect(model.rows[1]).toEqual({
      id: '2',
      title: 'Salmon',
      values: [false, true], // B matches D (Fish)
    });

    expect(result.metadata?.searchMetaData?.itemType).toBe('MA');
  });

  test('should lock choice order when shuffle=false', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="false">
            <prompt>Match these:</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Item</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="B">Match</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-002');
    const model = result.config.models[0];

    expect(model.lockChoiceOrder).toBe(true); // shuffle=false means locked
  });

  test('should handle HTML content in stems and options', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE">
            <prompt>Match these:</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A"><strong>Bold</strong> stem</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="B"><em>Italic</em> option</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-003');
    const model = result.config.models[0];

    expect(model.rows[0].title).toContain('<strong>Bold</strong>');
    expect(model.headers[1]).toContain('<em>Italic</em>');
  });

  test('should handle prompt outside matchInteraction element', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Match the following items:</p>
          <matchInteraction responseIdentifier="RESPONSE">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Stem</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="B">Option</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-004');
    const model = result.config.models[0];

    expect(model.prompt).toContain('Match the following items:');
  });

  test('should handle missing prompt gracefully', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE">
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Stem</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="B">Option</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-005');
    const model = result.config.models[0];

    expect(model.prompt).toBe('');
  });

  test('should handle missing correctResponse gracefully', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE">
            <prompt>Match these:</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Stem 1</simpleAssociableChoice>
              <simpleAssociableChoice identifier="B">Stem 2</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="C">Option 1</simpleAssociableChoice>
              <simpleAssociableChoice identifier="D">Option 2</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-006');
    const model = result.config.models[0];

    // All values should be false when no correct response is provided
    expect(model.rows[0].values).toEqual([false, false]);
    expect(model.rows[1].values).toEqual([false, false]);
  });

  test('should throw error if no matchInteraction found', () => {
    const qtiXml = `
      <assessmentItem>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>
      </assessmentItem>
    `;

    expect(() => transformMatch(qtiXml, 'ma-007')).toThrow(
      /Missing required interaction: matchInteraction/
    );
  });

  test('should support partial scoring option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE">
            <prompt>Match these:</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Stem</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="B">Option</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-008', {
      partialScoring: true,
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
  });

  test('should support checkbox choice mode option', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE">
            <prompt>Match these:</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Stem</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="B">Option</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-009', {
      choiceMode: 'checkbox',
    });

    const model = result.config.models[0];
    expect(model.choiceMode).toBe('checkbox');
  });

  test('should handle complex matching scenario with multiple stems and options', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>cap Paris</value>
            <value>ber Berlin</value>
            <value>rom Rome</value>
            <value>mad Madrid</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE" shuffle="true">
            <prompt>Match each country to its capital city:</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="cap">France</simpleAssociableChoice>
              <simpleAssociableChoice identifier="ber">Germany</simpleAssociableChoice>
              <simpleAssociableChoice identifier="rom">Italy</simpleAssociableChoice>
              <simpleAssociableChoice identifier="mad">Spain</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="Paris">Paris</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Berlin">Berlin</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Rome">Rome</simpleAssociableChoice>
              <simpleAssociableChoice identifier="Madrid">Madrid</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-010');
    const model = result.config.models[0];

    expect(model.rows).toHaveLength(4);
    expect(model.headers).toHaveLength(5); // Empty + 4 options
    expect(model.layout).toBe(4);
    expect(model.lockChoiceOrder).toBe(false);

    // Verify correct response mappings
    expect(model.rows[0].title).toBe('France');
    expect(model.rows[0].values).toEqual([true, false, false, false]); // Paris

    expect(model.rows[1].title).toBe('Germany');
    expect(model.rows[1].values).toEqual([false, true, false, false]); // Berlin

    expect(model.rows[2].title).toBe('Italy');
    expect(model.rows[2].values).toEqual([false, false, true, false]); // Rome

    expect(model.rows[3].title).toBe('Spain');
    expect(model.rows[3].values).toEqual([false, false, false, true]); // Madrid
  });

  test('should handle asymmetric matching (more stems than options)', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A cat1</value>
            <value>B cat2</value>
            <value>C cat1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE">
            <prompt>Classify each item:</prompt>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="A">Item 1</simpleAssociableChoice>
              <simpleAssociableChoice identifier="B">Item 2</simpleAssociableChoice>
              <simpleAssociableChoice identifier="C">Item 3</simpleAssociableChoice>
            </simpleMatchSet>
            <simpleMatchSet>
              <simpleAssociableChoice identifier="cat1">Category A</simpleAssociableChoice>
              <simpleAssociableChoice identifier="cat2">Category B</simpleAssociableChoice>
            </simpleMatchSet>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-011');
    const model = result.config.models[0];

    expect(model.rows).toHaveLength(3);
    expect(model.headers).toHaveLength(3); // Empty + 2 categories
    expect(model.layout).toBe(2);

    expect(model.rows[0].values).toEqual([true, false]); // Item 1 -> Category A
    expect(model.rows[1].values).toEqual([false, true]); // Item 2 -> Category B
    expect(model.rows[2].values).toEqual([true, false]); // Item 3 -> Category A
  });

  test('should handle missing simpleMatchSets gracefully', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>A B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <matchInteraction responseIdentifier="RESPONSE">
            <prompt>Match these:</prompt>
          </matchInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformMatch(qtiXml, 'ma-012');
    const model = result.config.models[0];

    expect(model.rows).toEqual([]);
    expect(model.headers).toEqual(['']);
    expect(model.layout).toBe(0);
  });
});
