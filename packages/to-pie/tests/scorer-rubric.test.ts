/**
 * Scorer rubric carriage
 *
 * Scorer rubricBlocks reach the instructor as `teacherInstructions` on one model of the converted
 * item, whatever its interactions, or the conversion warns that they were not carried.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { PieItem, TransformOutput } from '@pie-qti/transform-types';
import { QtiToPiePlugin } from '../src';
import { SCORER_RUBRIC_NOT_CARRIED } from '../src/utils/scorer-rubric';

function fixture(name: string): string {
  return readFileSync(
    new URL(`./fixtures/conversion-fidelity/${name}.xml`, import.meta.url),
    'utf-8'
  );
}

async function convert(qtiXml: string): Promise<TransformOutput> {
  return new QtiToPiePlugin().transform({ content: qtiXml, format: 'qti' }, {});
}

function models(output: TransformOutput): Array<Record<string, any>> {
  return output.items.flatMap((item) => (item.content as PieItem).config.models as any[]);
}

function modelOf(output: TransformOutput, packageName: string): Record<string, any> {
  const model = output.items
    .map((item) => item.content as PieItem)
    .flatMap((item) => {
      const elements = item.config.elements as Record<string, string>;
      return (item.config.models as any[]).filter((candidate) =>
        (elements[candidate.element] ?? candidate.element).startsWith(`${packageName}@`)
      );
    })[0];
  if (!model) throw new Error(`No ${packageName} model in the output`);
  return model;
}

function withRubric(id: string, body: string, declarations = ''): string {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${id}" title="${id}" adaptive="false" timeDependent="false">
    ${declarations}
    <itemBody>${body}</itemBody>
  </assessmentItem>`;
}

const ETE_DECLARATION =
  '<responseDeclaration identifier="ETE" cardinality="single" baseType="string"/>';
const CHOICE_DECLARATION = `<responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>`;
const CHOICE = `<choiceInteraction responseIdentifier="CHOICE" maxChoices="1">
    <simpleChoice identifier="A">Evaporation</simpleChoice>
    <simpleChoice identifier="B">Erosion</simpleChoice>
  </choiceInteraction>`;

describe('scorer rubricBlock content', () => {
  test('reaches the instructor on an extended-response item', async () => {
    const output = await convert(fixture('extended-response-scorer-rubric'));
    const model = modelOf(output, '@pie-element/extended-text-entry');

    expect(model.teacherInstructions).toContain('Correct Answer(s):');
    expect(model.teacherInstructions).toMatch(/<img src="answer-key.gif" alt=""/);
    expect(model.teacherInstructionsEnabled).toBe(true);
    expect(model.prompt).not.toContain('Correct Answer');
    expect(models(output)).toHaveLength(1);
  });

  test.each([
    ['choice-scorer-rationale', '@pie-element/multiple-choice', 'Correct. Mercury orbits closest'],
    [
      'text-entry-scorer-rubric-table',
      '@pie-element/explicit-constructed-response',
      '<td><strong>Evidence of Mastery</strong></td>',
    ],
    ['hotspot-scorer-answer', '@pie-element/hotspot', '<p>Ten frame with 8</p>'],
  ])('reaches the instructor on %s', async (name, packageName, expected) => {
    const output = await convert(fixture(name));
    const model = modelOf(output, packageName);

    expect(model.teacherInstructions).toContain(expected);
    expect(model.teacherInstructionsEnabled).toBe(true);
    expect(JSON.stringify(model.prompt ?? '')).not.toContain(expected);
    expect((output.warnings ?? []).map((warning) => warning.code)).not.toContain(
      SCORER_RUBRIC_NOT_CARRIED
    );
  });

  test('comes from every block whose view list names scorer but not candidate', async () => {
    const output = await convert(
      withRubric(
        'cf-081',
        `<p>Describe the water cycle.</p>
        <extendedTextInteraction responseIdentifier="ETE"/>
        <rubricBlock view="scorer tutor"><p>2 points: names evaporation and condensation.</p></rubricBlock>
        <rubricBlock view="author proctor scorer testConstructor tutor">Accept precipitation.</rubricBlock>
        <rubricBlock view="candidate scorer"><p>Shown to the learner.</p></rubricBlock>`,
        ETE_DECLARATION
      )
    );

    expect(modelOf(output, '@pie-element/extended-text-entry').teacherInstructions).toBe(
      '<div><p>2 points: names evaporation and condensation.</p></div><div>Accept precipitation.</div>'
    );
  });

  test('appears once when a second block repeats part of the first', async () => {
    const output = await convert(
      withRubric(
        'cf-083',
        `<p>Which process turns water into vapour?</p>${CHOICE}
        <rubricBlock view="author scorer" use="rationales"><div>A is correct: heat turns water into vapour.</div><div>B moves rock, not water.</div></rubricBlock>
        <rubricBlock view="scorer" use="correct-choice-rationale"><div>A is correct: heat turns water into vapour.</div></rubricBlock>`,
        CHOICE_DECLARATION
      )
    );

    expect(modelOf(output, '@pie-element/multiple-choice').teacherInstructions).toBe(
      '<div>A is correct: heat turns water into vapour.</div><div>B moves rock, not water.</div>'
    );
  });

  test('goes once to the hand-scored model of a composite item', async () => {
    const output = await convert(
      withRubric(
        'cf-084',
        `<p>Which process turns water into vapour?</p>${CHOICE}
        <p>Explain your answer.</p>
        <extendedTextInteraction responseIdentifier="ETE"/>
        <rubricBlock view="scorer"><p>1 point for naming heat as the cause.</p></rubricBlock>`,
        `${CHOICE_DECLARATION}${ETE_DECLARATION}`
      )
    );
    const carrying = models(output).filter((model) =>
      String(model.teacherInstructions ?? '').includes('naming heat')
    );

    expect(carrying).toHaveLength(1);
    expect(carrying[0]).toBe(modelOf(output, '@pie-element/extended-text-entry'));
  });

  test('leaves teacher instructions empty when the item has none', async () => {
    const output = await convert(
      withRubric(
        'cf-082',
        '<p>Describe the water cycle.</p><extendedTextInteraction responseIdentifier="ETE"/>',
        ETE_DECLARATION
      )
    );
    const model = modelOf(output, '@pie-element/extended-text-entry');

    expect(model.teacherInstructions).toBe('');
    expect(model.teacherInstructionsEnabled).toBeUndefined();
  });

  test('reaches the instructor on an item whose embedded PIE source is not used', async () => {
    const sourceModel = {
      id: 'cf-086',
      config: {
        models: [
          { id: 'ete', element: 'extended-text-entry', teacherInstructions: 'As authored.' },
        ],
        elements: { 'extended-text-entry': '@pie-element/extended-text-entry@latest' },
        markup: '<extended-text-entry id="ete"></extended-text-entry>',
      },
    };
    const output =
      await convert(`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:pie="https://github.com/pie-framework/pie-elements" identifier="cf-086" title="cf-086" adaptive="false" timeDependent="false">
      ${ETE_DECLARATION}
      <itemBody>
        <extendedTextInteraction responseIdentifier="ETE"/>
        <rubricBlock view="scorer"><p>As authored.</p></rubricBlock>
      </itemBody>
      <pie:sourceModel><![CDATA[${JSON.stringify(sourceModel)}]]></pie:sourceModel>
    </assessmentItem>`);

    expect(output.warnings?.map((warning) => warning.code)).toContain('PIE_SOURCE_STALE');
    expect(modelOf(output, '@pie-element/extended-text-entry').teacherInstructions).toBe(
      '<p>As authored.</p>'
    );
  });

  test('is reported when no element in the item shows teacher instructions', async () => {
    const output = await convert(
      withRubric(
        'cf-085',
        `<matchInteraction responseIdentifier="MATCH" maxAssociations="2">
          <prompt>Match each tool to its use.</prompt>
          <simpleMatchSet>
            <simpleAssociableChoice identifier="hammer" matchMax="1">Hammer</simpleAssociableChoice>
            <simpleAssociableChoice identifier="saw" matchMax="1">Saw</simpleAssociableChoice>
          </simpleMatchSet>
          <simpleMatchSet>
            <simpleAssociableChoice identifier="nail" matchMax="1">Drive a nail</simpleAssociableChoice>
            <simpleAssociableChoice identifier="cut" matchMax="1">Cut a board</simpleAssociableChoice>
          </simpleMatchSet>
        </matchInteraction>
        <rubricBlock view="scorer"><p>1 point per correct pair.</p></rubricBlock>`,
        `<responseDeclaration identifier="MATCH" cardinality="multiple" baseType="directedPair">
          <correctResponse><value>hammer nail</value><value>saw cut</value></correctResponse>
        </responseDeclaration>`
      )
    );

    expect(models(output).map((model) => model.teacherInstructions ?? '')).not.toContain(
      '<p>1 point per correct pair.</p>'
    );
    expect(output.warnings).toContainEqual(
      expect.objectContaining({ itemId: 'cf-085', code: SCORER_RUBRIC_NOT_CARRIED })
    );
  });
});
