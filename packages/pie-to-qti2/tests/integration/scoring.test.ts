/**
 * Exported response processing scores as the PIE element does.
 *
 * Each item is scored by the QTI item player, so the test exercises the emitted
 * declarations and processing rather than their text.
 */

import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '@pie-qti/item-player/server';
import { validateQti } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQtiPlugin } from '../../src/plugin.js';

const plugin = new PieToQtiPlugin();
const logger = { debug() {}, info() {}, warn() {}, error() {} };

async function exportItem(name: string, model: Record<string, any>): Promise<string> {
  const tag = `${name}-el`;
  const item = {
    id: `item-${name}`,
    config: {
      id: 'c',
      models: [{ id: '1', element: tag, ...model }],
      elements: { [tag]: `@pie-element/${name}@1.0.0` },
    },
  } as PieItem;
  const output = await plugin.transform({ content: item }, { logger });
  return output.items[0].content as string;
}

async function score(name: string, model: Record<string, any>, responses: Record<string, unknown>) {
  const definition = createAssessmentItemDefinition({ itemXml: await exportItem(name, model) });
  const session = definition.openSession({ responses, activate: true });
  const scoring = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
  session.dispose();
  return { score: scoring?.score, maxScore: scoring?.maxScore };
}

describe('Exported scoring matches PIE', () => {
  const checkbox = {
    choiceMode: 'checkbox',
    choices: [
      { value: 'a', label: 'A', correct: true },
      { value: 'b', label: 'B', correct: true },
      { value: 'c', label: 'C' },
    ],
  };

  test('multiple choice checkbox: partial credit by default, with PIE over-selection penalty', async () => {
    expect(await score('multiple-choice', checkbox, { RESPONSE: ['choice-0'] })).toEqual({ score: 0.5, maxScore: 1 });
    expect(await score('multiple-choice', checkbox, { RESPONSE: ['choice-0', 'choice-1'] })).toEqual({
      score: 1,
      maxScore: 1,
    });
    // Two selections for two correct choices: no penalty, as in PIE.
    expect(await score('multiple-choice', checkbox, { RESPONSE: ['choice-0', 'choice-2'] })).toEqual({
      score: 0.5,
      maxScore: 1,
    });
    expect(
      await score('multiple-choice', checkbox, { RESPONSE: ['choice-0', 'choice-1', 'choice-2'] })
    ).toEqual({ score: 0.5, maxScore: 1 });
  });

  test('multiple choice checkbox: all-or-nothing when partialScoring is false', async () => {
    const model = { ...checkbox, partialScoring: false };
    expect((await score('multiple-choice', model, { RESPONSE: ['choice-0'] })).score).toBe(0);
    expect((await score('multiple-choice', model, { RESPONSE: ['choice-1', 'choice-0'] })).score).toBe(1);
  });

  const dropdowns = {
    markup: '<p>{{0}} and {{1}}</p>',
    choices: {
      '0': [
        { value: '0', label: 'x', correct: true },
        { value: '1', label: 'y' },
      ],
      '1': [
        { value: '0', label: 'p' },
        { value: '1', label: 'q', correct: true },
      ],
    },
  };

  test('inline dropdown: fraction of dropdowns correct, or all of them without partial scoring', async () => {
    const oneRight = { RESPONSE_0: 'CHOICE_0', RESPONSE_1: 'CHOICE_0' };
    const bothRight = { RESPONSE_0: 'CHOICE_0', RESPONSE_1: 'CHOICE_1' };
    expect((await score('inline-dropdown', dropdowns, oneRight)).score).toBe(0.5);
    expect((await score('inline-dropdown', dropdowns, bothRight)).score).toBe(1);
    expect((await score('inline-dropdown', { ...dropdowns, partialScoring: false }, oneRight)).score).toBe(0);
    expect((await score('inline-dropdown', { ...dropdowns, partialScoring: false }, bothRight)).score).toBe(1);
  });

  const ebsr = {
    partA: {
      choices: [
        { value: '0', label: 'A', correct: true },
        { value: '1', label: 'B' },
      ],
    },
    partB: {
      choices: [
        { value: '0', label: 'C' },
        { value: '1', label: 'D', correct: true },
      ],
    },
  };

  test('EBSR: 2 for both parts and 1 for Part A alone; 1 for both without partial scoring', async () => {
    expect(await score('ebsr', ebsr, { RESPONSE_A: 'CHOICE_0', RESPONSE_B: 'CHOICE_1' })).toEqual({
      score: 2,
      maxScore: 2,
    });
    expect((await score('ebsr', ebsr, { RESPONSE_A: 'CHOICE_0', RESPONSE_B: 'CHOICE_0' })).score).toBe(1);
    expect((await score('ebsr', ebsr, { RESPONSE_A: 'CHOICE_1', RESPONSE_B: 'CHOICE_1' })).score).toBe(0);

    const dichotomous = { ...ebsr, partialScoring: false };
    expect(await score('ebsr', dichotomous, { RESPONSE_A: 'CHOICE_0', RESPONSE_B: 'CHOICE_1' })).toEqual({
      score: 1,
      maxScore: 1,
    });
    expect((await score('ebsr', dichotomous, { RESPONSE_A: 'CHOICE_0', RESPONSE_B: 'CHOICE_0' })).score).toBe(0);
  });

  test('explicit constructed response: every accepted answer scores, case-sensitively', async () => {
    const model = { correctResponse: ['Paris', 'Lutetia'] };
    expect((await score('explicit-constructed-response', model, { RESPONSE: 'Paris' })).score).toBe(1);
    expect((await score('explicit-constructed-response', model, { RESPONSE: 'Lutetia' })).score).toBe(1);
    expect((await score('explicit-constructed-response', model, { RESPONSE: 'paris' })).score).toBe(0);
  });

  test('placement ordering: all-or-nothing', async () => {
    const model = {
      choices: [
        { id: '0', label: 'A' },
        { id: '1', label: 'B' },
      ],
      correctResponse: [{ id: '1' }, { id: '0' }],
    };
    expect((await score('placement-ordering', model, { RESPONSE: ['CHOICE_1', 'CHOICE_0'] })).score).toBe(1);
    expect((await score('placement-ordering', model, { RESPONSE: ['CHOICE_0', 'CHOICE_1'] })).score).toBe(0);
  });

  test('select text: partial credit per correct token, and more than one selection allowed', async () => {
    const model = {
      text: 'The cat runs quickly.',
      tokens: [
        { text: 'cat', start: 4, end: 7, correct: true },
        { text: 'runs', start: 8, end: 12, correct: true },
        { text: 'quickly', start: 13, end: 20 },
      ],
    };
    expect((await score('select-text', model, { RESPONSE: ['TOKEN_0'] })).score).toBe(0.5);
    expect((await score('select-text', model, { RESPONSE: ['TOKEN_0', 'TOKEN_1'] })).score).toBe(1);
  });

  test('extended response: declares SCORE for a human scorer and processes nothing', async () => {
    const xml = await exportItem('extended-response', { prompt: 'Explain.' });
    expect(xml).toContain('identifier="SCORE"');
    expect(xml).not.toContain('<responseProcessing');
  });
});

describe('Multi-interaction items', () => {
  const radio = {
    choiceMode: 'radio',
    choices: [
      { value: 'a', label: 'A', correct: true },
      { value: 'b', label: 'B' },
    ],
  };
  const dropdowns = {
    markup: '<p>{{0}} and {{1}}</p>',
    choices: {
      '0': [{ value: '0', label: 'x', correct: true }, { value: '1', label: 'y' }],
      '1': [{ value: '0', label: 'p' }, { value: '1', label: 'q', correct: true }],
    },
  };

  async function exportMulti(models: Array<[name: string, model: Record<string, any>]>): Promise<string> {
    const item = {
      id: 'item-multi',
      config: {
        id: 'c',
        models: models.map(([name, model], i) => ({ id: String(i + 1), element: `${name}-el`, ...model })),
        elements: Object.fromEntries(models.map(([name]) => [`${name}-el`, `@pie-element/${name}@1.0.0`])),
      },
    } as PieItem;
    const output = await plugin.transform({ content: item }, { logger });
    return output.items[0].content as string;
  }

  async function scoreXml(xml: string, responses: Record<string, unknown>) {
    const session = createAssessmentItemDefinition({ itemXml: xml }).openSession({ responses, activate: true });
    const scoring = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
    session.dispose();
    return { score: scoring?.score, maxScore: scoring?.maxScore };
  }

  test('every interaction is exported, with part-scoped identifiers, and validates', async () => {
    const xml = await exportMulti([
      ['multiple-choice', radio],
      ['multiple-choice', radio],
      ['inline-dropdown', dropdowns],
      ['extended-response', { prompt: 'Explain.' }],
    ]);
    for (const id of ['RESPONSE1', 'RESPONSE2', 'RESPONSE3_0', 'RESPONSE3_1', 'RESPONSE4']) {
      expect(xml).toContain(`responseIdentifier="${id}"`);
    }
    expect(xml).toContain('identifier="P1_choice-0"');
    expect(xml).toContain('identifier="P2_choice-0"');

    const validation = await validateQti(xml, { xsdSeverity: 'error' });
    expect(validation.errors.map((error) => error.message)).toEqual([]);
    }, 30_000);

  test('SCORE sums the parts, and an externally scored part adds only to MAXSCORE', async () => {
    const xml = await exportMulti([
      ['multiple-choice', radio],
      ['inline-dropdown', dropdowns],
      ['extended-response', { prompt: 'Explain.' }],
    ]);
    expect(
      await scoreXml(xml, { RESPONSE1: 'P1_choice-0', RESPONSE2_0: 'P2_CHOICE_0', RESPONSE2_1: 'P2_CHOICE_0' })
    ).toEqual({ score: 1.5, maxScore: 3 });
    expect(
      await scoreXml(xml, { RESPONSE1: 'P1_choice-1', RESPONSE2_0: 'P2_CHOICE_0', RESPONSE2_1: 'P2_CHOICE_1' })
    ).toEqual({ score: 1, maxScore: 3 });
  });

  test('a partial-credit mapping keeps scoring after its keys are renamed', async () => {
    const checkbox = {
      choiceMode: 'checkbox',
      choices: [
        { value: 'a', label: 'A', correct: true },
        { value: 'b', label: 'B', correct: true },
        { value: 'c', label: 'C' },
      ],
    };
    const xml = await exportMulti([
      ['explicit-constructed-response', { correctResponse: ['Paris', 'Lutetia'] }],
      ['multiple-choice', checkbox],
    ]);
    expect(await scoreXml(xml, { RESPONSE1: 'Lutetia', RESPONSE2: ['P2_choice-0', 'P2_choice-2'] })).toEqual({
      score: 1.5,
      maxScore: 2,
    });
  });
});
