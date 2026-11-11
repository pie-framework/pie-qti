/**
 * Identifier safety: PIE ids and values are author-supplied and reach QTI identifier
 * attributes. Ids containing quotes or spaces must not break the attribute or corrupt
 * the directedPair correct responses, and well-formed ids must generate byte-identical
 * output to before.
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem } from '@pie-qti/transform-types';
import { validateQti } from '@pie-qti/to-pie';
import { CategorizeGenerator } from '../../src/generators/categorize.js';
import { DragInTheBlankGenerator } from '../../src/generators/drag-in-the-blank.js';
import { ImageClozeAssociationGenerator } from '../../src/generators/image-cloze-association.js';
import { MatchListGenerator } from '../../src/generators/match-list.js';
import type { GeneratorContext } from '../../src/generators/types.js';

const logger = { debug() {}, info() {}, warn() {}, error() {} };

function context(model: Record<string, any>): GeneratorContext {
  return { pieItem: { id: 'item-1' } as PieItem, model, logger };
}

describe('generator identifier safety', () => {
  test('categorize keeps well-formed ids unchanged', () => {
    const result = new CategorizeGenerator().generate(
      context({
        categories: [{ id: 'cat1', label: 'C1', choices: ['ch1'] }],
        choices: [{ id: 'ch1', content: 'X' }],
      }),
    );
    expect(result.qti).toContain('identifier="cat1"');
    expect(result.qti).toContain('identifier="ch1"');
    expect(result.qti).toContain('<value>ch1 cat1</value>');
  });

  test('categorize sanitizes ids containing quotes and spaces', async () => {
    const result = new CategorizeGenerator().generate(
      context({
        categories: [{ id: 'cat"1', label: 'C1', choices: ['ch 1'] }],
        choices: [{ id: 'ch 1', content: 'X' }],
      }),
    );
    const xml = result.qti;

    // The quote must not terminate the attribute, and both pair members must be
    // sanitized the same way in the body and in the directedPair response.
    expect(xml).not.toContain('"cat"1"');
    expect(xml).not.toContain('"ch 1"');
    const identifiers = [...xml.matchAll(/identifier="([^"]*)"/g)].map((match) => match[1]);
    expect(identifiers).toContain('cat-1');
    expect(identifiers).toContain('ch-1');
    expect(xml).toContain('<value>ch-1 cat-1</value>');

    const validation = await validateQti(xml, { xsdSeverity: 'error' });
    expect(validation.errors.map((error) => error.message)).toEqual([]);
  });

  test('match-list keeps numeric ids unchanged', () => {
    const result = new MatchListGenerator().generate(
      context({
        prompts: [{ id: 1, title: 'P1', relatedAnswer: 1 }],
        answers: [{ id: 1, title: 'A1' }],
      }),
    );
    expect(result.qti).toContain('identifier="PROMPT_1"');
    expect(result.qti).toContain('identifier="ANSWER_1"');
    expect(result.qti).toContain('<value>PROMPT_1 ANSWER_1</value>');
  });

  test('match-list sanitizes string ids containing quotes', async () => {
    const result = new MatchListGenerator().generate(
      context({
        prompts: [{ id: '1" onload="x', title: 'P1', relatedAnswer: 1 }],
        answers: [{ id: 1, title: 'A1' }],
      }),
    );
    const xml = result.qti;

    expect(xml).not.toContain('"PROMPT_1" onload="x"');
    const identifiers = [...xml.matchAll(/identifier="([^"]*)"/g)].map((match) => match[1]);
    expect(identifiers).toContain('PROMPT_1__onload__x');
    expect(xml).toContain('<value>PROMPT_1__onload__x ANSWER_1</value>');

    const validation = await validateQti(xml, { xsdSeverity: 'error' });
    expect(validation.errors.map((error) => error.message)).toEqual([]);
  });

  test('drag-in-the-blank keeps well-formed values unchanged', () => {
    const result = new DragInTheBlankGenerator().generate(
      context({
        markup: 'The {{0}} ran.',
        choices: { '0': [{ value: 'dog', label: 'dog', correct: true }] },
      }),
    );
    expect(result.qti).toContain('identifier="CHOICE_0_dog"');
    expect(result.qti).toContain('identifier="GAP_0"');
    expect(result.qti).toContain('<value>CHOICE_0_dog GAP_0</value>');
  });

  test('drag-in-the-blank sanitizes values containing quotes and spaces', async () => {
    const result = new DragInTheBlankGenerator().generate(
      context({
        markup: 'The {{0}} ran.',
        choices: { '0': [{ value: 'big" dog', label: 'big dog', correct: true }] },
      }),
    );
    const xml = result.qti;

    expect(xml).not.toContain('"CHOICE_0_big" dog"');
    const identifiers = [...xml.matchAll(/identifier="([^"]*)"/g)].map((match) => match[1]);
    expect(identifiers).toContain('CHOICE_0_big__dog');
    expect(xml).toContain('<value>CHOICE_0_big__dog GAP_0</value>');

    const validation = await validateQti(xml, { xsdSeverity: 'error' });
    expect(validation.errors.map((error) => error.message)).toEqual([]);
  });

  test('image-cloze-association keeps well-formed ids unchanged', () => {
    const result = new ImageClozeAssociationGenerator().generate(
      context({
        imageUrl: 'i.png',
        responseContainers: [{ id: 'c1', x: 1, y: 2, width: 3, height: 4, correctResponse: 'r1' }],
        possibleResponses: [{ id: 'r1', value: 'x' }],
      }),
    );
    expect(result.qti).toContain('identifier="RESPONSE_r1"');
    expect(result.qti).toContain('identifier="CONTAINER_c1"');
    expect(result.qti).toContain('<value>RESPONSE_r1 CONTAINER_c1</value>');
  });

  test('image-cloze-association sanitizes ids containing quotes and spaces', async () => {
    const result = new ImageClozeAssociationGenerator().generate(
      context({
        imageUrl: 'i.png',
        responseContainers: [{ id: 'c"1', x: 1, y: 2, width: 3, height: 4, correctResponse: 'r 1' }],
        possibleResponses: [{ id: 'r 1', value: 'x' }],
      }),
    );
    const xml = result.qti;

    expect(xml).not.toContain('"RESPONSE_r"1"');
    expect(xml).not.toContain('"CONTAINER_c"1"');
    const identifiers = [...xml.matchAll(/identifier="([^"]*)"/g)].map((match) => match[1]);
    expect(identifiers).toContain('RESPONSE_r_1');
    expect(identifiers).toContain('CONTAINER_c_1');
    expect(xml).toContain('<value>RESPONSE_r_1 CONTAINER_c_1</value>');

    const validation = await validateQti(xml, { xsdSeverity: 'error' });
    expect(validation.errors.map((error) => error.message)).toEqual([]);
  });
});
