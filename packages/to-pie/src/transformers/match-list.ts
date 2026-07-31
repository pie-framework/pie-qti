/**
 * QTI matchInteraction to PIE match-list transformer
 *
 * Transforms QTI matchInteraction elements into PIE match-list items.
 * Handles matching interactions where students pair items from two lists.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { extractPromptForInteraction } from '../utils/prompt-extraction.js';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';
import {
  deriveItemScoring,
  findResponseDeclaration,
  readCorrectResponseValues,
  readMapping,
} from '../utils/response-scoring.js';

export interface MatchListOptions {
  /** Whether to lock the choice order (false = shuffle) */
  lockChoiceOrder?: boolean;
  /** Whether to allow duplicate answers */
  duplicates?: boolean;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Prompt {
  id: number;
  title: string;
  relatedAnswer: number;
}

interface Answer {
  id: number;
  title: string;
}

/**
 * Transform QTI matchInteraction to PIE match-list
 */
export function transformMatchList(
  qtiXml: string,
  itemId: string,
  options?: MatchListOptions
): PieItem {
  const document = parse(qtiXml);
  const itemBody = document.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  const matchInteraction = itemBody.getElementsByTagName('matchInteraction')[0];

  if (!matchInteraction) {
    throw createMissingInteractionError('matchInteraction', {
      itemId,
      details: 'For matching questions, use <matchInteraction> with two <simpleMatchSet> elements.',
    });
  }

  const responseIdentifier = matchInteraction.getAttribute('responseIdentifier') || 'RESPONSE';

  // Extract prompt
  const prompt = extractPrompt(itemBody, matchInteraction);

  // Extract correct answers
  const correctAnswers = extractCorrectAnswers(document, responseIdentifier);

  // Check for duplicates
  const hasDuplicates = options?.duplicates ?? checkForDuplicates(correctAnswers);

  // Get shuffle setting
  const shuffle = matchInteraction.getAttribute('shuffle') === 'true';
  const lockChoiceOrder = options?.lockChoiceOrder ?? !shuffle;

  // Extract match sets
  const { prompts, answers } = extractMatchSets(matchInteraction, correctAnswers);

  const modelId = uuid();
  // The match-list element has no partialScoring field, so only the item weight
  // is carried across.
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
          element: '@pie-element/match-list',
          prompt: prompt || '',
          prompts,
          answers,
          lockChoiceOrder,
          duplicates: hasDuplicates,
        },
      ],
      elements: {
        'match-list': '@pie-element/match-list@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'ML',
        source: 'qti22',
        ...(scoring.weight !== undefined && { maxScore: scoring.weight }),
      },
    },
  };

  return pieItem;
}

/**
 * Extract prompt from itemBody or interaction
 */
function extractPrompt(itemBody: HTMLElement, interaction: HTMLElement): string | null {
  return extractPromptForInteraction(itemBody, interaction) || null;
}

/**
 * Extract correct answers from responseDeclaration
 * Returns a map of prompt identifier -> answer identifier
 */
function extractCorrectAnswers(document: HTMLElement, responseIdentifier: string): Map<string, string> {
  const correctAnswers = new Map<string, string>();
  const responseDeclaration = findResponseDeclaration(document, responseIdentifier);

  if (!responseDeclaration) {
    return correctAnswers;
  }

  const declared = readCorrectResponseValues(responseDeclaration);

  // An item scored via map_response need not declare a correctResponse at all.
  // Fall back to the mapping only when the declared key produced nothing, and
  // only for strictly positive mappedValues. The sign check is load-bearing:
  // real publisher content ships mappings whose every mapEntry is
  // mappedValue="0" while the real key sits in correctResponse, and an unsigned
  // reading of those pairs up every listed prompt with a distractor.
  const pairs = declared.length > 0 ? declared : (readMapping(responseDeclaration)?.positiveKeys ?? []);

  for (const pair of pairs) {
    // QTI format: "promptId answerId" (directed pair)
    const parts = pair.split(/\s+/);
    if (parts.length >= 2) {
      correctAnswers.set(parts[0], parts[1]);
    }
  }

  return correctAnswers;
}

/**
 * Check if there are duplicate answers
 */
function checkForDuplicates(correctAnswers: Map<string, string>): boolean {
  const seen = new Set<string>();
  for (const [, answerId] of correctAnswers) {
    if (seen.has(answerId)) {
      return true;
    }
    seen.add(answerId);
  }
  return false;
}

/**
 * Extract match sets (prompts and answers)
 */
function extractMatchSets(
  interaction: HTMLElement,
  correctAnswers: Map<string, string>
): { prompts: Prompt[]; answers: Answer[] } {
  const simpleMatchSets = interaction.getElementsByTagName('simpleMatchSet');

  if (simpleMatchSets.length < 2) {
    throw new Error('matchInteraction must have 2 simpleMatchSet elements');
  }

  // First set: prompts (source)
  const promptSet = simpleMatchSets[0];
  const promptChoices = promptSet.getElementsByTagName('simpleAssociableChoice');

  // Second set: answers (target)
  const answerSet = simpleMatchSets[1];
  const answerChoices = answerSet.getElementsByTagName('simpleAssociableChoice');

  // Build answers list
  const answers: Answer[] = [];
  for (let i = 0; i < answerChoices.length; i++) {
    const choice = answerChoices[i];
    answers.push({
      id: i,
      title: choice.innerHTML.trim(),
    });
  }

  // Build prompts list with correct answer relationships
  const prompts: Prompt[] = [];
  for (let i = 0; i < promptChoices.length; i++) {
    const choice = promptChoices[i];
    const identifier = choice.getAttribute('identifier') || '';
    const answerIdentifier = correctAnswers.get(identifier);

    // Find the index of the correct answer
    let relatedAnswer = 0;
    if (answerIdentifier) {
      for (let j = 0; j < answerChoices.length; j++) {
        if (answerChoices[j].getAttribute('identifier') === answerIdentifier) {
          relatedAnswer = j;
          break;
        }
      }
    }

    prompts.push({
      id: i,
      title: choice.innerHTML.trim(),
      relatedAnswer,
    });
  }

  return { prompts, answers };
}
