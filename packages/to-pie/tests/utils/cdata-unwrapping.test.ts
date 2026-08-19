/**
 * CDATA unwrapping conformance tests
 *
 * ExamView-style QTI 2.1 exports wrap item XHTML in CDATA sections, and
 * `node-html-parser` returns those delimiters as part of `innerHTML`. Every
 * markup field a PIE model stores has to come out of the converter without
 * them: a browser reads `<![CDATA[` as a bogus comment and renders the closing
 * `]]>` as visible text, so a leak is visible to the learner.
 */

import { describe, expect, test } from 'bun:test';
import { type HTMLElement, parse } from 'node-html-parser';
import { unwrapCdataSections } from '../../src/utils/cdata';
import { extractInlineStimulus, extractRubricBlock } from '../../src/utils/passage-extraction';
import { transformMultipleChoice } from '../../src/transformers/multiple-choice';

function parseItem(qtiXml: string): HTMLElement {
  const doc = parse(qtiXml, { lowerCaseTagName: false, comment: false });
  const itemElement =
    doc.querySelector('assessmentItem') || doc.getElementsByTagName('assessmentItem')[0];
  if (!itemElement) throw new Error('No assessmentItem element found in QTI XML');
  return itemElement;
}

/** Every CDATA delimiter, in either half, that must not survive conversion. */
function delimiters(markup: string): string[] {
  return markup.match(/<!\[CDATA\[|\]\]>/g) ?? [];
}

const cdataChoiceItem = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="cdata-001" title="Question_01">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>C2</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <div><![CDATA[<strong>Read the selections, and choose the best answer.</strong>]]></div>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="C1"><![CDATA[<em>An old green house.</em>]]></simpleChoice>
      <simpleChoice identifier="C2"><![CDATA[No trees to climb.]]></simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe('multiple-choice conversion', () => {
  test('unwraps CDATA in the prompt and every choice label', async () => {
    const item = await transformMultipleChoice(parseItem(cdataChoiceItem), 'cdata-001');
    const model = item.config.models[0] as unknown as {
      prompt: string;
      choices: Array<{ label: string }>;
    };

    expect(delimiters(model.prompt)).toEqual([]);
    expect(model.prompt).toContain('<strong>Read the selections, and choose the best answer.');

    for (const choice of model.choices) {
      expect(delimiters(choice.label)).toEqual([]);
    }
    expect(model.choices[0]?.label).toContain('<em>An old green house.</em>');
    expect(model.choices[1]?.label).toContain('No trees to climb.');
  });
});

describe('passage and rubric extraction', () => {
  test('unwraps CDATA in an explicit stimulus', () => {
    const itemBody = parseItem(`<assessmentItem><itemBody>
      <stimulus><![CDATA[<p>Selection 1: Making a House a Home</p>]]></stimulus>
    </itemBody></assessmentItem>`).getElementsByTagName('itemBody')[0];

    const passage = extractInlineStimulus(itemBody!);
    const text = passage?.passages[0]?.text ?? '';

    expect(delimiters(text)).toEqual([]);
    expect(text).toContain('<p>Selection 1: Making a House a Home</p>');
  });

  test('unwraps CDATA in a scorer rubricBlock', () => {
    const item = parseItem(`<assessmentItem>
      <itemBody><p>Question.</p></itemBody>
      <rubricBlock view="scorer"><![CDATA[<p>Award 1 point for evidence.</p>]]></rubricBlock>
    </assessmentItem>`);

    const rubric = extractRubricBlock(item);

    expect(delimiters(JSON.stringify(rubric))).toEqual([]);
  });
});

describe('unwrapCdataSections', () => {
  test('unwraps every section in a field that holds more than one', () => {
    expect(unwrapCdataSections('<div><![CDATA[<b>a</b>]]></div><div><![CDATA[b]]></div>')).toBe(
      '<div><b>a</b></div><div>b</div>'
    );
  });

  test('leaves an unbalanced marker in authored prose alone', () => {
    expect(unwrapCdataSections('<p>the token ]]> ends a section</p>')).toBe(
      '<p>the token ]]> ends a section</p>'
    );
  });
});
