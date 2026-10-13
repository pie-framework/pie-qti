/**
 * Accessibility catalogs have no QTI 2.2 output yet, so every export path names the ones it drops.
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQtiPlugin } from '../../src/plugin.js';
import { findAccessibilityCatalogs } from '../../src/utils/accessibility-catalogs.js';

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

const spokenCatalog = (identifier: string) => ({
  identifier,
  cards: [{ catalog: 'spoken', content: '<speak>water</speak>' }],
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

describe('accessibility catalogs on export', () => {
  test('names the catalogs a model declares and its markup references', async () => {
    const plugin = new PieToQtiPlugin();
    const result = await plugin.transform(
      {
        content: multipleChoiceItem({
          model: { rationale: '<p data-catalog-idref="rationale-1">Agua is water.</p>' },
        }),
      },
      { logger }
    );

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([
      'Item "catalog-item" carries accessibility catalogs "term-water", "rationale-1", which the QTI 2.2 export does not write',
    ]);
    expect(result.items[0].content as string).toContain('data-catalog-idref="term-water"');
  });

  test('names item-root and extracted catalogs', async () => {
    const item = multipleChoiceItem({
      model: { prompt: '<p>Pick one.</p>', accessibilityCatalogs: undefined },
    }) as PieItem & Record<string, unknown>;
    item.accessibilityCatalogs = [spokenCatalog('shared-1')];
    (item.config as Record<string, unknown>).extractedCatalogs = [spokenCatalog('ssml-1')];

    const result = await new PieToQtiPlugin().transform({ content: item }, { logger });

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([
      'Item "catalog-item" carries accessibility catalogs "ssml-1", "shared-1", which the QTI 2.2 export does not write',
    ]);
  });

  test('names the catalogs of a resolved passage', async () => {
    const plugin = new PieToQtiPlugin({
      passageResolver: async (id) => ({
        id,
        title: 'Water',
        content: '<p>Rain <span data-catalog-idref="passage-term">falls</span>.</p>',
        accessibilityCatalogs: [spokenCatalog('passage-term')],
      }),
    });
    const item = multipleChoiceItem({
      model: { prompt: '<p>Pick one.</p>', accessibilityCatalogs: undefined },
    }) as PieItem & Record<string, unknown>;
    item.passage = 'passage-1';

    const result = await plugin.transform({ content: item }, { logger });

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([
      'Passage "passage-1" carries accessibility catalogs "passage-term", which the QTI 2.2 export does not write',
    ]);
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

  test('stays silent for an item without catalogs', async () => {
    const result = await new PieToQtiPlugin().transform(
      { content: multipleChoiceItem({ model: { prompt: '<p>Pick one.</p>', accessibilityCatalogs: undefined } }) },
      { logger }
    );

    expect(catalogWarnings(result.metadata.warnings as string[])).toEqual([]);
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
