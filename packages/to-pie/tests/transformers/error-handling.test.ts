/**
 * Error Handling Tests for QTI Transformers
 *
 * Tests negative cases, malformed XML, missing required elements,
 * and invalid QTI structures across all transformers.
 */

import { describe, expect, test } from 'bun:test';
import { transformDragInTheBlank } from '../../src/transformers/drag-in-the-blank.js';
import { transformHotspot } from '../../src/transformers/hotspot.js';
import { transformMatch } from '../../src/transformers/match.js';
import { transformMultipleChoice } from '../../src/transformers/multiple-choice.js';
import { transformSelectText } from '../../src/transformers/select-text.js';
import { createQtiWrapper, parseQtiItem } from '../test-utils.js';

describe('Error Handling - Invalid XML', () => {
  test('should parse malformed XML with auto-correction', () => {
    const malformedXml = '<assessmentItem>Unclosed tag';

    // node-html-parser auto-corrects malformed XML
    const result = parseQtiItem(malformedXml);
    expect(result).toBeDefined();
  });

  test('should reject XML without assessmentItem root', () => {
    const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
      <itemBody>
        <p>Missing assessmentItem wrapper</p>
      </itemBody>`;

    expect(() => parseQtiItem(invalidXml)).toThrow('No assessmentItem element found');
  });

  test('should reject empty XML', () => {
    expect(() => parseQtiItem('')).toThrow();
  });

  test('should reject null or undefined', () => {
    expect(() => parseQtiItem(null as any)).toThrow();
    expect(() => parseQtiItem(undefined as any)).toThrow();
  });
});

describe('Error Handling - Missing Required Elements', () => {
  test('multiple-choice: should reject missing choiceInteraction', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <p>Question without interaction</p>
      </itemBody>
    `, 'mc-no-interaction');

    const itemElement = parseQtiItem(qtiXml);

    await expect(
      transformMultipleChoice(itemElement, 'mc-no-interaction')
    ).rejects.toThrow(/Missing required interaction: choiceInteraction/);
  });

  test('match: should reject missing matchInteraction', () => {
    const qtiXml = createQtiWrapper(`
      <itemBody>
        <p>Question without interaction</p>
      </itemBody>
    `);

    expect(() => transformMatch(qtiXml, 'ma-no-interaction')).toThrow(
      /Missing required interaction: matchInteraction/
    );
  });

  test('hotspot: should reject missing hotspotInteraction', () => {
    const qtiXml = createQtiWrapper(`
      <itemBody>
        <p>Question without interaction</p>
      </itemBody>
    `);

    expect(() => transformHotspot(qtiXml, 'hs-no-interaction')).toThrow(
      /Missing required interaction: hotspotInteraction/
    );
  });

  test('select-text: should reject missing hottextInteraction', () => {
    const qtiXml = createQtiWrapper(`
      <itemBody>
        <p>Question without interaction</p>
      </itemBody>
    `);

    expect(() => transformSelectText(qtiXml, 'st-no-interaction')).toThrow(
      /Missing required interaction: hottextInteraction/
    );
  });

  test('drag-in-the-blank: should reject missing gapMatchInteraction', () => {
    const qtiXml = createQtiWrapper(`
      <itemBody>
        <p>Question without interaction</p>
      </itemBody>
    `);

    expect(() => transformDragInTheBlank(qtiXml, 'ditb-no-interaction')).toThrow(
      /Missing required interaction: gapMatchInteraction/
    );
  });
});

describe('Error Handling - Missing itemBody', () => {
  test('drag-in-the-blank: should reject missing itemBody', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
      <assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
                      identifier="ditb-no-body"
                      title="No Body">
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
        </responseDeclaration>
      </assessmentItem>`;

    expect(() => transformDragInTheBlank(qtiXml, 'ditb-no-body')).toThrow(
      /Missing required element: itemBody/
    );
  });
});

describe('Error Handling - Empty Interactions', () => {
  test('multiple-choice: should handle no choices', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
      </responseDeclaration>
      <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE">
          <prompt>Question with no choices</prompt>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-no-choices');

    // Should not throw, but should have empty choices
    expect(result.config.models[0].choices).toHaveLength(0);
  });

  test('match: should handle no match sets', () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
      </responseDeclaration>
      <itemBody>
        <matchInteraction responseIdentifier="RESPONSE">
          <prompt>Match without options</prompt>
        </matchInteraction>
      </itemBody>
    `);

    const result = transformMatch(qtiXml, 'ma-no-sets');

    // Should not throw, but should have empty rows/headers
    expect(result.config.models[0].rows).toEqual([]);
    expect(result.config.models[0].headers).toEqual(['']);
  });

  test('hotspot: should handle no hotspot choices', () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
      </responseDeclaration>
      <itemBody>
        <hotspotInteraction responseIdentifier="RESPONSE">
          <img src="test.png" width="400" height="300"/>
        </hotspotInteraction>
      </itemBody>
    `);

    const result = transformHotspot(qtiXml, 'hs-no-choices');

    // Should not throw, but hotspots may be undefined or empty
    const hotspots = result.config.models[0].hotspots;
    expect(hotspots === undefined || hotspots.length === 0).toBe(true);
  });
});

describe('Error Handling - Invalid Response Declarations', () => {
  test('should handle missing correctResponse gracefully', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
      </responseDeclaration>
      <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="A">Choice A</simpleChoice>
          <simpleChoice identifier="B">Choice B</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-no-correct');

    // Should have empty correctResponse
    expect(result.config.models[0].correctResponse).toEqual([]);
    expect(result.config.models[0].choices.every((c: any) => !c.correct)).toBe(true);
  });

  test('should handle empty correctResponse', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="A">Choice A</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-empty-correct');

    expect(result.config.models[0].correctResponse).toEqual([]);
  });
});

describe('Error Handling - Invalid Identifiers', () => {
  test('should handle missing response identifier', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <choiceInteraction>
          <simpleChoice identifier="A">Choice A</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);

    // Should handle gracefully (transformer may use default or throw)
    const result = await transformMultipleChoice(itemElement, 'mc-no-response-id');

    // Basic structure should still be created
    expect(result.id).toBe('mc-no-response-id');
    expect(result.config.models).toHaveLength(1);
  });

  test('should handle missing choice identifiers', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice>No identifier</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-no-choice-id');

    // Should handle gracefully, may have generated ID or skip
    expect(result.config.models[0].choices.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Error Handling - Special Characters and Encoding', () => {
  test('should handle HTML entities correctly', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <p>Use &lt; and &gt; symbols</p>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="A">&amp; &quot; &apos;</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-entities');

    // Entities are preserved in the HTML output
    expect(result.config.models[0].prompt).toContain('Use &lt; and &gt; symbols');
    expect(result.config.models[0].choices[0].label).toContain('&amp;');
  });

  test('should handle Unicode characters', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <p>Symbols: π ∑ ∫ √ ≠ ≤ ≥</p>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="A">π = 3.14159...</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-unicode');

    expect(result.config.models[0].prompt).toContain('π');
    expect(result.config.models[0].choices[0].label).toContain('π');
  });
});

describe('Error Handling - Edge Cases', () => {
  test('should handle very long prompt text', async () => {
    const longText = 'A'.repeat(10000);
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <p>${longText}</p>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="A">Choice</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-long-prompt');

    expect(result.config.models[0].prompt.length).toBeGreaterThan(9000);
  });

  test('should handle deeply nested HTML in prompt', async () => {
    const nestedHtml = '<div><p><span><strong><em>Nested</em></strong></span></p></div>';
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        ${nestedHtml}
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="A">Choice</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-nested-html');

    expect(result.config.models[0].prompt).toContain('Nested');
  });

  test('should handle whitespace-only prompt', async () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse>
          <value>A</value>
        </correctResponse>
      </responseDeclaration>
      <itemBody>
        <p>   </p>
        <choiceInteraction responseIdentifier="RESPONSE">
          <simpleChoice identifier="A">Choice</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = await transformMultipleChoice(itemElement, 'mc-whitespace');

    // Prompt may be empty or contain whitespace
    expect(typeof result.config.models[0].prompt).toBe('string');
  });
});
