/**
 * QTI 2.1/2.2 inlineChoiceInteraction to PIE inline-dropdown transformer
 *
 * Transforms QTI inlineChoiceInteraction elements into PIE inline-dropdown items.
 * Handles fill-in-the-blank tasks with dropdown menus for selection.
 */

import type { PieItem } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

export interface InlineDropdownOptions {
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Whether to lock choice order (disable shuffle) */
  lockChoiceOrder?: boolean;
  /** Rationale/feedback text */
  rationale?: string;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
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
      details: 'The <itemBody> element is required to contain the question content and interactions.',
    });
  }

  const inlineChoiceInteractions = itemBody.getElementsByTagName('inlineChoiceInteraction');

  if (inlineChoiceInteractions.length === 0) {
    throw createMissingInteractionError('inlineChoiceInteraction', {
      itemId,
      details: 'For inline dropdown questions, use <inlineChoiceInteraction> elements with <inlineChoice> options.',
    });
  }

  // Extract prompt (audio or other content before interactions)
  const prompt = extractPrompt(itemBody);

  // Extract correct answers from responseDeclarations
  const correctAnswers = extractCorrectAnswers(document);

  // Determine lockChoiceOrder from first interaction's shuffle attribute
  const firstInteraction = inlineChoiceInteractions[0];
  const shuffle = firstInteraction.getAttribute('shuffle');
  const lockChoiceOrder = options?.lockChoiceOrder ?? (shuffle === 'false');

  // Build markup by replacing inlineChoiceInteractions with {{index}} placeholders
  const markup = buildMarkup(itemBody, inlineChoiceInteractions);

  // Extract choices for each inline choice interaction
  const choices = extractChoices(inlineChoiceInteractions, correctAnswers);

  // Extract rationale from feedbackInline if present
  const rationale = options?.rationale || extractRationale(itemBody);

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
          element: '@pie-element/inline-dropdown',
          prompt: prompt || '',
          rationale,
          lockChoiceOrder,
          partialScoring: options?.partialScoring ?? false,
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
function extractCorrectAnswers(document: HTMLElement): Set<string> {
  const correctAnswers = new Set<string>();
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  for (const responseDeclaration of Array.from(responseDeclarations)) {
    const correctResponse = responseDeclaration.getElementsByTagName('correctResponse')[0];
    if (!correctResponse) continue;

    const values = correctResponse.getElementsByTagName('value');
    for (const value of Array.from(values)) {
      const text = value.textContent?.trim();
      if (text) {
        correctAnswers.add(text);
      }
    }
  }

  return correctAnswers;
}

/**
 * Build markup by replacing inlineChoiceInteractions with {{index}} placeholders
 */
function buildMarkup(
  itemBody: HTMLElement,
  _interactions: HTMLElement[]
): string {
  let itemBodyHtml = itemBody.innerHTML;

  // Remove audio/prompt if present (it goes in the prompt field)
  if (itemBodyHtml.includes('<audio')) {
    const audioStart = itemBodyHtml.indexOf('<audio');
    let audioEnd = itemBodyHtml.indexOf('</audio>', audioStart) + 8;

    // Include link if present
    if (itemBodyHtml.substring(audioEnd, audioEnd + 2) === '<a') {
      audioEnd = itemBodyHtml.indexOf('</a>', audioEnd) + 4;
    }

    // Remove surrounding <p> tags if present
    if (
      itemBodyHtml.substring(audioStart - 3, audioStart) === '<p>' &&
      itemBodyHtml.substring(audioEnd, audioEnd + 4) === '</p>'
    ) {
      itemBodyHtml = itemBodyHtml.substring(0, audioStart - 3) + itemBodyHtml.substring(audioEnd + 4);
    } else {
      itemBodyHtml = itemBodyHtml.substring(0, audioStart) + itemBodyHtml.substring(audioEnd);
    }
  }

  // Remove feedbackInline elements
  itemBodyHtml = removeFeedbackInline(itemBodyHtml);

  // Replace each inlineChoiceInteraction with {{index}} placeholder
  let markup = itemBodyHtml;
  let interactionNumber = 0;
  let start = markup.indexOf('<inlineChoiceInteraction');

  while (start !== -1) {
    const end = markup.indexOf('</inlineChoiceInteraction>', start);
    if (end === -1) break;

    const fullInteraction = markup.substring(start, end + '</inlineChoiceInteraction>'.length);
    markup = markup.replace(fullInteraction, `{{${interactionNumber++}}}`);
    start = markup.indexOf('<inlineChoiceInteraction');
  }

  return markup.trim();
}

/**
 * Extract choices for each inlineChoiceInteraction
 */
function extractChoices(
  interactions: HTMLElement[],
  correctAnswers: Set<string>
): { [id: string]: Choice[] } {
  const choices: { [id: string]: Choice[] } = {};

  for (let i = 0; i < interactions.length; i++) {
    choices[String(i)] = [];

    const inlineChoices = interactions[i].getElementsByTagName('inlineChoice');
    for (const inlineChoice of Array.from(inlineChoices)) {
      const identifier = inlineChoice.getAttribute('identifier') || '';
      const label = inlineChoice.innerHTML.trim();

      choices[String(i)].push({
        value: identifier,
        label,
        correct: correctAnswers.has(identifier),
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

/**
 * Remove feedbackInline elements from markup
 */
function removeFeedbackInline(html: string): string {
  let feedbackStart = html.indexOf('<feedbackInline');
  while (feedbackStart !== -1) {
    const feedbackEnd = html.indexOf('</feedbackInline>', feedbackStart);
    if (feedbackEnd === -1) break;

    const fullFeedback = html.substring(feedbackStart, feedbackEnd + '</feedbackInline>'.length);
    html = html.replace(fullFeedback, '');
    feedbackStart = html.indexOf('<feedbackInline');
  }

  return html;
}
