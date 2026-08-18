/**
 * QTI 2.1/2.2 textEntryInteraction to PIE explicit-constructed-response transformer
 *
 * Transforms QTI textEntryInteraction elements into PIE explicit-constructed-response items.
 * Handles fill-in-the-blank tasks with multiple text entry fields and correct answers.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { serializeChildrenWithReplacements } from '../utils/markup-extraction.js';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';
import { isQtiInteractionElement } from '../utils/qti-item-planner.js';
import {
  deriveItemScoring,
  readCorrectResponseValues,
  readMapping,
} from '../utils/response-scoring.js';

export interface ExplicitConstructedResponseOptions {
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Custom note text for the element */
  note?: string;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Choice {
  label: string;
  value: string;
}

/**
 * Transform QTI textEntryInteraction to PIE explicit-constructed-response
 */
export function transformExplicitConstructedResponse(
  qtiXml: string,
  itemId: string,
  options?: ExplicitConstructedResponseOptions
): PieItem {
  const document = parse(qtiXml);
  const itemBody = document.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details:
        'The <itemBody> element is required to contain the question content and interactions.',
    });
  }

  const textEntryInteractions = itemBody.getElementsByTagName('textEntryInteraction');

  if (textEntryInteractions.length === 0) {
    throw createMissingInteractionError('textEntryInteraction', {
      itemId,
      details:
        'For fill-in-the-blank questions, use <textEntryInteraction> elements with expectedLength attribute.',
    });
  }

  return transformExplicitConstructedResponseInteractions(
    document,
    itemBody,
    Array.from(textEntryInteractions),
    itemId,
    options
  );
}

export function transformExplicitConstructedResponseInteractions(
  document: HTMLElement,
  itemBody: HTMLElement,
  textEntryInteractions: HTMLElement[],
  itemId: string,
  options?: ExplicitConstructedResponseOptions
): PieItem {
  // Build response ID map (maps QTI responseIdentifier to sequential index)
  const responseIdMap = buildResponseIdMap(textEntryInteractions);

  // Extract prompt (audio or other content before interactions)
  const prompt = extractPrompt(itemBody);

  // Build markup by replacing textEntryInteractions with {{index}} placeholders
  const markup = buildMarkup(itemBody, textEntryInteractions, responseIdMap);

  // Extract choices (correct answers) for each text entry
  const choices = extractChoices(document, responseIdMap);

  // Extract max lengths for each text entry (if specified)
  const maxLengthPerChoice = extractMaxLengths(textEntryInteractions);

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
          element: '@pie-element/explicit-constructed-response',
          prompt: prompt || '',
          note:
            options?.note ||
            'The answer shown above is the most common correct answer for this item. One or more additional correct answers are also defined, and will also be recognized as correct.',
          markup,
          partialScoring: options?.partialScoring ?? scoring.partialScoring,
          choices,
          maxLengthPerChoice,
        },
      ],
      elements: {
        'explicit-constructed-response': '@pie-element/explicit-constructed-response@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'ECR',
        source: 'qti22',
        ...(scoring.weight !== undefined && { maxScore: scoring.weight }),
      },
    },
  };

  return pieItem;
}

/**
 * Build response ID map from textEntryInteractions
 * Maps QTI responseIdentifier to sequential index (0, 1, 2, ...)
 */
function buildResponseIdMap(interactions: HTMLElement[]): Map<string, string> {
  const map = new Map<string, string>();

  for (let i = 0; i < interactions.length; i++) {
    const responseIdentifier = interactions[i]?.getAttribute('responseIdentifier');
    if (responseIdentifier) {
      map.set(responseIdentifier, String(i));
    }
  }

  return map;
}

/**
 * Extract prompt from itemBody (typically audio elements or introductory content)
 */
function extractPrompt(itemBody: HTMLElement): string | null {
  const itemBodyHtml = itemBody.innerHTML;

  // Check for audio tag (common in ECR items)
  if (itemBodyHtml.includes('<audio')) {
    const audioStart = itemBodyHtml.indexOf('<audio');
    let audioEnd = itemBodyHtml.indexOf('</audio>', audioStart) + 8;

    // If there is a link after the audio tag, include the link
    if (itemBodyHtml.substring(audioEnd, audioEnd + 2) === '<a') {
      audioEnd = itemBodyHtml.indexOf('</a>', audioEnd) + 4;
    }

    // Check for surrounding <p> tags
    if (
      itemBodyHtml.substring(audioStart - 3, audioStart) === '<p>' &&
      itemBodyHtml.substring(audioEnd, audioEnd + 4) === '</p>'
    ) {
      return itemBodyHtml.substring(audioStart - 3, audioEnd + 4);
    } else {
      return itemBodyHtml.substring(audioStart, audioEnd);
    }
  }

  // Look for explicit prompt element
  const promptElement = itemBody.getElementsByTagName('prompt')[0];
  if (promptElement) {
    return promptElement.innerHTML.trim();
  }

  return null;
}

/**
 * Build markup by replacing textEntryInteractions with {{index}} placeholders
 */
function buildMarkup(
  itemBody: HTMLElement,
  interactions: HTMLElement[],
  responseIdMap: Map<string, string>
): string {
  const replacements = new Map<HTMLElement, string>();
  for (const interaction of interactions) {
    const responseIdentifier = interaction.getAttribute('responseIdentifier');
    if (responseIdentifier) {
      const index = responseIdMap.get(responseIdentifier);
      if (index !== undefined) {
        replacements.set(interaction, `{{${index}}}`);
      }
    }
  }

  return serializeChildrenWithReplacements(itemBody, {
    replacements,
    omit: (element) => {
      const tagName = element.tagName.toLowerCase();
      return (
        tagName === 'prompt' ||
        tagName === 'audio' ||
        tagName === 'feedbackinline' ||
        isLinkImmediatelyAfterAudio(element) ||
        (isQtiInteractionElement(element) && !replacements.has(element))
      );
    },
  });
}

/**
 * `extractPrompt` folds a link into the prompt when it immediately follows an `<audio>` tag
 * with nothing in between; `buildMarkup` must drop that same link, or it appears in both the
 * prompt and the markup.
 */
function isLinkImmediatelyAfterAudio(element: HTMLElement): boolean {
  if (element.tagName?.toLowerCase() !== 'a') return false;
  const parent = element.parentNode as HTMLElement | undefined;
  if (!parent) return false;
  const index = parent.childNodes.indexOf(element);
  const previous = index > 0 ? (parent.childNodes[index - 1] as HTMLElement) : undefined;
  return previous?.tagName?.toLowerCase() === 'audio';
}

/**
 * Extract choices (correct answers) from responseDeclarations
 * Returns a map of index to array of correct answer choices
 */
function extractChoices(
  document: HTMLElement,
  responseIdMap: Map<string, string>
): { [id: string]: Choice[] } {
  const choices: { [id: string]: Choice[] } = {};
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  for (const responseDeclaration of Array.from(responseDeclarations)) {
    const identifier = responseDeclaration.getAttribute('identifier');
    if (!identifier) continue;

    const index = responseIdMap.get(identifier);
    if (index === undefined) continue;

    const declared = readCorrectResponseValues(responseDeclaration);

    // An item scored via map_response need not declare a correctResponse at
    // all. For text entry a positive-mappedValue mapKey *is* an accepted
    // answer, so the mapping supplies the same list. Zero-scoring entries are
    // recorded misspellings, not answers.
    const accepted =
      declared.length > 0 ? declared : (readMapping(responseDeclaration)?.positiveKeys ?? []);

    choices[index] = accepted.map((label, i) => ({
      label,
      value: String(i),
    }));
  }

  return choices;
}

/**
 * Extract max lengths for each text entry field from expectedLength attributes
 * Returns undefined if not all interactions have expectedLength
 */
function extractMaxLengths(interactions: HTMLElement[]): number[] | undefined {
  const maxLengths: number[] = [];

  for (const interaction of interactions) {
    if (!interaction.hasAttribute('expectedLength')) {
      return undefined;
    }

    const expectedLength = interaction.getAttribute('expectedLength');
    if (expectedLength) {
      maxLengths.push(parseInt(expectedLength, 10));
    }
  }

  return maxLengths.length > 0 ? maxLengths : undefined;
}
