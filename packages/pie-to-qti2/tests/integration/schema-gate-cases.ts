/**
 * The items both schema gates export: one per generator, plus the scoring and identifier shapes
 * the generators branch on. Items use the delivered shape: each model names its element by tag,
 * and `config.elements` maps the tag to a versioned package.
 */

import type { PieItem } from '@pie-qti/transform-types';

export const models: Record<string, Record<string, any>> = {
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

export const cases: Array<[label: string, name: string, model: Record<string, any>]> = [
  ...Object.entries(models).map(([name, model]): [string, string, Record<string, any>] => [name, name, model]),
  ...variants,
];

export function itemFor(name: string, model: Record<string, any>): PieItem {
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
