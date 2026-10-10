/**
 * Schema gate: every generator's output validates against the QTI 2.2 XSD.
 *
 * Items use the delivered shape: each model names its element by tag, and
 * `config.elements` maps the tag to a versioned package.
 */

import { describe, expect, test } from 'bun:test';
import { QtiToPiePlugin, validateQti } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { generatePassageXml } from '../../src/generators/passage-generator.js';
import { PieToQtiPlugin } from '../../src/plugin.js';

const models: Record<string, Record<string, any>> = {
  'multiple-choice': {
    prompt: '<p>What is <b>2 + 2</b>?</p>',
    choicesLayout: 'grid',
    choiceMode: 'radio',
    choices: [
      { label: '3', value: 'a' },
      { label: '4', value: 'b', correct: true },
    ],
  },
  'extended-response': { prompt: 'Explain.', expectedLines: 5, placeholder: 'Type <here> & now' },
  'explicit-constructed-response': { prompt: 'Capital of France?', correctResponse: ['Paris'] },
  'inline-dropdown': {
    markup: '<p>The capital is {{0}}.</p>',
    choices: {
      '0': [
        { value: 'paris', label: 'Paris', correct: true },
        { value: 'rome', label: 'Rome' },
      ],
    },
  },
  'select-text': {
    prompt: 'Select verbs.',
    text: 'The cat runs quickly.',
    tokens: [
      { text: 'runs', start: 8, end: 12, correct: true },
      { text: 'quickly', start: 13, end: 20 },
    ],
  },
  hotspot: {
    prompt: 'Click.',
    imageUrl: 'diagram.png',
    dimensions: { width: 500, height: 300 },
    shapes: { rectangles: [{ id: '1', x: 1, y: 2, width: 3, height: 4, correct: true }], polygons: [] },
  },
  'placement-ordering': {
    prompt: 'Order.',
    choices: [
      { id: '0', label: 'A' },
      { id: '1', label: 'B' },
    ],
    correctResponse: [{ id: '1' }, { id: '0' }],
  },
  match: { prompt: 'Match.', headers: ['', 'A', 'B'], rows: [{ id: '0', title: 'Item 1', values: [false, true, false] }] },
  'match-list': {
    prompt: 'Match.',
    prompts: [{ id: 1, title: 'P1', relatedAnswer: 1 }],
    answers: [{ id: 1, title: 'A1' }],
  },
  'drag-in-the-blank': {
    prompt: 'Drag.',
    markup: 'The {{0}} ran.',
    choices: { '0': [{ value: 'dog', label: 'dog', correct: true }] },
  },
  'image-cloze-association': {
    prompt: 'Drag.',
    imageUrl: 'i.png',
    responseContainers: [{ id: 'c1', x: 1, y: 2, width: 3, height: 4, correctResponse: 'r1' }],
    possibleResponses: [{ id: 'r1', value: 'x' }],
  },
  ebsr: {
    prompt: '<p>Read.</p>',
    partA: { prompt: 'A?', choices: [{ value: 'a', label: 'A', correct: true }] },
    partB: { prompt: 'B?', choices: [{ value: 'b', label: 'B', correct: true }] },
  },
  categorize: {
    prompt: 'Sort.',
    categories: [{ id: 'cat1', label: 'C1', choices: ['ch1'] }],
    choices: [{ id: 'ch1', content: 'X' }],
  },
  // No generator: exported as a customInteraction.
  graphing: { prompt: 'Graph.' },
};

// Scoring and identifier shapes the cases above leave out: partial-credit mappings, numeric choice
// values, case-sensitive string mappings and multi-response processing.
const variants: Array<[label: string, name: string, model: Record<string, any>]> = [
  [
    'multiple-choice checkbox with partial credit',
    'multiple-choice',
    {
      choiceMode: 'checkbox',
      choices: [
        { label: 'A', value: '0', correct: true },
        { label: 'B', value: '1', correct: true },
        { label: 'C', value: '2' },
      ],
    },
  ],
  [
    'inline-dropdown with numeric values, two dropdowns',
    'inline-dropdown',
    {
      markup: '<p>{{0}} and {{1}}</p>',
      choices: {
        '0': [{ value: '0', label: 'x', correct: true }, { value: '1', label: 'y' }],
        '1': [{ value: '0', label: 'p' }, { value: '1', label: 'q', correct: true }],
      },
    },
  ],
  [
    'inline-dropdown without partial scoring',
    'inline-dropdown',
    {
      partialScoring: false,
      markup: '<p>{{0}} and {{1}}</p>',
      choices: {
        '0': [{ value: 'a', label: 'x', correct: true }],
        '1': [{ value: 'b', label: 'q', correct: true }],
      },
    },
  ],
  [
    'ebsr with numeric values',
    'ebsr',
    {
      partA: { choices: [{ value: '0', label: 'A', correct: true }, { value: '1', label: 'B' }] },
      partB: { choiceMode: 'checkbox', choices: [{ value: '0', label: 'C', correct: true }] },
    },
  ],
  ['ebsr without partial scoring', 'ebsr', { ...models.ebsr, partialScoring: false }],
  [
    'explicit-constructed-response with alternatives',
    'explicit-constructed-response',
    { correctResponse: ['Paris', 'Lutetia'] },
  ],
  [
    'select-text with two correct tokens',
    'select-text',
    {
      text: 'The cat runs.',
      tokens: [
        { text: 'cat', start: 4, end: 7, correct: true },
        { text: 'runs', start: 8, end: 12, correct: true },
      ],
    },
  ],
  [
    'authored HTML: named entities, void elements, img without alt, underline',
    'multiple-choice',
    {
      prompt: '<p>Read&nbsp;this.<br>Then <u>choose</u>.<img src="a.png"><BR></p>',
      choices: [
        { label: 'A&mdash;B', value: 'a', correct: true },
        { label: '<span style="color: red">C</span><hr>', value: 'b' },
      ],
    },
  ],
  [
    'hotspot with multiple correct',
    'hotspot',
    {
      ...models.hotspot,
      multipleCorrect: true,
      shapes: {
        rectangles: [
          { id: '1', x: 1, y: 2, width: 3, height: 4, correct: true },
          { id: '2', x: 9, y: 2, width: 3, height: 4, correct: true },
        ],
        polygons: [],
      },
    },
  ],
];

const cases: Array<[label: string, name: string, model: Record<string, any>]> = [
  ...Object.entries(models).map(([name, model]): [string, string, Record<string, any>] => [name, name, model]),
  ...variants,
];

function itemFor(name: string, model: Record<string, any>): PieItem {
  const tag = `${name}-el`;
  return {
    id: `1-item-${name}`,
    baseId: 'base-1',
    config: {
      id: 'c',
      models: [{ id: '1', element: tag, ...model }],
      elements: { [tag]: `@pie-element/${name}@3.1.4` },
    },
  } as PieItem;
}

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
