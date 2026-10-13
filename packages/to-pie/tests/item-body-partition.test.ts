/**
 * Item body partition
 *
 * Passages leave the item body before the interaction transformers run: a referenced passage
 * becomes the item's passage by manifest resource identifier, an inline passage becomes a passage
 * model, and neither appears in a prompt. What the partition cannot resolve stays and is reported.
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem, TransformOutput } from '@pie-qti/transform-types';
import { QtiToPiePlugin, transformQtiPackageToPie } from '../src';
import { PASSAGE_UNRESOLVED } from '../src/utils/unresolved-passages';

const CHOICE_DECLARATION = `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>`;
const CHOICE = `<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <prompt>What is the river's name?</prompt>
    <simpleChoice identifier="A">Nile</simpleChoice>
    <simpleChoice identifier="B">Amazon</simpleChoice>
  </choiceInteraction>`;

function choiceItem(body: string, beforeBody = ''): string {
  return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ITEM-1" title="Item 1" adaptive="false" timeDependent="false">
  ${CHOICE_DECLARATION}
  ${beforeBody}
  <itemBody>${body}</itemBody>
</assessmentItem>`;
}

/** Converts `items/item.xml` in a package holding the given passage resources. */
async function convertInPackage(
  itemXml: string,
  passages: Array<{ identifier: string; type: string; href: string }>,
  dependencies = passages.map((passage) => passage.identifier)
) {
  const files = new Map<string, string>([['items/item.xml', itemXml]]);
  for (const passage of passages) {
    files.set(decodeURI(passage.href), '<html><body><p>The river.</p></body></html>');
  }
  const manifestXml = `<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="pkg">
  <resources>
    <resource identifier="ITEM-1" type="imsqti_item_xmlv2p2" href="items/item.xml">
      <file href="items/item.xml"/>
      ${dependencies.map((dependency) => `<dependency identifierref="${dependency}"/>`).join('')}
    </resource>
    ${passages
      .map(
        (passage) =>
          `<resource identifier="${passage.identifier}" type="${passage.type}" href="${passage.href}"><file href="${passage.href}"/></resource>`
      )
      .join('')}
  </resources>
</manifest>`;
  const result = await transformQtiPackageToPie({
    packageId: 'pkg',
    manifestXml,
    fileAccess: {
      readText: async (packagePath) => files.get(packagePath) ?? null,
      listFiles: async () => [...files.keys()],
    },
  });
  const output = result.itemOutputs[0]!;
  return { item: output.items[0]!.content as PieItem, warnings: output.warnings ?? [] };
}

async function convert(qtiXml: string, plugin = new QtiToPiePlugin()) {
  const output: TransformOutput = await plugin.transform({ content: qtiXml, format: 'qti' }, {});
  return { item: output.items[0]!.content as PieItem, warnings: output.warnings ?? [] };
}

const READING = { identifier: 'PASSAGE-1', type: 'webcontent', href: 'passages/reading.html' };
const STIMULUS = {
  identifier: 'STIMULUS-1',
  type: 'imsqti_stimulus_xmlv2p2',
  href: 'passages/stimulus.xml',
};

function models(item: PieItem): Array<Record<string, any>> {
  return item.config.models as Array<Record<string, any>>;
}

function unresolved(warnings: TransformOutput['warnings'] & {}) {
  return warnings.filter((warning) => warning.code === PASSAGE_UNRESOLVED);
}

describe('a passage object', () => {
  test('becomes the item passage by manifest identifier and leaves the prompt', async () => {
    const { item, warnings } = await convertInPackage(
      choiceItem(`<object data="../passages/reading.html" type="text/html"/>${CHOICE}`),
      [READING]
    );

    expect(item.passage).toBe('PASSAGE-1');
    expect(item.metadata?.qtiPassageReferences).toEqual([
      { identifier: 'PASSAGE-1', href: '../passages/reading.html', via: 'object' },
    ]);
    expect(models(item).map((model) => model.element)).toEqual(['multiple-choice']);
    expect(models(item)[0]!.prompt).toBe("What is the river's name?");
    expect(unresolved(warnings)).toEqual([]);
  });

  test('resolves an href that differs from the manifest in case and percent-encoding', async () => {
    const { item } = await convertInPackage(
      choiceItem(`<object data="../Passages/Reading%20One.HTML" type="text/html"/>${CHOICE}`),
      [{ ...READING, href: 'passages/reading one.html' }]
    );

    expect(item.passage).toBe('PASSAGE-1');
  });

  test('stays in the prompt and is reported when it names no passage resource', async () => {
    const { item, warnings } = await convertInPackage(
      choiceItem(`<object data="../passages/missing.html" type="text/html"/>${CHOICE}`),
      [READING],
      []
    );

    expect(item.passage).toBeUndefined();
    expect(models(item)[0]!.prompt).toContain('<object data="../passages/missing.html"');
    expect(unresolved(warnings).map((warning) => (warning as any).path)).toEqual([
      '../passages/missing.html',
    ]);
  });

  test('that embeds a figure stays where it is, unreported', async () => {
    const { item, warnings } = await convertInPackage(
      choiceItem(`<p><object data="../images/river.svg" type="image/svg+xml"/></p>${CHOICE}`),
      [READING],
      []
    );

    expect(item.passage).toBeUndefined();
    expect(models(item)[0]!.prompt).toContain('<object data="../images/river.svg"');
    expect(unresolved(warnings)).toEqual([]);
  });
});

describe('a stimulus reference', () => {
  test('becomes the item passage, and the item still converts as its interaction', async () => {
    const { item, warnings } = await convertInPackage(
      choiceItem(
        CHOICE,
        '<assessmentStimulusRef identifier="S1" href="../passages/stimulus.xml"/>'
      ),
      [STIMULUS]
    );

    expect(item.passage).toBe('STIMULUS-1');
    expect(item.metadata?.qtiPassageReferences).toEqual([
      {
        identifier: 'STIMULUS-1',
        href: '../passages/stimulus.xml',
        via: 'assessmentStimulusRef',
      },
    ]);
    expect(models(item).map((model) => model.element)).toEqual(['multiple-choice']);
    expect(unresolved(warnings)).toEqual([]);
  });

  test('that names no passage resource is reported', async () => {
    const { item, warnings } = await convert(
      choiceItem(CHOICE, '<assessmentStimulusRef identifier="S1" href="../passages/stimulus.xml"/>')
    );

    expect(item.passage).toBeUndefined();
    expect(unresolved(warnings)).toEqual([
      {
        itemId: 'ITEM-1',
        code: PASSAGE_UNRESOLVED,
        path: '../passages/stimulus.xml',
        message:
          "Passage ../passages/stimulus.xml is not a passage resource of the package: the item's stimulus reference was not carried.",
      } as never,
    ]);
  });
});

describe('an inline passage', () => {
  const STIMULUS_BODY = `<stimulus><p>The Nile flows north.</p></stimulus>${CHOICE}`;

  test('becomes a passage model that leads the item, with an id from its content', async () => {
    const { item } = await convert(choiceItem(STIMULUS_BODY));
    const { item: again } = await convert(choiceItem(STIMULUS_BODY));
    const [passage, choice] = models(item);

    expect(passage).toMatchObject({
      element: 'passage',
      passages: [{ title: '', text: '<p>The Nile flows north.</p>' }],
    });
    expect(passage!.id).toBe(models(again)[0]!.id);
    expect(choice!.prompt).toBe("What is the river's name?");
    expect(item.config.markup!.indexOf('<passage')).toBeLessThan(
      item.config.markup!.indexOf('<multiple-choice')
    );
  });

  test('is claimed by a plugin rule', async () => {
    const plugin = new QtiToPiePlugin({
      inlinePassageRules: [
        {
          id: 'reading-class',
          matches: (element) => element.getAttribute('class') === 'reading',
        },
      ],
    });
    const { item } = await convert(
      choiceItem(`<div class="reading"><p>The Nile flows north.</p></div>${CHOICE}`),
      plugin
    );

    expect(models(item).map((model) => model.element)).toEqual(['passage', 'multiple-choice']);
    expect(models(item)[1]!.prompt).toBe("What is the river's name?");
  });

  test('reaches a source-profile handler that delegates to a built-in', async () => {
    const profile: any = {
      id: 'delegating-profile',
      version: '1.0.0',
      detectItem: () => ({ scope: 'item', confidence: 1, evidence: [] }),
      itemHandlers: [
        {
          id: 'choice-by-plan',
          canHandle: () => true,
          transform: async (context: any, delegate: any) => {
            const result = await delegate.transformWithBuiltIn('builtin.choice', {
              interactionType: 'choiceInteraction',
              interactionUnit: context.qtiItemBodyPlan.units[0],
            });
            return {
              items: [{ content: result.content, format: 'pie' }],
              format: 'pie',
              metadata: { sourceFormat: 'qti22', targetFormat: 'pie' },
            };
          },
        },
      ],
    };
    const { item } = await convert(
      choiceItem(STIMULUS_BODY),
      new QtiToPiePlugin({ sourceProfiles: [profile] })
    );

    expect(models(item)[0]).toMatchObject({
      passages: [{ text: '<p>The Nile flows north.</p>' }],
    });
    expect(models(item)[1]!.prompt).toBe("What is the river's name?");
  });
});

describe('rubricBlocks', () => {
  test('the candidate sees stay in a composite and the rest leave it', async () => {
    const { item } =
      await convert(`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ITEM-2" title="Item 2" adaptive="false" timeDependent="false">
  ${CHOICE_DECLARATION}
  <responseDeclaration identifier="TEXT" cardinality="single" baseType="string">
    <correctResponse><value>6650</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <rubricBlock view="candidate"><p>Use the map.</p></rubricBlock>
    ${CHOICE}
    <p>Length in km: <textEntryInteraction responseIdentifier="TEXT"/></p>
    <rubricBlock view="scorer"><p>Accept 6,650 or 6,695.</p></rubricBlock>
  </itemBody>
</assessmentItem>`);

    expect(item.config.markup).toContain('<div><p>Use the map.</p></div>');
    expect(item.config.markup).not.toContain('Accept 6,650');
    expect(item.config.markup).not.toContain('rubricBlock');
  });
});

describe('content after a sole interaction', () => {
  test('follows the interaction in the item markup', async () => {
    const { item } = await convert(
      choiceItem(`<p>Read the map.</p>${CHOICE}<p>Source: atlas, 2019.</p>`)
    );

    expect(item.config.markup).toMatch(
      /^<multiple-choice id="[^"]+"><\/multiple-choice><p>Source: atlas, 2019\.<\/p>$/
    );
    expect(models(item)[0]!.prompt).not.toContain('atlas');
  });
});
