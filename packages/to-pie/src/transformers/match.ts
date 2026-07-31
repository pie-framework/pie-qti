/**
 * QTI 2.1/2.2 matchInteraction to PIE match transformer
 *
 * Transforms QTI matchInteraction elements into PIE match items.
 * Handles stem-to-option matching tasks where students match items from two sets.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { extractPromptForInteraction } from '../utils/prompt-extraction.js';
import { createMissingInteractionError } from '../utils/qti-errors.js';
import {
  deriveItemScoring,
  findResponseDeclaration,
  readCorrectResponseValues,
  readMapping,
} from '../utils/response-scoring.js';

export interface MatchOptions {
  /** Overrides the partial scoring derived from the QTI source. */
  partialScoring?: boolean;
  /** Choice mode: radio (single selection) or checkbox (multiple) */
  choiceMode?: 'radio' | 'checkbox';
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Row {
  id: string;
  title: string;
  values: boolean[];
}

/**
 * Transform QTI matchInteraction to PIE match
 */
export function transformMatch(
  qtiXml: string,
  itemId: string,
  options?: MatchOptions
): PieItem {
  const document = parse(qtiXml);
  const matchInteraction = document.getElementsByTagName('matchInteraction')[0];

  if (!matchInteraction) {
    throw createMissingInteractionError('matchInteraction', {
      itemId,
      details: 'For matching questions, use <matchInteraction> with two <simpleMatchSet> elements.',
    });
  }

  const responseIdentifier = matchInteraction.getAttribute('responseIdentifier') || 'RESPONSE';
  const shuffle = matchInteraction.getAttribute('shuffle');

  // Extract prompt
  const itemBody = document.getElementsByTagName('itemBody')[0];
  const prompt = itemBody ? extractPromptForInteraction(itemBody, matchInteraction) : '';

  // Extract correct answers from responseDeclaration
  const correctAnswers = extractCorrectAnswers(document, responseIdentifier);

  // Extract headers (column labels from second match set)
  const headers = extractHeaders(matchInteraction);

  // Extract rows (stems from first match set with their correct answers)
  const rows = extractRows(matchInteraction, correctAnswers);

  const modelId = uuid();
  const scoring = deriveItemScoring(document);

  const pieItem: PieItem = {
    id: itemId,
    ...(options?.baseId && { baseId: options.baseId }),
    uuid: modelId,
    config: {
      id: modelId,
      models: [
        {
          id: modelId,
          element: '@pie-element/match',
          prompt: prompt || '',
          lockChoiceOrder: shuffle === 'false',
          partialScoring: options?.partialScoring ?? scoring.partialScoring,
          choiceMode: options?.choiceMode || 'radio',
          layout: headers.length - 1, // Exclude first empty header
          headers,
          rows,
        },
      ],
      elements: {
        match: '@pie-element/match@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'MA',
        source: 'qti22',
        ...(scoring.weight !== undefined && { maxScore: scoring.weight }),
      },
    },
  };

  return pieItem;
}

/**
 * Extract correct answers from responseDeclaration
 * Returns a map of stem identifier to option identifier
 */
function extractCorrectAnswers(
  document: HTMLElement,
  responseIdentifier: string
): Map<string, string> {
  const correctAnswers = new Map<string, string>();
  const responseDeclaration = findResponseDeclaration(document, responseIdentifier);

  if (!responseDeclaration) {
    return correctAnswers;
  }

  const declared = readCorrectResponseValues(responseDeclaration);

  // An item scored via map_response need not declare a correctResponse at all.
  // Fall back to the mapping only when the declared key produced nothing, and
  // only for strictly positive mappedValues — a zero-scoring mapEntry is a
  // distractor pair, not an answer.
  const pairs = declared.length > 0 ? declared : (readMapping(responseDeclaration)?.positiveKeys ?? []);

  for (const pair of pairs) {
    // QTI format: "stemId optionId" (space-separated directed pair)
    const [stemId, optionId] = pair.split(/\s+/);
    if (stemId && optionId) {
      correctAnswers.set(stemId, optionId);
    }
  }

  return correctAnswers;
}

/**
 * Extract headers from second simpleMatchSet
 * Headers are the column labels (options that stems are matched against)
 */
function extractHeaders(matchInteraction: HTMLElement): string[] {
  const headers = [''];
  const simpleMatchSets = matchInteraction.getElementsByTagName('simpleMatchSet');

  if (simpleMatchSets.length < 2) {
    return headers;
  }

  const options = simpleMatchSets[1].getElementsByTagName('simpleAssociableChoice');
  for (const option of Array.from(options)) {
    headers.push(option.innerHTML.trim());
  }

  return headers;
}

/**
 * Extract rows from first simpleMatchSet
 * Each row represents a stem with its correct answer values
 */
function extractRows(
  matchInteraction: HTMLElement,
  correctAnswers: Map<string, string>
): Row[] {
  const rows: Row[] = [];
  const simpleMatchSets = matchInteraction.getElementsByTagName('simpleMatchSet');

  if (simpleMatchSets.length < 2) {
    return rows;
  }

  const stems = simpleMatchSets[0].getElementsByTagName('simpleAssociableChoice');
  const options = simpleMatchSets[1].getElementsByTagName('simpleAssociableChoice');

  for (let i = 0; i < stems.length; i++) {
    const stem = stems[i];
    const stemId = stem.getAttribute('identifier') || `stem-${i}`;
    const stemTitle = stem.innerHTML.trim();
    const correctOptionId = correctAnswers.get(stemId);

    const values: boolean[] = [];
    for (const option of Array.from(options)) {
      const optionId = option.getAttribute('identifier') || '';
      values.push(optionId === correctOptionId);
    }

    rows.push({
      id: String(i + 1),
      title: stemTitle,
      values,
    });
  }

  return rows;
}
