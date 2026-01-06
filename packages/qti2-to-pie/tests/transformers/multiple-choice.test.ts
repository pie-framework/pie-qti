/**
 * Multiple Choice Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformMultipleChoice } from '../../src/transformers/multiple-choice';
import { createQtiWrapper, createResponseDeclaration, parseQtiItem } from '../test-utils.js';

const sampleSingleSelectQti = createQtiWrapper(`
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
  <itemBody>
    <p>What is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false">
      <simpleChoice identifier="choiceA">4</simpleChoice>
      <simpleChoice identifier="choiceB">3</simpleChoice>
      <simpleChoice identifier="choiceC">5</simpleChoice>
      <simpleChoice identifier="choiceD">22</simpleChoice>
    </choiceInteraction>
  </itemBody>
`, 'mc-single-001', 'Basic Math');

const sampleMultipleSelectQti = createQtiWrapper(`
  ${createResponseDeclaration('RESPONSE', 'multiple', ['choiceA', 'choiceC'])}
  <itemBody>
    <p>Which of the following are prime numbers?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="3" shuffle="true">
      <simpleChoice identifier="choiceA">2</simpleChoice>
      <simpleChoice identifier="choiceB">4</simpleChoice>
      <simpleChoice identifier="choiceC">3</simpleChoice>
      <simpleChoice identifier="choiceD">6</simpleChoice>
    </choiceInteraction>
  </itemBody>
`, 'mc-multi-001', 'Select Multiple');

const sampleWithHtmlContentQti = createQtiWrapper(`
  ${createResponseDeclaration('RESPONSE', 'single', ['choiceB'])}
  <itemBody>
    <p>What is the value of <strong>x</strong> if <em>x + 5 = 10</em>?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false">
      <simpleChoice identifier="choiceA"><em>10</em></simpleChoice>
      <simpleChoice identifier="choiceB"><strong>5</strong></simpleChoice>
      <simpleChoice identifier="choiceC">15</simpleChoice>
    </choiceInteraction>
  </itemBody>
`, 'mc-html-001', 'Math with HTML');

describe('transformMultipleChoice', () => {
  test('should transform single-select QTI to PIE multiple-choice', async () => {
    const itemElement = parseQtiItem(sampleSingleSelectQti);

    const result = await transformMultipleChoice(itemElement, 'mc-single-001');

    // Verify basic structure
    expect(result.id).toBe('mc-single-001');
    expect(result.uuid).toBeDefined();
    expect(result.config).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.searchMetaData?.title).toBe('Basic Math');
    expect(result.metadata?.searchMetaData?.itemType).toBe('MC');
    expect(result.metadata?.searchMetaData?.source).toBe('qti22');

    // Verify PIE element configuration
    expect(result.config.elements['multiple-choice']).toBe('@pie-element/multiple-choice@latest');
    expect(result.config.models.length).toBe(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/multiple-choice');
    expect(model.prompt).toBe('What is 2 + 2?');
    expect(model.choiceMode).toBe('radio');
    expect(model.shuffle).toBe(false);
    expect(model.partialScoring).toBe(false);

    // Verify choices
    expect(model.choices.length).toBe(4);
    expect(model.choices[0]).toEqual({
      label: '4',
      value: 'choiceA',
      correct: true,
    });
    expect(model.choices[1]).toEqual({
      label: '3',
      value: 'choiceB',
      correct: false,
    });

    // Verify correct response
    expect(model.correctResponse).toEqual(['choiceA']);
  });

  test('should transform multiple-select QTI to PIE checkbox mode', async () => {
    const itemElement = parseQtiItem(sampleMultipleSelectQti);

    const result = await transformMultipleChoice(itemElement, 'mc-multi-001');

    expect(result.metadata?.searchMetaData?.itemType).toBe('MCA');

    const model = result.config.models[0];
    expect(model.choiceMode).toBe('checkbox');
    expect(model.shuffle).toBe(true);

    // Verify multiple correct answers
    expect(model.correctResponse).toEqual(['choiceA', 'choiceC']);
    expect(model.choices[0].correct).toBe(true);
    expect(model.choices[1].correct).toBe(false);
    expect(model.choices[2].correct).toBe(true);
    expect(model.choices[3].correct).toBe(false);
  });

  test('should handle HTML content in prompt and choices', async () => {
    const itemElement = parseQtiItem(sampleWithHtmlContentQti);

    const result = await transformMultipleChoice(itemElement, 'mc-html-001');

    const model = result.config.models[0];

    // Verify HTML is preserved but cleaned
    expect(model.prompt).toContain('<strong>x</strong>');
    expect(model.prompt).toContain('<em>x + 5 = 10</em>');

    expect(model.choices[0].label).toContain('<em>10</em>');
    expect(model.choices[1].label).toContain('<strong>5</strong>');
    expect(model.choices[1].correct).toBe(true);
  });

  test('should support partial scoring option', async () => {
    const itemElement = parseQtiItem(sampleMultipleSelectQti);

    const result = await transformMultipleChoice(itemElement, 'mc-multi-001', {
      partialScoring: true,
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
  });

  test('should throw error if no choiceInteraction found', async () => {
    const invalidQti = createQtiWrapper(`
      <itemBody>
        <p>No interaction here</p>
      </itemBody>
    `, 'invalid-001', 'Invalid');

    const itemElement = parseQtiItem(invalidQti);

    await expect(
      transformMultipleChoice(itemElement, 'invalid-001')
    ).rejects.toThrow(/Missing required interaction: choiceInteraction/);
  });

  test('should handle missing prompt gracefully', async () => {
    const qtiNoPrompt = createQtiWrapper(`
      ${createResponseDeclaration('RESPONSE', 'single', ['choiceA'])}
      <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <simpleChoice identifier="choiceA">Option A</simpleChoice>
          <simpleChoice identifier="choiceB">Option B</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `, 'mc-no-prompt-001', 'No Prompt');

    const itemElement = parseQtiItem(qtiNoPrompt);

    const result = await transformMultipleChoice(itemElement, 'mc-no-prompt-001');

    const model = result.config.models[0];
    expect(model.prompt).toBe('');
  });

  test('should handle missing correctResponse gracefully', async () => {
    const qtiNoCorrect = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
      </responseDeclaration>
      <itemBody>
        <p>Which one?</p>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <simpleChoice identifier="choiceA">Option A</simpleChoice>
          <simpleChoice identifier="choiceB">Option B</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `, 'mc-no-correct-001', 'No Correct Response');

    const itemElement = parseQtiItem(qtiNoCorrect);

    const result = await transformMultipleChoice(itemElement, 'mc-no-correct-001');

    const model = result.config.models[0];
    expect(model.correctResponse).toEqual([]);
    expect(model.choices.every((c: { correct: boolean; }) => c.correct === false)).toBe(true);
  });
});
