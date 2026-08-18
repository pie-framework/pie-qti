import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import { serializeChildrenWithReplacements } from '../../src/utils/markup-extraction';

describe('serializeChildrenWithReplacements', () => {
  test('replaces nested interactions while preserving surrounding prose wrappers', () => {
    const document = parse(`
      <itemBody>
        <div class="stem">
          <p>The answer is <textEntryInteraction responseIdentifier="TEXT"/>.</p>
        </div>
        <choiceInteraction responseIdentifier="CHOICE">
          <simpleChoice identifier="A">A</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);
    const itemBody = document.getElementsByTagName('itemBody')[0]!;
    const textEntry = itemBody.getElementsByTagName('textEntryInteraction')[0]!;
    const choice = itemBody.getElementsByTagName('choiceInteraction')[0]!;

    const markup = serializeChildrenWithReplacements(itemBody, {
      replacements: new Map([
        [textEntry, '{{0}}'],
        [choice, '<multiple-choice id="choice-1"></multiple-choice>'],
      ]),
    });

    expect(markup).toContain('<div class="stem"><p>The answer is {{0}}.</p></div>');
    expect(markup).toContain('<multiple-choice id="choice-1"></multiple-choice>');
    expect(markup).not.toContain('textEntryInteraction');
    expect(markup).not.toContain('choiceInteraction');
  });

  test('omits prompt and feedback scaffolding when requested', () => {
    const document = parse(`
      <itemBody>
        <prompt>Read this.</prompt>
        <p>Choose one.</p>
        <feedbackInline outcomeIdentifier="FEEDBACK" identifier="correct">Correct.</feedbackInline>
      </itemBody>
    `);
    const itemBody = document.getElementsByTagName('itemBody')[0]!;

    const markup = serializeChildrenWithReplacements(itemBody, {
      omit: (element) => ['prompt', 'feedbackinline'].includes(element.tagName.toLowerCase()),
    });

    expect(markup).toBe('<p>Choose one.</p>');
  });
});
