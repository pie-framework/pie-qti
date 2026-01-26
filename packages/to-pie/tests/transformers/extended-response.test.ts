/**
 * Extended Response Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformExtendedResponse } from '../../src/transformers/extended-response';
import { createQtiWrapper, parseQtiItem } from '../test-utils.js';

const sampleExtendedResponseQti = createQtiWrapper(`
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
  </responseDeclaration>
  <itemBody>
    <p>Explain the significance of the American Revolution.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="10">
      <prompt>Write your answer below:</prompt>
    </extendedTextInteraction>
  </itemBody>
`, 'er-001', 'Essay Question');

const sampleFormulaEntryQti = createQtiWrapper(`
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float">
    <correctResponse>
      <value>3.14159</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Enter the value of pi to 5 decimal places.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLength="10">
    </extendedTextInteraction>
  </itemBody>
`, 'fe-001', 'Math Formula');

const sampleWithCharacterLimitQti = createQtiWrapper(`
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
  </responseDeclaration>
  <itemBody>
    <p>In 200 characters or less, describe photosynthesis.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="3" expectedLength="200">
    </extendedTextInteraction>
  </itemBody>
`, 'er-limit-001', 'Short Answer');

const sampleWithHtmlPromptQti = createQtiWrapper(`
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
  </responseDeclaration>
  <itemBody>
    <p>Discuss the relationship between <strong>force</strong> and <em>acceleration</em>.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="5">
      <prompt>Consider <strong>Newton's Second Law</strong> in your answer.</prompt>
    </extendedTextInteraction>
  </itemBody>
`, 'er-html-001', 'Formatted Question');

describe('transformExtendedResponse', () => {
  test('should transform Extended Response QTI to PIE extended-text-entry', async () => {
    const itemElement = parseQtiItem(sampleExtendedResponseQti);

    const result = await transformExtendedResponse(itemElement, 'er-001');

    // Verify basic structure
    expect(result.id).toBe('er-001');
    expect(result.uuid).toBeDefined();
    expect(result.config).toBeDefined();
    expect(result.metadata?.searchMetaData.title).toBe('Essay Question');
    expect(result.metadata?.searchMetaData.itemType).toBe('ER');
    expect(result.metadata?.searchMetaData.source).toBe('qti22');

    // Verify PIE element configuration
    expect(result.config.elements['extended-text-entry']).toBe('@pie-element/extended-text-entry@latest');
    expect(result.config.models.length).toBe(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/extended-text-entry');
    expect(model.prompt).toContain('Explain the significance');
    expect(model.mathInput).toBe(false);
    expect(model.height).toBe('200px'); // 10 lines * 20px
    expect(model.width).toBe('500px');
    expect(model.expectedLines).toBe(10);
  });

  test('should transform Formula Entry (math) QTI to PIE with mathInput', async () => {
    const itemElement = parseQtiItem(sampleFormulaEntryQti);

    const result = await transformExtendedResponse(itemElement, 'fe-001');

    expect(result.metadata?.searchMetaData.itemType).toBe('FE');

    const model = result.config.models[0];
    expect(model.mathInput).toBe(true);
    expect(model.equationEditor).toBe('everything');
    expect(model.maxLength).toBe(10);
  });

  test('should handle character limit from expectedLength', async () => {
    const itemElement = parseQtiItem(sampleWithCharacterLimitQti);

    const result = await transformExtendedResponse(itemElement, 'er-limit-001');

    const model = result.config.models[0];
    expect(model.maxLength).toBe(200);
    expect(model.expectedLines).toBe(3);
    expect(model.height).toBe('100px'); // Max of 3*20=60 and 100
  });

  test('should preserve HTML in prompt', async () => {
    const itemElement = parseQtiItem(sampleWithHtmlPromptQti);

    const result = await transformExtendedResponse(itemElement, 'er-html-001');

    const model = result.config.models[0];
    expect(model.prompt).toContain('<strong>force</strong>');
    expect(model.prompt).toContain('<em>acceleration</em>');
  });

  test('should support custom equation editor option', async () => {
    const itemElement = parseQtiItem(sampleFormulaEntryQti);

    const result = await transformExtendedResponse(itemElement, 'fe-001', {
      equationEditor: 'Grade 6 - 7',
    });

    const model = result.config.models[0];
    expect(model.equationEditor).toBe('Grade 6 - 7');
  });

  test('should support maxScore in metadata', async () => {
    const itemElement = parseQtiItem(sampleExtendedResponseQti);

    const result = await transformExtendedResponse(itemElement, 'er-001', {
      maxScore: 4,
    });

    expect(result.metadata?.searchMetaData.maxScore).toBe(4);
  });

  test('should throw error if no extendedTextInteraction found', async () => {
    const invalidQti = createQtiWrapper(`
      <itemBody>
        <p>No interaction here</p>
      </itemBody>
    `, 'invalid-001', 'Invalid');

    const itemElement = parseQtiItem(invalidQti);

    await expect(
      transformExtendedResponse(itemElement, 'invalid-001')
    ).rejects.toThrow(/Missing required interaction: extendedTextInteraction/);
  });

  test('should handle missing prompt gracefully', async () => {
    const qtiNoPrompt = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
      </responseDeclaration>
      <itemBody>
        <extendedTextInteraction responseIdentifier="RESPONSE">
        </extendedTextInteraction>
      </itemBody>
    `, 'er-no-prompt-001', 'No Prompt');

    const itemElement = parseQtiItem(qtiNoPrompt);

    const result = await transformExtendedResponse(itemElement, 'er-no-prompt-001');

    const model = result.config.models[0];
    expect(model.prompt).toBe('');
  });

  test('should use default height when expectedLines is not specified', async () => {
    const qtiNoLines = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
      </responseDeclaration>
      <itemBody>
        <p>Your answer:</p>
        <extendedTextInteraction responseIdentifier="RESPONSE">
        </extendedTextInteraction>
      </itemBody>
    `, 'er-no-lines-001', 'No Lines');

    const itemElement = parseQtiItem(qtiNoLines);

    const result = await transformExtendedResponse(itemElement, 'er-no-lines-001');

    const model = result.config.models[0];
    expect(model.height).toBe('200px');
    expect(model.expectedLines).toBeUndefined();
  });
});
