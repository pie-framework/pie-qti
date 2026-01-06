/**
 * QTI matchInteraction to PIE match-list transformer
 *
 * Transforms QTI matchInteraction elements into PIE match-list items.
 * Handles matching interactions where students pair items from two lists.
 */

import type { PieItem } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

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

  // Extract prompt
  const prompt = extractPrompt(itemBody, matchInteraction);

  // Extract correct answers
  const correctAnswers = extractCorrectAnswers(document);

  // Check for duplicates
  const hasDuplicates = options?.duplicates ?? checkForDuplicates(correctAnswers);

  // Get shuffle setting
  const shuffle = matchInteraction.getAttribute('shuffle') === 'true';
  const lockChoiceOrder = options?.lockChoiceOrder ?? !shuffle;

  // Extract match sets
  const { prompts, answers } = extractMatchSets(matchInteraction, correctAnswers);

  const modelId = uuid();

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
      },
    },
  };

  return pieItem;
}

/**
 * Extract prompt from itemBody or interaction
 */
function extractPrompt(itemBody: HTMLElement, interaction: HTMLElement): string | null {
  // Look for prompt inside interaction first
  const promptElement = interaction.getElementsByTagName('prompt')[0];
  if (promptElement) {
    return promptElement.innerHTML.trim();
  }

  // Look for content before interaction in itemBody
  let promptHtml = '';
  for (const child of itemBody.childNodes) {
    if (child === interaction) break;

    if (child.nodeType === 3) {
      // Text node
      const text = child.textContent?.trim();
      if (text) promptHtml += text;
    } else if ((child as HTMLElement).tagName) {
      const element = child as HTMLElement;
      if (element.tagName === 'matchInteraction') break;
      promptHtml += element.outerHTML;
    }
  }

  return promptHtml.trim() || null;
}

/**
 * Extract correct answers from responseDeclaration
 * Returns a map of prompt identifier -> answer identifier
 */
function extractCorrectAnswers(document: HTMLElement): Map<string, string> {
  const correctAnswers = new Map<string, string>();
  const correctResponseElements = document.getElementsByTagName('correctResponse');

  if (correctResponseElements.length > 0) {
    const values = correctResponseElements[0].getElementsByTagName('value');
    for (const value of Array.from(values)) {
      const text = value.textContent?.trim();
      if (!text) continue;

      // QTI format: "promptId answerId" (directed pair)
      const parts = text.split(/\s+/);
      if (parts.length >= 2) {
        correctAnswers.set(parts[0], parts[1]);
      }
    }
    return correctAnswers;
  }

  // Try mapping if no correctResponse
  const mappings = document.getElementsByTagName('mapping');
  if (mappings.length > 0) {
    const mapEntries = mappings[0].getElementsByTagName('mapEntry');
    for (const mapEntry of Array.from(mapEntries)) {
      const mapKey = mapEntry.getAttribute('mapKey');
      if (!mapKey) continue;

      const parts = mapKey.split(/\s+/);
      if (parts.length >= 2) {
        correctAnswers.set(parts[0], parts[1]);
      }
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
