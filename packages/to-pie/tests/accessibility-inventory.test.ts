/**
 * Accessibility inventory and drop warnings
 *
 * Every accessibility construct in a QTI item is either carried into the PIE item or reported as
 * `QTI_ACCESSIBILITY_NOT_CARRIED`, and every item-body text node reaches the output or a warning.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import type { PieItem, TransformOutput } from '@pie-qti/transform-types';
import { type HTMLElement, type Node, NodeType, parse } from 'node-html-parser';
import { QtiToPiePlugin, transformEbsr, transformHotspot } from '../src';
import {
  ACCESSIBILITY_NOT_CARRIED,
  type AccessibilityNotCarriedWarning,
  auditAccessibility,
  inventoryAccessibility,
} from '../src/utils/accessibility-inventory';
import { PASSAGE_UNRESOLVED } from '../src/utils/unresolved-passages';

const APIP_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
    xmlns:apip="http://www.imsglobal.org/xsd/apip/apipv1p0/imsapip_qtiv1p0"
    xmlns:ssml="http://www.w3.org/2010/10/synthesis"
    identifier="apip-1" title="APIP item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p id="stem" aria-describedby="hint">A doctor visits the farm.</p>
    <p id="hint" class="qti-visually-hidden">Read the stem first.</p>
    <p data-ssml="&lt;speak&gt;twelve rows&lt;/speak&gt;">12 rows</p>
    <div><img src="field.png" alt="A cornfield"/></div>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Who visits?</prompt>
      <simpleChoice identifier="A">A <ssml:sub alias="doctor">Dr.</ssml:sub></simpleChoice>
      <simpleChoice identifier="B">A farmer</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <apip:apipAccessibility>
    <apip:companionMaterialsInfo><apip:calculator><apip:calculatorType>Basic</apip:calculatorType></apip:calculator></apip:companionMaterialsInfo>
    <apip:inclusionOrder><apip:textGraphicsDefaultOrder><apip:elementOrder identifierRef="ae1"><apip:order>1</apip:order></apip:elementOrder></apip:textGraphicsDefaultOrder></apip:inclusionOrder>
    <apip:accessibilityInfo>
      <apip:accessElement identifier="ae1">
        <apip:contentLinkInfo qtiLinkIdentifierRef="stem"><apip:objectLink/></apip:contentLinkInfo>
        <apip:relatedElementInfo><apip:spoken><apip:spokenText>A doctor visits the farm.</apip:spokenText></apip:spoken></apip:relatedElementInfo>
      </apip:accessElement>
      <apip:accessElement identifier="ae2">
        <apip:contentLinkInfo qtiLinkIdentifierRef="hint"><apip:objectLink/></apip:contentLinkInfo>
        <apip:relatedElementInfo><apip:brailleText><apip:brailleTextString>hint</apip:brailleTextString></apip:brailleText></apip:relatedElementInfo>
      </apip:accessElement>
    </apip:accessibilityInfo>
  </apip:apipAccessibility>
</assessmentItem>`;

async function convert(qtiXml: string): Promise<TransformOutput> {
  return new QtiToPiePlugin().transform({ content: qtiXml, format: 'qti' }, {});
}

function pieItems(output: TransformOutput): PieItem[] {
  return output.items.map((item) => item.content as PieItem);
}

function notCarriedCounts(output: TransformOutput): Record<string, number> {
  return Object.fromEntries(
    (output.warnings ?? [])
      .filter((warning) => warning.code === ACCESSIBILITY_NOT_CARRIED)
      .map((warning) => {
        const { construct, count } = warning as AccessibilityNotCarriedWarning;
        return [construct, count];
      })
  );
}

function pieItem(config: Record<string, unknown>, extra: Record<string, unknown> = {}): PieItem {
  return {
    id: 'i',
    uuid: 'u',
    config: { id: 'c', markup: '', elements: {}, models: [], ...config },
    ...extra,
  } as PieItem;
}

describe('accessibility inventory', () => {
  test('mapped plus reported equals found', async () => {
    const output = await convert(APIP_ITEM);
    const audit = auditAccessibility(APIP_ITEM, pieItems(output));
    const reported = notCarriedCounts(output);
    const reportedTotal = Object.values(reported).reduce((sum, count) => sum + count, 0);

    expect(audit.found).toHaveLength(9);
    expect(audit.carried.length + reportedTotal).toBe(audit.found.length);
    expect(audit.carried.map((finding) => finding.construct).sort()).toEqual([
      'alt',
      'apip:accessElement',
      'apip:accessElement',
      'aria-*',
      'companionMaterialsInfo',
      'data-ssml',
      'qti-visually-hidden',
      'ssml:*',
    ]);
    expect(reported).toEqual({ 'apip:inclusionOrder': 1 });
  });

  test('records the supports the item carries', async () => {
    const output = await convert(APIP_ITEM);

    expect(pieItems(output)[0]?.metadata?.accessibility).toEqual({
      supports: ['braille', 'spoken'],
    });
  });

  test('ignores the source QTI embedded in metadata', () => {
    const qti = `<assessmentItem><itemBody><img src="a.png" alt="A cornfield"/></itemBody></assessmentItem>`;
    const audit = auditAccessibility(qti, [pieItem({}, { metadata: { qtiSource: { xml: qti } } })]);

    expect(audit.notCarried).toEqual([{ construct: 'alt', key: 'A cornfield' }]);
  });

  test('reports an alt the output drops', () => {
    const qti = `<assessmentItem><itemBody><img src="a.png" alt="Graph of y = x"/><img src="b.png" alt=""/></itemBody></assessmentItem>`;
    const audit = auditAccessibility(qti, [
      pieItem({ models: [{ id: 'm', element: 'x', prompt: '<img src="a.png">' }] }),
    ]);

    expect(audit.notCarried).toEqual([
      { construct: 'alt', key: 'Graph of y = x' },
      { construct: 'alt', key: '' },
    ]);
  });

  test('carries a catalog that has a matching output catalog, and an access element per link', () => {
    const qti = `<assessmentItem>
      <itemBody><p data-catalog-idref="c1">Text</p><p data-catalog-idref="c2">More</p></itemBody>
      <catalogInfo><catalog id="c1"><card support="spoken"/></catalog></catalogInfo>
      <apip:apipAccessibility><apip:accessibilityInfo><apip:accessElement identifier="ae1">
        <apip:contentLinkInfo qtiLinkIdentifierRef="a"><apip:objectLink/></apip:contentLinkInfo>
        <apip:contentLinkInfo qtiLinkIdentifierRef="b"><apip:objectLink/></apip:contentLinkInfo>
        <apip:relatedElementInfo><apip:brailleText><apip:brailleTextString>Text</apip:brailleTextString></apip:brailleText></apip:relatedElementInfo>
      </apip:accessElement></apip:accessibilityInfo></apip:apipAccessibility>
    </assessmentItem>`;
    const audit = auditAccessibility(qti, [
      pieItem(
        {
          models: [
            {
              id: 'm',
              element: 'x',
              prompt: '<p data-catalog-idref="c1">Text</p><p data-catalog-idref="ae1">A</p>',
            },
          ],
        },
        {
          accessibilityCatalogs: [
            { identifier: 'c1', cards: [{ catalog: 'spoken', content: '<speak>Text</speak>' }] },
            { identifier: 'ae1', cards: [{ catalog: 'braille', content: 'Text' }] },
          ],
        }
      ),
    ]);

    expect(audit.carried.map(({ construct, key }) => `${construct}:${key}`).sort()).toEqual([
      'apip:accessElement:ae1',
      'catalog:c1',
      'data-catalog-idref:c1',
    ]);
    expect(audit.notCarried).toEqual([
      { construct: 'apip:accessElement', key: 'ae1' },
      { construct: 'data-catalog-idref', key: 'c2' },
    ]);
    expect(audit.supports).toEqual(['braille', 'spoken']);
  });

  test('finds SSML by its declared namespace prefix, and in an SSML default namespace', () => {
    const qti = `<assessmentItem xmlns:s="http://www.w3.org/2001/10/synthesis">
      <itemBody><p><s:emphasis>now <b>here</b></s:emphasis> <sub>2</sub></p>
      <p><prosody xmlns="http://www.w3.org/2010/10/synthesis" rate="slow"><break/></prosody></p></itemBody>
    </assessmentItem>`;

    expect(inventoryAccessibility(qti)).toEqual([
      { construct: 'ssml:*', key: 'emphasis\u0000now here' },
      { construct: 'ssml:*', key: 'prosody\u0000' },
      { construct: 'ssml:*', key: 'break\u0000' },
    ]);
  });

  test('carries a hiding class only with the style it stands for', () => {
    const qti = `<assessmentItem><itemBody>
      <p class="qti-hidden">One</p><p class="qti-hidden">Two</p><span class="qti-visually-hidden">Three</span>
    </itemBody></assessmentItem>`;
    const audit = auditAccessibility(qti, [
      pieItem({
        models: [
          {
            id: 'm',
            element: 'x',
            prompt:
              '<p class="qti-hidden" style="color: red; display: none">One</p><p class="qti-hidden">Two</p><span class="qti-visually-hidden">Three</span>',
          },
        ],
      }),
    ]);

    expect(audit.carried).toEqual([{ construct: 'qti-hidden' }]);
    expect(audit.notCarried).toEqual([
      { construct: 'qti-hidden' },
      { construct: 'qti-visually-hidden' },
    ]);
  });

  test('carries a read-aloud suppression restated in the PIE spelling', () => {
    const qti = `<assessmentItem><itemBody>
      <p data-qti-suppress-tts="computer-read-aloud">One</p><p data-qti-suppress-tts="all">Two</p>
    </itemBody></assessmentItem>`;
    const audit = auditAccessibility(qti, [
      pieItem({
        models: [
          {
            id: 'm',
            element: 'x',
            prompt: '<p data-tts-suppress="computer-read-aloud">One</p><p>Two</p>',
          },
        ],
      }),
    ]);

    expect(audit.carried).toEqual([
      { construct: 'data-qti-suppress-tts', key: 'computer-read-aloud' },
    ]);
    expect(audit.notCarried).toEqual([{ construct: 'data-qti-suppress-tts', key: 'all' }]);
  });

  test('carries companion materials the item records for its host', () => {
    const qti = `<assessmentItem><companionMaterialsInfo><calculator/></companionMaterialsInfo><itemBody/></assessmentItem>`;
    const companionMaterials = { element: 'companionMaterialsInfo', attributes: {}, children: [] };

    expect(auditAccessibility(qti, [pieItem({})]).notCarried).toEqual([
      { construct: 'companionMaterialsInfo' },
    ]);
    expect(
      auditAccessibility(qti, [pieItem({}, { metadata: { companionMaterials } })]).notCarried
    ).toEqual([]);
  });
});

describe('unresolved passages', () => {
  test('reports a passage object left in the prompt', async () => {
    const output = await convert(`<assessmentItem identifier="mc-passage">
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse><value>A</value></correctResponse>
      </responseDeclaration>
      <itemBody>
        <object data="passages/river.html" type="text/html"/>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <prompt>What is the river's name?</prompt>
          <simpleChoice identifier="A">Nile</simpleChoice>
        </choiceInteraction>
      </itemBody>
    </assessmentItem>`);

    expect(output.warnings?.filter((warning) => warning.code === PASSAGE_UNRESOLVED)).toEqual([
      {
        itemId: 'mc-passage',
        code: PASSAGE_UNRESOLVED,
        path: 'passages/river.html',
        message:
          'Passage passages/river.html is left as an <object> in the item markup and does not render.',
      } as never,
    ]);
  });

  test('reports a passage object left in transformer markup', async () => {
    const output = await convert(`<assessmentItem identifier="ebsr-passage">
      <responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
        <correctResponse><value>A</value></correctResponse>
      </responseDeclaration>
      <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
        <correctResponse><value>X</value></correctResponse>
      </responseDeclaration>
      <itemBody>
        <object data="passages/river.html" type="text/html"/>
        <choiceInteraction responseIdentifier="RESPONSE_A" maxChoices="1">
          <prompt>What is the main idea?</prompt>
          <simpleChoice identifier="A">Choice A</simpleChoice>
        </choiceInteraction>
        <choiceInteraction responseIdentifier="RESPONSE_B" maxChoices="1">
          <prompt>Which evidence supports it?</prompt>
          <simpleChoice identifier="X">Evidence X</simpleChoice>
        </choiceInteraction>
      </itemBody>
    </assessmentItem>`);

    expect(
      output.warnings
        ?.filter((warning) => warning.code === PASSAGE_UNRESOLVED)
        .map((warning) => warning.message)
    ).toEqual([
      'Passage passages/river.html is left as an <object> in the item markup and does not render.',
    ]);
  });
});

describe('item-body text coverage', () => {
  const fixtureDir = new URL('./fixtures/conversion-fidelity/', import.meta.url);
  // Fails conversion by design: it has no image dimensions to place hotspots with.
  const unconvertible = new Set(['hotspot-missing-dimensions.xml']);
  const fixtures: Array<[string, string]> = [
    ['apip-item', APIP_ITEM],
    ...readdirSync(fixtureDir)
      .filter((name) => name.endsWith('.xml') && !unconvertible.has(name))
      .map((name): [string, string] => [name, readFileSync(new URL(name, fixtureDir), 'utf8')]),
  ];

  test.each(fixtures)(
    'every item-body text node in %s reaches the output or a warning',
    async (_name, qtiXml) => {
      const output = await convert(qtiXml);
      const rendered = renderedText(pieItems(output));
      const warned = normalize((output.warnings ?? []).map((warning) => warning.message).join(' '));
      const itemBody = parse(qtiXml, {
        lowerCaseTagName: false,
        comment: false,
      }).getElementsByTagName('itemBody')[0]!;

      const missing = textNodes(itemBody).filter(
        (text) => !rendered.includes(text) && !warned.includes(text)
      );

      expect(missing).toEqual([]);
    }
  );
});

describe('ported choice fixes', () => {
  test('EBSR keeps a choice feedbackInline out of its label', () => {
    const item = transformEbsr(
      `<assessmentItem identifier="ebsr-feedback">
        <responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
          <correctResponse><value>A</value></correctResponse>
        </responseDeclaration>
        <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
          <correctResponse><value>X</value></correctResponse>
        </responseDeclaration>
        <itemBody>
          <choiceInteraction responseIdentifier="RESPONSE_A">
            <simpleChoice identifier="A">Choice A<feedbackInline outcomeIdentifier="FEEDBACK" identifier="A" showHide="show">Right!</feedbackInline></simpleChoice>
          </choiceInteraction>
          <choiceInteraction responseIdentifier="RESPONSE_B">
            <simpleChoice identifier="X">Evidence X</simpleChoice>
          </choiceInteraction>
        </itemBody>
      </assessmentItem>`,
      'ebsr-feedback'
    );
    const model = item.config.models[0] as unknown as {
      partA: { choices: Array<{ label: string; feedback?: string }> };
    };

    expect(model.partA.choices[0]).toMatchObject({ label: 'Choice A', feedback: 'Right!' });
  });

  test('hotspot with unlimited maxChoices allows more than one answer', () => {
    const item = transformHotspot(
      `<assessmentItem identifier="hotspot-unlimited">
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse><value>h1</value></correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="0">
            <img src="cell.png" width="400" height="300"/>
            <hotspotChoice shape="rect" coords="50,50,150,150" identifier="h1"/>
            <hotspotChoice shape="rect" coords="200,100,300,200" identifier="h2"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>`,
      'hotspot-unlimited'
    );

    expect((item.config.models[0] as { multipleCorrect?: boolean }).multipleCorrect).toBe(true);
  });
});

function renderedText(items: PieItem[]): string {
  const parts: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') parts.push(parse(value).text);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object' && value !== null) Object.values(value).forEach(visit);
  };
  for (const item of items) {
    visit(item.config);
    visit((item as unknown as { passage?: unknown }).passage);
  }
  return normalize(parts.join(' '));
}

function textNodes(root: HTMLElement): string[] {
  const texts: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === NodeType.TEXT_NODE) {
      const text = normalize(node.text);
      if (text) texts.push(text);
    }
    for (const child of node.childNodes) visit(child);
  };
  visit(root);
  return texts;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
