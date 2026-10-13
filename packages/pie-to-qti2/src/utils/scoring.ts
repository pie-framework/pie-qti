/**
 * Scoring
 *
 * Every exported item declares `SCORE` and `MAXSCORE`. An item with one response references a
 * standard response processing template; an item with several gets explicit processing. Partial
 * credit follows PIE, where it is on unless the model sets `partialScoring: false`. A QTI mapping
 * cannot express each element's own penalty rule, so partial credit maps each correct value to 1/n
 * and any other value to -1/n, bounded to [0, 1]. A deliberate trade: any QTI engine can score the
 * item, at the cost of differing from PIE on some over-selections. The PIE rule travels in the
 * source sidecar. Multiple choice, EBSR and inline dropdown are scored by their PIE rule exactly.
 */

import type { ResponseDeclarationOptions } from '../types/index.js';
import { buildOutcomeDeclaration } from './response-declaration-builder.js';

const RP_TEMPLATES = 'http://www.imsglobal.org/question/qti_v2p2/rptemplates';

export interface ItemScoring {
  outcomeDeclarations: string[];
  responseProcessing?: string;
}

type ResponseMapping = Pick<ResponseDeclarationOptions, 'mapping' | 'mappingBounds'>;

export function partialScoringEnabled(model: object): boolean {
  return (model as { partialScoring?: unknown }).partialScoring !== false;
}

function scoreOutcomes(maxScore: number): string[] {
  return [
    buildOutcomeDeclaration('SCORE', 'single', 'float', 0),
    buildOutcomeDeclaration('MAXSCORE', 'single', 'float', maxScore),
  ];
}

export function templateScoring(template: 'match_correct' | 'map_response'): ItemScoring {
  return {
    outcomeDeclarations: scoreOutcomes(1),
    responseProcessing: `<responseProcessing template="${RP_TEMPLATES}/${template}"/>`,
  };
}

/**
 * Scoring for a response a QTI engine cannot score: human-scored, or scored by the PIE element.
 */
export function externalScoring(maxScore = 1): ItemScoring {
  return { outcomeDeclarations: scoreOutcomes(maxScore) };
}

export function partialCreditMapping(correctValues: string[]): ResponseMapping {
  const weight = 1 / correctValues.length;
  return {
    mapping: correctValues.map((mapKey) => ({ mapKey, mappedValue: weight })),
    mappingBounds: { defaultValue: -weight, lowerBound: 0, upperBound: 1 },
  };
}

/**
 * Scoring for one response with known correct values: partial credit through a mapping when the
 * response has more than one correct value, otherwise all-or-nothing.
 */
export function correctResponseScoring(
  correctValues: string[],
  partial: boolean
): { mapping: ResponseMapping; scoring: ItemScoring } {
  if (partial && correctValues.length > 1) {
    return { mapping: partialCreditMapping(correctValues), scoring: templateScoring('map_response') };
  }
  return { mapping: {}, scoring: templateScoring('match_correct') };
}

export function matchesCorrect(responseId: string): string {
  return `<match><variable identifier="${responseId}"/><correct identifier="${responseId}"/></match>`;
}

export function setScore(expression: string): string {
  return `<setOutcomeValue identifier="SCORE">${expression}</setOutcomeValue>`;
}

export function floatValue(value: number): string {
  return `<baseValue baseType="float">${value}</baseValue>`;
}

/**
 * Scoring for several responses of equal weight: with partial credit each matching response adds
 * 1/n to `SCORE`; without it `SCORE` is 1 only when every response matches.
 */
export function allResponsesScoring(responseIds: string[], partial: boolean): ItemScoring {
  if (responseIds.length === 1) {
    return templateScoring('match_correct');
  }
  const conditions = partial
    ? responseIds.map(
        (id) =>
          `<responseCondition><responseIf>${matchesCorrect(id)}${setScore(`<sum><variable identifier="SCORE"/>${floatValue(1 / responseIds.length)}</sum>`)}</responseIf></responseCondition>`
      )
    : [
        `<responseCondition><responseIf><and>${responseIds.map(matchesCorrect).join('')}</and>${setScore(floatValue(1))}</responseIf></responseCondition>`,
      ];
  return {
    outcomeDeclarations: scoreOutcomes(1),
    responseProcessing: `<responseProcessing>\n    ${conditions.join('\n    ')}\n  </responseProcessing>`,
  };
}

/**
 * PIE's multiple-choice rule, exactly: each selected correct choice earns 1/n, and selections
 * beyond the n correct ones each cost 1/n, floored at 0.
 */
export function choiceSelectionScoring(responseId: string, correctValues: string[]): ItemScoring {
  const n = correctValues.length;
  const countCorrect = correctValues.map(
    (value) =>
      `<responseCondition><responseIf><member><baseValue baseType="identifier">${value}</baseValue><variable identifier="${responseId}"/></member>${setScore(`<sum><variable identifier="SCORE"/>${floatValue(1)}</sum>`)}</responseIf></responseCondition>`
  );
  const extraSelections = `<max><baseValue baseType="integer">0</baseValue><subtract><containerSize><variable identifier="${responseId}"/></containerSize><baseValue baseType="integer">${n}</baseValue></subtract></max>`;
  const finalScore = setScore(
    `<max>${floatValue(0)}<divide><subtract><variable identifier="SCORE"/>${extraSelections}</subtract>${floatValue(n)}</divide></max>`
  );
  return customScoring(1, [...countCorrect, finalScore]);
}

/**
 * Explicit response processing with its own maximum.
 */
export function customScoring(maxScore: number, conditions: string[]): ItemScoring {
  return {
    outcomeDeclarations: scoreOutcomes(maxScore),
    responseProcessing: `<responseProcessing>\n    ${conditions.join('\n    ')}\n  </responseProcessing>`,
  };
}
