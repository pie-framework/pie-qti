/**
 * Accessibility catalogs
 *
 * A QTI 3 item's catalogs reach the PIE item in the card shape players resolve, on the model or
 * item whose content references them; inline SSML becomes a spoken card, hiding classes keep
 * their content hidden, and companion materials are recorded for the host.
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem, TransformOutput } from '@pie-qti/transform-types';
import {
  convertQtiPassageDocument,
  prepareQtiAccessibility,
  QtiToPiePlugin,
  withQtiAccessibility,
} from '../src';
import { ACCESSIBILITY_NOT_CARRIED } from '../src/utils/accessibility-inventory';

const CATALOG_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v3p0" identifier="cat-1" title="Catalog item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <companionMaterialsInfo><calculator><calculatorType>basic</calculatorType></calculator></companionMaterialsInfo>
  <itemBody>
    <p data-catalog-idref="stem">A <span class="qti-visually-hidden">quiet</span> farm.</p>
    <p class="qti-hidden" style="color: red;">Answer key</p>
    <p data-ssml="&lt;speak&gt;twelve &amp; rows&lt;/speak&gt;" data-qti-suppress-tts="computer-read-aloud">12 rows</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt data-catalog-idref="prompt">Who visits?</prompt>
      <simpleChoice identifier="A">A doctor</simpleChoice>
      <simpleChoice identifier="B">A farmer</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <catalogInfo>
    <catalog id="stem">
      <card support="spoken"><htmlContent><![CDATA[A <b>quiet</b> farm.]]></htmlContent></card>
      <card support="sign-language"><fileHref mime-type="video/mp4">https://media.example.com/assets/asset-sign#t=2,5</fileHref></card>
    </catalog>
    <catalog id="prompt">
      <card support="glossary-on-screen">
        <cardEntry xml:lang="en"><htmlContent>Who</htmlContent></cardEntry>
        <cardEntry xml:lang="es"><htmlContent>Quién</htmlContent></cardEntry>
      </card>
      <card support="x-district-tooltip"><htmlContent>Tip</htmlContent></card>
    </catalog>
  </catalogInfo>
</assessmentItem>`;

const VISUALLY_HIDDEN =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

async function convert(qtiXml: string): Promise<TransformOutput> {
  return new QtiToPiePlugin().transform({ content: qtiXml, format: 'qti' }, {});
}

function pieItemOf(output: TransformOutput): Record<string, any> {
  return output.items[0]?.content as Record<string, any>;
}

function notCarried(output: TransformOutput) {
  return (output.warnings ?? []).filter((warning) => warning.code === ACCESSIBILITY_NOT_CARRIED);
}

function output(item: PieItem): TransformOutput {
  return {
    items: [{ format: 'pie', content: item }],
    format: 'pie',
    metadata: {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
      pluginId: 'test',
      timestamp: new Date(0),
      itemCount: 1,
      processingTime: 0,
    },
  };
}

function pieItem(config: Record<string, unknown>): PieItem {
  return { id: 'i', uuid: 'u', config: { id: 'c', elements: {}, models: [], ...config } };
}

describe('accessibility catalogs', () => {
  test('a QTI 3 catalog item converts with its catalogs on the model that renders them', async () => {
    const converted = await convert(CATALOG_ITEM);
    const item = pieItemOf(converted);
    const [model] = item.config.models;

    expect(notCarried(converted)).toEqual([]);
    expect(item.accessibilityCatalogs).toBeUndefined();
    expect(model.accessibilityCatalogs).toEqual([
      {
        identifier: 'stem',
        cards: [
          { catalog: 'spoken', content: 'A <b>quiet</b> farm.' },
          {
            catalog: 'sign-language',
            payload: {
              media: {
                version: 1,
                id: 'https://media.example.com/assets/asset-sign',
                kind: 'video',
                sources: [{ src: 'https://media.example.com/assets/asset-sign', type: 'video/mp4' }],
              },
              fragment: { startSeconds: 2, endSeconds: 5 },
            },
          },
        ],
      },
      {
        identifier: 'prompt',
        cards: [
          { catalog: 'glossary-on-screen', language: 'en', content: 'Who' },
          { catalog: 'glossary-on-screen', language: 'es', content: 'Quién' },
          { catalog: 'x-district-tooltip', content: 'Tip' },
        ],
      },
      {
        identifier: 'ssml-1',
        cards: [{ catalog: 'spoken', content: '<speak>twelve & rows</speak>' }],
      },
    ]);
    expect(item.metadata.accessibility.supports).toEqual([
      'glossary-on-screen',
      'sign-language',
      'spoken',
      'x-district-tooltip',
    ]);
    expect(item.metadata.companionMaterials).toEqual({
      element: 'companionMaterialsInfo',
      attributes: {},
      children: [
        {
          element: 'calculator',
          attributes: {},
          children: [{ element: 'calculatorType', attributes: {}, children: ['basic'] }],
        },
      ],
    });
  });

  test('the converted content references its catalogs and keeps hidden content hidden', async () => {
    const prompt: string = pieItemOf(await convert(CATALOG_ITEM)).config.models[0].prompt;

    expect(prompt).toContain('<p data-catalog-idref="stem">');
    expect(prompt).toContain(`<span class="qti-visually-hidden" style="${VISUALLY_HIDDEN}">`);
    expect(prompt).toContain('<p class="qti-hidden" style="color: red;display:none">');
    expect(prompt).toContain(
      'data-qti-suppress-tts="computer-read-aloud" data-tts-suppress="computer-read-aloud" data-catalog-idref="ssml-1"'
    );
    expect(prompt).toContain('<div data-catalog-idref="prompt">Who visits?</div>');
  });

  test('a sole stem paragraph that names a catalog keeps its reference', async () => {
    const converted =
      await convert(`<assessmentItem identifier="stem-1" title="Stem" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <itemBody><p data-catalog-idref="stem">Which river is longest?</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">Nile</simpleChoice><simpleChoice identifier="B">Amazon</simpleChoice></choiceInteraction></itemBody>
  <catalogInfo><catalog id="stem"><card support="spoken"><htmlContent>Which river is the longest?</htmlContent></card></catalog></catalogInfo>
</assessmentItem>`);
    const [model] = pieItemOf(converted).config.models;

    expect(model.prompt).toBe('<p data-catalog-idref="stem">Which river is longest?</p>');
    expect(model.accessibilityCatalogs).toHaveLength(1);
    expect(notCarried(converted)).toEqual([]);
  });

  test('inline SSML joins the catalog its element names, unless that catalog speaks already', () => {
    const prepared = prepareQtiAccessibility(`<assessmentItem><itemBody>
      <p data-catalog-idref="a" data-ssml="&lt;speak&gt;A&lt;/speak&gt;">A</p>
      <p data-catalog-idref="b" data-ssml="&lt;speak&gt;B&lt;/speak&gt;">B</p>
      <p data-ssml="&lt;speak&gt;C&lt;/speak&gt;">C</p>
    </itemBody><catalogInfo>
      <catalog id="a"><card support="glossary-on-screen"><htmlContent>A</htmlContent></card></catalog>
      <catalog id="b"><card support="spoken"><htmlContent>Bee</htmlContent></card></catalog>
      <catalog id="ssml-1"><card support="spoken"><htmlContent>Taken</htmlContent></card></catalog>
    </catalogInfo></assessmentItem>`);

    expect(prepared.catalogs.map(({ identifier, cards }) => [identifier, cards])).toEqual([
      [
        'a',
        [
          { catalog: 'glossary-on-screen', content: 'A' },
          { catalog: 'spoken', content: '<speak>A</speak>' },
        ],
      ],
      ['b', [{ catalog: 'spoken', content: 'Bee' }]],
      ['ssml-1', [{ catalog: 'spoken', content: 'Taken' }]],
      ['ssml-2', [{ catalog: 'spoken', content: '<speak>C</speak>' }]],
    ]);
    expect(prepared.xml).toContain(
      '<p data-ssml="&lt;speak&gt;C&lt;/speak&gt;" data-catalog-idref="ssml-2">'
    );
  });

  test('preparation edits content only, and leaves comments alone', () => {
    const qtiXml = `<assessmentItem><itemBody><!-- <p class="qti-hidden">x</p> --><p class='qti-hidden' style='margin:0'>y</p></itemBody>
      <modalFeedback><span class="note qti-hidden"/></modalFeedback>
      <responseProcessing class="qti-hidden"/></assessmentItem>`;

    expect(
      prepareQtiAccessibility(qtiXml).xml
    ).toBe(`<assessmentItem><itemBody><!-- <p class="qti-hidden">x</p> --><p class='qti-hidden' style='margin:0;display:none'>y</p></itemBody>
      <modalFeedback><span class="note qti-hidden" style="display:none" /></modalFeedback>
      <responseProcessing class="qti-hidden"/></assessmentItem>`);
  });

  test('a card file is media with its sources, kind and time range', () => {
    const { catalogs } =
      prepareQtiAccessibility(`<assessmentItem><itemBody/><catalogInfo><catalog id="c">
      <card support="spoken"><fileHref>audio/a.mp3#t=npt:10</fileHref><fileHref mimeType="audio/ogg">audio/a.ogg</fileHref></card>
      <card support="sign-language"><fileHref>video/s#t=00:01:20,00:01:30.5</fileHref></card>
      <card support="x-picture"><fileHref>img/p.png#t=,20</fileHref></card>
      <card support="x-file"><fileHref>doc.bin</fileHref></card>
      <card support="spoken"><fileHref>  </fileHref></card>
    </catalog></catalogInfo></assessmentItem>`);

    expect(catalogs[0]?.cards.map((card) => card.payload)).toEqual([
      {
        media: {
          version: 1,
          id: 'audio/a.mp3',
          kind: 'audio',
          sources: [{ src: 'audio/a.mp3' }, { src: 'audio/a.ogg', type: 'audio/ogg' }],
        },
        fragment: { startSeconds: 10 },
      },
      {
        media: { version: 1, id: 'video/s', kind: 'video', sources: [{ src: 'video/s' }] },
        fragment: { startSeconds: 80, endSeconds: 90.5 },
      },
      {
        media: { version: 1, id: 'img/p.png', kind: 'image', sources: [{ src: 'img/p.png' }] },
        fragment: { startSeconds: 0, endSeconds: 20 },
      },
      { media: { version: 1, id: 'doc.bin', kind: 'other', sources: [{ src: 'doc.bin' }] } },
    ]);
  });

  test('a catalog several models or the markup reference attaches to the item', () => {
    const catalogs = ['shared', 'markup', 'single', 'nowhere', 'carried'].map((identifier) => ({
      identifier,
      cards: [{ catalog: 'spoken', content: identifier }],
    }));
    const item = pieItem({
      markup: '<p data-catalog-idref="markup">Lead</p><x-a id="a"></x-a><x-b id="b"></x-b>',
      models: [
        { id: 'a', element: 'x-a', prompt: `<p data-catalog-idref='shared'>A</p>` },
        {
          id: 'b',
          element: 'x-b',
          choices: [{ label: '<span data-catalog-idref="shared">B</span>' }],
          rationale: '<p data-catalog-idref="single">B</p><p data-catalog-idref="carried">B</p>',
          accessibilityCatalogs: [{ identifier: 'carried', cards: [] }],
        },
      ],
    });
    const result = withQtiAccessibility(output(item), { xml: '', catalogs }).items[0]
      ?.content as Record<string, any>;

    expect(result.accessibilityCatalogs.map((catalog: any) => catalog.identifier)).toEqual([
      'shared',
      'markup',
    ]);
    expect(result.config.models[0].accessibilityCatalogs).toBeUndefined();
    expect(
      result.config.models[1].accessibilityCatalogs.map((catalog: any) => catalog.identifier)
    ).toEqual(['carried', 'single']);
  });

  test('a catalog no output content references is reported', async () => {
    const converted = await convert(
      CATALOG_ITEM.replace('<p data-catalog-idref="stem">', '<p>').replace(
        '<prompt data-catalog-idref="prompt">',
        '<prompt>'
      )
    );

    expect(
      notCarried(converted).map(
        (warning) => (warning as unknown as { construct: string }).construct
      )
    ).toEqual(['catalog']);
  });

  test('a stimulus carries its catalogs on the passage', () => {
    const result = convertQtiPassageDocument({
      passageId: 'P1',
      xml: `<assessmentStimulus xmlns="http://www.imsglobal.org/xsd/imsqti_v3p0" identifier="P1" title="Rivers">
  <stimulusBody><p data-catalog-idref="river">The Nile is long.</p><p data-ssml="&lt;speak&gt;Amazon&lt;/speak&gt;">The Amazon is wide.</p></stimulusBody>
  <catalogInfo><catalog id="river"><card support="spoken"><htmlContent>The Nile river is long.</htmlContent></card></catalog></catalogInfo>
</assessmentStimulus>`,
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') return;
    expect(result.passage.accessibilityCatalogs).toEqual([
      { identifier: 'river', cards: [{ catalog: 'spoken', content: 'The Nile river is long.' }] },
      { identifier: 'ssml-1', cards: [{ catalog: 'spoken', content: '<speak>Amazon</speak>' }] },
    ]);
    expect(JSON.stringify(result.passage.config.models)).toContain(
      'data-catalog-idref=\\"ssml-1\\"'
    );
    expect(JSON.stringify(result.passage.config.models)).not.toContain('accessibilityCatalogs');
  });
});
