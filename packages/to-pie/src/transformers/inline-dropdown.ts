/**
 * QTI 2.1/2.2 inlineChoiceInteraction to PIE inline-dropdown transformer
 *
 * Transforms QTI inlineChoiceInteraction elements into PIE inline-dropdown items.
 * Handles fill-in-the-blank tasks with dropdown menus for selection.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { resolveNodeWindow, serializeNodesWithReplacements } from '../utils/markup-extraction.js';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';
import { isQtiInteractionElement } from '../utils/qti-item-planner.js';
import {
  deriveItemScoring,
  readCorrectResponseValues,
  readMapping,
} from '../utils/response-scoring.js';

export interface InlineDropdownOptions {
  /** Overrides the partial scoring derived from the QTI source. */
  partialScoring?: boolean;
  /** Whether to lock choice order (disable shuffle) */
  lockChoiceOrder?: boolean;
  /** Rationale/feedback text */
  rationale?: string;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
  /**
   * When this interaction group is one unit inside a composite item, bounds
   * markup extraction to the local span after this neighboring interaction
   * (exclusive) instead of the whole item body.
   */
  boundaryStart?: HTMLElement;
  /** Same as `boundaryStart`, bounding the end of the local span (exclusive). */
  boundaryEnd?: HTMLElement;
}

interface Choice {
  value: string;
  label: string;
  correct: boolean;
}

/**
 * Transform QTI inlineChoiceInteraction to PIE inline-dropdown
 */
export function transformInlineDropdown(
  qtiXml: string,
  itemId: string,
  options?: InlineDropdownOptions
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

  const inlineChoiceInteractions = itemBody.getElementsByTagName('inlineChoiceInteraction');

  if (inlineChoiceInteractions.length === 0) {
    throw createMissingInteractionError('inlineChoiceInteraction', {
      itemId,
      details:
        'For inline dropdown questions, use <inlineChoiceInteraction> elements with <inlineChoice> options.',
    });
  }

  return transformInlineDropdownInteractions(
    document,
    itemBody,
    Array.from(inlineChoiceInteractions),
    itemId,
    options
  );
}

export function transformInlineDropdownInteractions(
  document: HTMLElement,
  itemBody: HTMLElement,
  inlineChoiceInteractions: HTMLElement[],
  itemId: string,
  options?: InlineDropdownOptions
): PieItem {
  // Extract prompt (audio or other content before interactions)
  const prompt = extractPrompt(itemBody);

  // Extract correct answers from responseDeclarations
  const correctAnswers = extractCorrectAnswers(document, inlineChoiceInteractions);

  // Determine lockChoiceOrder from first interaction's shuffle attribute
  const firstInteraction = inlineChoiceInteractions[0];
  const shuffle = firstInteraction?.getAttribute('shuffle');
  const lockChoiceOrder = options?.lockChoiceOrder ?? shuffle === 'false';

  // Build markup by replacing inlineChoiceInteractions with {{index}} placeholders
  const markup = buildMarkup(itemBody, inlineChoiceInteractions, {
    boundaryStart: options?.boundaryStart,
    boundaryEnd: options?.boundaryEnd,
  });

  // Extract choices for each inline choice interaction
  const choices = extractChoices(inlineChoiceInteractions, correctAnswers);

  // Extract rationale from feedbackInline if present
  const rationale = options?.rationale || extractRationale(itemBody);

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
          element: '@pie-element/inline-dropdown',
          prompt: prompt || '',
          rationale,
          lockChoiceOrder,
          partialScoring: options?.partialScoring ?? scoring.partialScoring,
          scoringType: 'auto',
          markup,
          choices,
        },
      ],
      elements: {
        'inline-dropdown': '@pie-element/inline-dropdown@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'ID',
        source: 'qti22',
        ...(scoring.weight !== undefined && { maxScore: scoring.weight }),
      },
    },
  };

  return pieItem;
}

/**
 * Extract prompt from itemBody (typically audio elements or introductory content)
 */
function extractPrompt(itemBody: HTMLElement): string | null {
  const itemBodyHtml = itemBody.innerHTML;

  // Check for audio tag (common in ID items)
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
 * Extract correct answers from all responseDeclarations
 */
function extractCorrectAnswers(
  document: HTMLElement,
  interactions: HTMLElement[]
): Map<string, Set<string>> {
  const correctAnswers = new Map<string, Set<string>>();
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');
  const ownedResponseIdentifiers = new Set(
    interactions
      .map((interaction) => interaction.getAttribute('responseIdentifier'))
      .filter((identifier): identifier is string => Boolean(identifier))
  );

  for (const responseDeclaration of Array.from(responseDeclarations)) {
    const responseIdentifier = responseDeclaration.getAttribute('identifier');
    if (!responseIdentifier || !ownedResponseIdentifiers.has(responseIdentifier)) {
      continue;
    }
    const declared = readCorrectResponseValues(responseDeclaration);

    // An item scored via map_response need not declare a correctResponse at
    // all. Fall back to this declaration's mapping only when its declared key
    // produced nothing, and only for strictly positive mappedValues — a
    // zero-scoring mapEntry is a distractor, not an answer.
    const keys =
      declared.length > 0 ? declared : (readMapping(responseDeclaration)?.positiveKeys ?? []);

    if (keys.length === 0) continue;

    correctAnswers.set(responseIdentifier, new Set(keys));
  }

  return correctAnswers;
}

/**
 * Build markup by replacing inlineChoiceInteractions with {{index}} placeholders
 */
function buildMarkup(
  itemBody: HTMLElement,
  interactions: HTMLElement[],
  window?: { boundaryStart?: HTMLElement; boundaryEnd?: HTMLElement }
): string {
  const replacements = new Map(
    interactions.map((interaction, index) => [interaction, `{{${index}}}`] as const)
  );
  const nodes = resolveNodeWindow(itemBody, window?.boundaryStart, window?.boundaryEnd);
  return serializeNodesWithReplacements(nodes, {
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
 * Extract choices for each inlineChoiceInteraction
 */
function extractChoices(
  interactions: HTMLElement[],
  correctAnswers: Map<string, Set<string>>
): { [id: string]: Choice[] } {
  const choices: { [id: string]: Choice[] } = {};

  for (let i = 0; i < interactions.length; i++) {
    const interaction = interactions[i];
    if (!interaction) continue;

    const choiceList: Choice[] = [];
    choices[String(i)] = choiceList;
    const responseIdentifier = interaction.getAttribute('responseIdentifier') ?? '';
    const correctValues = correctAnswers.get(responseIdentifier) ?? new Set<string>();

    const inlineChoices = interaction.getElementsByTagName('inlineChoice');
    for (const inlineChoice of Array.from(inlineChoices)) {
      const identifier = inlineChoice.getAttribute('identifier') || '';
      const label = inlineChoice.innerHTML.trim();

      choiceList.push({
        value: identifier,
        label,
        correct: correctValues.has(identifier),
      });
    }
  }

  return choices;
}

/**
 * Extract rationale from feedbackInline elements
 */
function extractRationale(itemBody: HTMLElement): string | undefined {
  const feedbackInlines = itemBody.getElementsByTagName('feedbackInline');
  if (feedbackInlines.length === 0) return undefined;

  let rationale = '';
  for (const feedback of Array.from(feedbackInlines)) {
    rationale += feedback.innerHTML.trim();
  }

  return rationale || undefined;
}
