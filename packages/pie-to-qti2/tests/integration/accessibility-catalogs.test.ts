/**
 * Accessibility catalogs export as APIP: an item's or passage's catalogs become access elements
 * linked to the elements whose `data-catalog-idref` names them, and what APIP cannot carry is
 * named in a warning. Assessments carry no APIP, so their catalogs are named whole.
 */

import { describe, expect, test } from 'bun:test';
import { extractCatalogFromItemXml } from '@pie-qti/item-player';
import { validateQti } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQtiPlugin } from '../../src/plugin.js';
import { findAccessibilityCatalogs } from '../../src/utils/accessibility-catalogs.js';

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const spokenCatalog = (identifier: string, content = '<speak>water</speak>') => ({
  identifier,
  cards: [{ catalog: 'spoken', content }],
});

function multipleChoiceItem(overrides: Partial<PieItem> & { model?: Record<string, unknown> } = {}): PieItem {
  const { model, ...item } = overrides;
  return {
    id: 'catalog-item',
    uuid: 'catalog-item-uuid',
    config: {
      id: 'catalog-item-uuid',
      models: [
        {
          id: 'mc-1',
          element: '@pie-element/multiple-choice',
          prompt: '<p>Which word means <span data-catalog-idref="term-water">water</span>?</p>',
          choiceMode: 'radio',
          choices: [
            { label: 'agua', value: 'a', correct: true },
            { label: 'fuego', value: 'b', correct: false },
          ],
          accessibilityCatalogs: [spokenCatalog('term-water')],
          ...model,
        },
      ],
      elements: { '@pie-element/multiple-choice': '1.0.0' },
    },
    ...item,
  } as PieItem;
}

function catalogWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => warning.includes('accessibility catalogs'));
}

async function expectValid(xml: string): Promise<void> {
  const validation = await validateQti(xml, { xsdSeverity: 'error' });
  expect(validation.schemaValidated).toBe(true);
  expect(validation.errors.map((error) => error.message)).toEqual([]);
}

describe('accessibility catalogs on export', () => {
  test('writes a catalog as an access element linked to the element that names it', async () => {
    const result = await new PieToQtiPlugin().transform({ content: multipleChoiceItem() }, { logger });
    const xml = result.items[0].content as string;

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([]);
    expect(xml).toContain('<span id="apip-target-1" data-catalog-idref="term-water">water</span>');
    expect(xml).toContain(
      '<apip:accessElement identifier="term-water"><apip:contentLinkInfo qtiLinkIdentifierRef="apip-target-1">'
    );
    expect(xml).toMatch(/<\/itemBody>[\s\S]*<apip:apipAccessibility [^>]*>[\s\S]*<\/apip:apipAccessibility>\s*<\/assessmentItem>/);
    await expectValid(xml);
    expect(extractCatalogFromItemXml(xml).get('term-water')?.entries).toEqual([
      { usage: 'spoken', html: '<speak>water</speak>' },
    ]);
  });

  test('links an authored id, and names an image as an object', async () => {
    const result = await new PieToQtiPlugin().transform(
      {
        content: multipleChoiceItem({
          model: {
            prompt:
              '<p id="stem" data-catalog-idref="stem-speech">Name the map.</p>' +
              '<p id="apip-target-1">Taken.</p><img src="map.png" alt="A map" data-catalog-idref="map-braille" />',
            accessibilityCatalogs: [
              spokenCatalog('stem-speech', '<speak>Name the map.</speak>'),
              { identifier: 'map-braille', cards: [{ catalog: 'braille', content: '⠍⠁⠏' }] },
            ],
          },
        }),
      },
      { logger }
    );
    const xml = result.items[0].content as string;

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([]);
    expect(xml).toContain('qtiLinkIdentifierRef="stem"><apip:textLink><apip:fullString/></apip:textLink>');
    expect(xml).toMatch(/<img id="apip-target-2" [^>]*data-catalog-idref="map-braille"/);
    expect(xml).toContain('qtiLinkIdentifierRef="apip-target-2"><apip:objectLink/>');
    await expectValid(xml);
  });

  test('names what the export does not write, and why', async () => {
    const item = multipleChoiceItem({
      model: {
        rationale: '<p data-catalog-idref="rationale-1">Agua is water.</p>',
        accessibilityCatalogs: [
          {
            identifier: 'term-water',
            cards: [
              { catalog: 'spoken', content: '<speak>water</speak>' },
              { catalog: 'glossary-on-screen', content: 'Water: a clear liquid.' },
            ],
          },
        ],
      },
    }) as PieItem & Record<string, unknown>;
    item.accessibilityCatalogs = [spokenCatalog('shared-1'), spokenCatalog('term-water', '<speak>other</speak>')];
    (item.config as Record<string, unknown>).extractedCatalogs = [spokenCatalog('ssml-1')];

    const result = await new PieToQtiPlugin().transform({ content: item }, { logger });

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([
      'Item "catalog-item" carries accessibility catalogs the QTI 2.2 export does not write in full: ' +
        '"term-water" (glossary-on-screen, declared again, which is not written), ' +
        '"rationale-1" (no catalog in the export declares it), ' +
        '"ssml-1" (no exported element refers to it), ' +
        '"shared-1" (no exported element refers to it)',
    ]);
    expect(result.items[0].content as string).toContain('<apip:accessElement identifier="term-water">');
    await expectValid(result.items[0].content as string);
  });

  test('writes the catalogs of a resolved passage into its passage file', async () => {
    const plugin = new PieToQtiPlugin({
      passageResolver: async (id) => ({
        id,
        title: 'Water',
        content: '<p>Rain <span data-catalog-idref="passage-term">falls</span>.</p>',
        accessibilityCatalogs: [spokenCatalog('passage-term', '<speak>falls</speak>')],
      }),
    });
    const item = multipleChoiceItem({
      model: { prompt: '<p>Pick one.</p>', accessibilityCatalogs: undefined },
    }) as PieItem & Record<string, unknown>;
    item.passage = 'passage-1';

    const result = await plugin.transform({ content: item }, { logger });
    const [passage] = (result as unknown as { passageFiles: Array<{ xml: string }> }).passageFiles;

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([]);
    expect(result.items[0].content as string).not.toContain('apip:');
    expect(passage.xml).toContain('<span id="apip-target-1" data-catalog-idref="passage-term">falls</span>');
    expect(passage.xml).toContain('<apip:accessElement identifier="passage-term">');
    await expectValid(passage.xml);
  });

  test('writes the catalogs of a passage object into its passage file, apart from the item', async () => {
    const item = multipleChoiceItem() as PieItem & Record<string, unknown>;
    item.passage = {
      id: 'stimulus-1',
      config: {
        models: [
          {
            id: 'passage-model',
            element: '@pie-element/passage',
            passages: [{ title: 'Rain', text: '<p data-catalog-idref="stimulus-term">Rain falls.</p>' }],
            accessibilityCatalogs: [spokenCatalog('stimulus-term', '<speak>Rain falls.</speak>')],
          },
        ],
      },
    };

    const result = await new PieToQtiPlugin().transform({ content: item }, { logger });
    const [passage] = (result as unknown as { passageFiles: Array<{ xml: string }> }).passageFiles;
    const xml = result.items[0].content as string;

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([]);
    expect(xml).toContain('<apip:accessElement identifier="term-water">');
    expect(xml).not.toContain('stimulus-term');
    expect(passage.xml).toContain('<apip:accessElement identifier="stimulus-term">');
    await expectValid(passage.xml);
  });

  test('names assessment catalogs', async () => {
    const assessment = {
      identifier: 'test-1',
      title: 'Catalog test',
      accessibilityCatalogs: [spokenCatalog('test-glossary')],
      sections: [{ identifier: 'section-1', title: 'Section', itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml' }] }],
    };

    const result = await new PieToQtiPlugin().transform({ content: assessment }, { logger });

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([
      'Assessment "test-1" carries accessibility catalogs "test-glossary", which the QTI 2.2 export does not write',
    ]);
  });

  test('leaves an item without catalogs as generated', async () => {
    const result = await new PieToQtiPlugin().transform(
      { content: multipleChoiceItem({ model: { prompt: '<p>Pick one.</p>', accessibilityCatalogs: undefined } }) },
      { logger }
    );

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([]);
    expect(result.items[0].content as string).not.toContain('apip:');
  });

  test('skips the embedded QTI source', () => {
    expect(
      findAccessibilityCatalogs({
        metadata: { qtiSource: { xml: '<p data-catalog-idref="source-only">x</p>' } },
        config: { markup: "<p data-catalog-idref='single'>x</p><p data-catalog-idref=bare>y</p>" },
      })
    ).toEqual(['single', 'bare']);
  });
});
