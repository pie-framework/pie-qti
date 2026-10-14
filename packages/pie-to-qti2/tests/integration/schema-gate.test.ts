/**
 * Schema gate: every generator's output validates against the QTI 2.2 XSD.
 */

import { describe, expect, test } from 'bun:test';
import { QtiToPiePlugin, validateQti } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { generatePassageXml } from '../../src/generators/passage-generator.js';
import { PieToQtiPlugin } from '../../src/plugin.js';
import { cases, itemFor } from './schema-gate-cases.js';

describe('Schema gate: QTI 2.2 XSD', () => {
  const pieToQti = new PieToQtiPlugin();
  const qtiToPie = new QtiToPiePlugin();
  const logger = { debug() {}, info() {}, warn() {}, error() {} };

  for (const [label, name, model] of cases) {
    test(`${label} validates and round-trips through its sidecar`, async () => {
      const item = itemFor(name, model);
      const output = await pieToQti.transform({ content: item }, { logger });
      const xml = output.items[0].content as string;

      const validation = await validateQti(xml, { xsdSeverity: 'error' });
      expect(validation.schemaValidated).toBe(true);
      expect(validation.errors.map((error) => error.message)).toEqual([]);

      const back = await qtiToPie.transform({ content: xml, sidecar: output.items[0].sidecar }, { logger });
      expect(back.items[0].content).toMatchObject({ id: item.id, baseId: 'base-1', config: item.config });
    });
  }

  test('an inline passage beside an interaction validates', async () => {
    const item = {
      id: 'passage-item',
      config: {
        id: 'c',
        models: [
          { id: 'p', element: 'passage-el', passages: [{ title: 'Theme', text: '<p>Once upon a time.</p>' }] },
          { id: '1', element: 'er-el', prompt: 'Explain.' },
        ],
        elements: {
          'passage-el': '@pie-element/passage@1.0.0',
          'er-el': '@pie-element/extended-response@1.0.0',
        },
      },
    } as PieItem;

    const output = await pieToQti.transform({ content: item }, { logger });
    const validation = await validateQti(output.items[0].content as string, { xsdSeverity: 'error' });
    expect(validation.errors.map((error) => error.message)).toEqual([]);
  });

  const rubrics: Array<[label: string, name: string, model: Record<string, any>, maxScore: number]> = [
    ['simple rubric', 'rubric', { points: ['<p>None</p>', 'Partial', 'Full'], excludeZero: false }, 2],
    [
      'simple rubric excluding zero, with sample answers',
      'rubric',
      { points: ['Weak', 'Strong'], sampleAnswers: [null, '<p>A <em>strong</em> answer</p>'], excludeZero: true },
      2,
    ],
    [
      'multi-trait rubric',
      'multi-trait-rubric',
      {
        scales: [
          {
            excludeZero: false,
            maxPoints: 2,
            traitLabel: 'Trait',
            scorePointsLabels: ['Missing', 'Developing', 'Secure'],
            traits: [
              { name: 'Ideas', description: 'Clarity', scorePointsDescriptors: ['none', 'some', 'all'] },
              { name: 'Voice', scorePointsDescriptors: ['flat', 'emerging', 'distinct'] },
            ],
          },
        ],
      },
      4,
    ],
    [
      'complex rubric without a rubric',
      'complex-rubric',
      { rubricType: 'rubricless', rubrics: { rubricless: { maxPoints: 3, rubriclessInstruction: '<p>Use judgement.</p>' } } },
      3,
    ],
  ];

  for (const [label, name, rubric, maxScore] of rubrics) {
    test(`a ${label} beside an extended response validates and sets MAXSCORE`, async () => {
      const item = {
        id: `rubric-${name}`,
        config: {
          id: 'c',
          models: [
            { id: '1', element: 'er-el', prompt: 'Explain.' },
            { id: '2', element: 'rubric-el', ...rubric },
          ],
          elements: { 'er-el': '@pie-element/extended-response@1.0.0', 'rubric-el': `@pie-element/${name}@1.0.0` },
        },
      } as PieItem;

      const output = await pieToQti.transform({ content: item }, { logger });
      const xml = output.items[0].content as string;
      const validation = await validateQti(xml, { xsdSeverity: 'error' });
      expect(validation.errors.map((error) => error.message)).toEqual([]);
      expect(xml).toMatch(/<rubricBlock view="scorer">[\s\S]*<\/rubricBlock>\s*<\/itemBody>/);
      expect(xml).toMatch(
        new RegExp(`identifier="MAXSCORE"[^>]*>\\s*<defaultValue>\\s*<value>${maxScore}</value>`)
      );

      const back = await qtiToPie.transform({ content: xml, sidecar: output.items[0].sidecar }, { logger });
      expect(back.items[0].content).toMatchObject({ id: item.id, config: item.config });
    });
  }

  test('a standalone passage file validates', async () => {
    const xml = generatePassageXml({ id: 'p1', baseId: 'b1', title: 'Theme', content: '<p>Once upon a time.</p>' });
    const validation = await validateQti(xml, { xsdSeverity: 'error' });
    expect(validation.errors.map((error) => error.message)).toEqual([]);
  });
});
