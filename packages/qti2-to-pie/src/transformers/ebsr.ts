/**
 * QTI EBSR (Evidence-Based Selected Response) to PIE ebsr transformer
 *
 * Transforms QTI two-part choiceInteraction elements into PIE EBSR items.
 * EBSR consists of two parts - typically Part A asks a question and Part B
 * asks for evidence to support the answer to Part A.
 */

import type { PieItem } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createInsufficientElementsError, createMissingElementError } from '../utils/qti-errors.js';

export interface EbsrOptions {
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Whether to show part labels (Part A, Part B) */
  partLabels?: boolean;
  /** Type of part label ('Letters' or 'Numbers') */
  partLabelType?: 'Letters' | 'Numbers';
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Choice {
  label: string;
  value: string;
  correct?: boolean;
  feedback?: string;
}

interface EbsrPart {
  prompt?: string;
  choices: Choice[];
  choiceMode: 'radio' | 'checkbox';
  lockChoiceOrder: boolean;
  choicePrefix?: 'letters' | 'numbers' | 'none';
  feedbackEnabled?: boolean;
}

/**
 * Transform QTI EBSR (two-part choiceInteraction) to PIE ebsr
 */
export function transformEbsr(
  qtiXml: string,
  itemId: string,
  options?: EbsrOptions
): PieItem {
  const document = parse(qtiXml);
  const itemBody = document.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'The <itemBody> element is required to contain the question content and interactions.',
    });
  }

  const choiceInteractions = itemBody.getElementsByTagName('choiceInteraction');

  if (choiceInteractions.length < 2) {
    throw createInsufficientElementsError(
      'choiceInteraction',
      2,
      choiceInteractions.length,
      {
        itemId,
        details: 'EBSR (Evidence-Based Selected Response) questions require two parts: Part A asks a question and Part B asks for supporting evidence.',
      }
    );
  }

  // Extract correct answer map (responseId -> correct identifiers)
  const correctAnswerMap = extractCorrectAnswerMap(document);

  // Extract shared prompt/stem for Part A (content before first interaction)
  const sharedPrompt = extractSharedPrompt(itemBody, choiceInteractions[0]);

  // Build Part A
  const partA = buildPart(
    choiceInteractions[0],
    correctAnswerMap,
    sharedPrompt,
    document
  );

  // Build Part B
  const partB = buildPart(
    choiceInteractions[1],
    correctAnswerMap,
    null,
    document
  );

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
          element: '@pie-element/ebsr',
          partLabels: options?.partLabels ?? false,
          partLabelType: options?.partLabelType ?? 'Letters',
          partialScoring: options?.partialScoring ?? true,
          partA,
          partB,
        },
      ],
      elements: {
        ebsr: '@pie-element/ebsr@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'EBSR',
        source: 'qti22',
      },
    },
  };

  return pieItem;
}

/**
 * Extract shared prompt/stem content before the first interaction
 */
function extractSharedPrompt(
  itemBody: HTMLElement,
  firstInteraction: HTMLElement
): string | null {
  let promptHtml = '';

  // Collect all content before first interaction
  for (const child of itemBody.childNodes) {
    if (child === firstInteraction) break;

    if (child.nodeType === 3) {
      // Text node
      const text = child.textContent?.trim();
      if (text) promptHtml += text;
    } else if ((child as HTMLElement).tagName) {
      const element = child as HTMLElement;
      // Skip if it's the interaction itself
      if (element.tagName === 'choiceInteraction') break;
      promptHtml += element.outerHTML;
    }
  }

  return promptHtml.trim() || null;
}

/**
 * Build an EBSR part from a choiceInteraction
 */
function buildPart(
  choiceInteraction: HTMLElement,
  correctAnswerMap: Map<string, string[]>,
  sharedPrompt: string | null,
  _document: HTMLElement
): EbsrPart {
  const responseIdentifier = choiceInteraction.getAttribute('responseIdentifier') || 'RESPONSE';

  // Extract prompt from interaction
  let prompt = '';
  if (sharedPrompt) {
    prompt = sharedPrompt;
  }

  const promptElement = choiceInteraction.getElementsByTagName('prompt')[0];
  if (promptElement) {
    prompt += (prompt ? '\n' : '') + promptElement.innerHTML.trim();
  }

  // Determine choice mode (radio vs checkbox)
  const maxChoices = parseInt(choiceInteraction.getAttribute('maxChoices') || '1', 10);
  const choiceMode: 'radio' | 'checkbox' = maxChoices === 1 ? 'radio' : 'checkbox';

  // Determine shuffle/lockChoiceOrder
  const shuffle = choiceInteraction.getAttribute('shuffle');
  const lockChoiceOrder = shuffle === 'false';

  // Extract choices
  const correctAnswers = correctAnswerMap.get(responseIdentifier) || [];
  const choices = extractChoices(choiceInteraction, correctAnswers);

  // Check for feedback
  const feedbackEnabled = choices.some(c => c.feedback);

  return {
    prompt: prompt || undefined,
    choices,
    choiceMode,
    lockChoiceOrder,
    choicePrefix: 'none',
    feedbackEnabled,
  };
}

/**
 * Extract correct answer map from responseDeclarations
 */
function extractCorrectAnswerMap(document: HTMLElement): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  for (const responseDeclaration of Array.from(responseDeclarations)) {
    const identifier = responseDeclaration.getAttribute('identifier');
    if (!identifier) continue;

    const correctAnswers: string[] = [];

    // Try correctResponse/value elements first
    const correctResponseElement = responseDeclaration.getElementsByTagName('correctResponse')[0];
    if (correctResponseElement) {
      const values = correctResponseElement.getElementsByTagName('value');
      for (const value of Array.from(values)) {
        const text = value.textContent?.trim();
        if (text) correctAnswers.push(text);
      }
    }

    // If no correct responses, try mapEntry elements
    if (correctAnswers.length === 0) {
      const mapEntries = responseDeclaration.getElementsByTagName('mapEntry');
      for (const mapEntry of Array.from(mapEntries)) {
        const mappedValue = parseFloat(mapEntry.getAttribute('mappedValue') || '0');
        if (mappedValue > 0) {
          const mapKey = mapEntry.getAttribute('mapKey');
          if (mapKey) correctAnswers.push(mapKey);
        }
      }
    }

    map.set(identifier, correctAnswers);
  }

  return map;
}

/**
 * Extract choices from choiceInteraction
 */
function extractChoices(
  choiceInteraction: HTMLElement,
  correctAnswers: string[]
): Choice[] {
  const choices: Choice[] = [];
  const simpleChoices = choiceInteraction.getElementsByTagName('simpleChoice');

  for (let i = 0; i < simpleChoices.length; i++) {
    const simpleChoice = simpleChoices[i];
    const identifier = simpleChoice.getAttribute('identifier') || `choice-${i}`;
    const label = simpleChoice.innerHTML.trim()
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // Check for feedback (feedbackInline)
    const feedbackInline = simpleChoice.getElementsByTagName('feedbackInline')[0];
    const feedback = feedbackInline?.innerHTML.trim();

    choices.push({
      label,
      value: identifier,
      correct: correctAnswers.includes(identifier),
      feedback: feedback || undefined,
    });
  }

  return choices;
}
