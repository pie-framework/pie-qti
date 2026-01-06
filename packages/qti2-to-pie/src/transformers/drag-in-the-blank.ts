/**
 * QTI 2.1/2.2 gapMatchInteraction to PIE drag-in-the-blank transformer
 *
 * Transforms QTI gapMatchInteraction elements into PIE drag-in-the-blank items.
 * Handles drag-and-drop tasks where students drag choices into gaps in text.
 */

import type { PieItem } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

export interface DragInTheBlankOptions {
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Whether to lock choice order (disable shuffle) */
  lockChoiceOrder?: boolean;
  /** Whether to allow duplicates (using same choice multiple times) */
  duplicates?: boolean;
  /** Position of choices relative to content */
  choicesPosition?: 'above' | 'below' | 'left' | 'right';
  /** Rationale/feedback text */
  rationale?: string;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Choice {
  id: string;
  value: string;
}

/**
 * Transform QTI gapMatchInteraction to PIE drag-in-the-blank
 */
export function transformDragInTheBlank(
  qtiXml: string,
  itemId: string,
  options?: DragInTheBlankOptions
): PieItem {
  const document = parse(qtiXml);
  const itemBody = document.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  const gapMatchInteraction = itemBody.getElementsByTagName('gapMatchInteraction')[0];

  if (!gapMatchInteraction) {
    throw createMissingInteractionError('gapMatchInteraction', {
      itemId,
      details: 'For drag-in-the-blank questions, use <gapMatchInteraction> with <gapText> choices and <gap> placeholders.',
    });
  }

  const responseIdentifier = gapMatchInteraction.getAttribute('responseIdentifier') || 'RESPONSE';

  // Extract prompt
  const prompt = extractPrompt(document);

  // Determine shuffle/lockChoiceOrder
  const shuffle = gapMatchInteraction.getAttribute('shuffle');
  const lockChoiceOrder = options?.lockChoiceOrder ?? (shuffle === 'false');

  // Build response map (gap identifier to index) and markup
  const responseMap = new Map<string, string>();
  const markup = buildMarkup(gapMatchInteraction, responseMap);

  // Extract choices (gapText elements) and build choice map
  const choiceMap = new Map<string, string>();
  const choices = extractChoices(gapMatchInteraction, choiceMap);

  // Extract correct responses
  const correctResponse = extractCorrectResponse(document, responseIdentifier, responseMap, choiceMap);

  // Determine if duplicates are allowed
  const duplicates = options?.duplicates ?? checkDuplicates(gapMatchInteraction, document, responseIdentifier);

  // Extract rationale from modalFeedback
  const rationale = options?.rationale || extractRationale(document);

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
          element: '@pie-element/drag-in-the-blank',
          prompt: prompt || '',
          rationale,
          duplicates,
          lockChoiceOrder,
          partialScoring: options?.partialScoring ?? false,
          choicesPosition: options?.choicesPosition || 'below',
          markup,
          choices,
          correctResponse,
        },
      ],
      elements: {
        'drag-in-the-blank': '@pie-element/drag-in-the-blank@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'DITB',
        source: 'qti22',
      },
    },
  };

  return pieItem;
}

/**
 * Extract prompt from itemBody
 */
function extractPrompt(document: HTMLElement): string | null {
  const itemBody = document.getElementsByTagName('itemBody')[0];
  if (!itemBody) return null;

  // Look for prompt in gapMatchInteraction
  const gapMatchInteraction = itemBody.getElementsByTagName('gapMatchInteraction')[0];
  if (gapMatchInteraction) {
    const promptElement = gapMatchInteraction.getElementsByTagName('prompt')[0];
    if (promptElement) {
      return promptElement.innerHTML.trim();
    }
  }

  // Look for content before gapMatchInteraction
  let promptHtml = '';
  for (const child of itemBody.childNodes) {
    if (child === gapMatchInteraction) break;

    if (child.nodeType === 3) {
      // Text node
      const text = child.textContent?.trim();
      if (text) promptHtml += text;
    } else if ((child as HTMLElement).tagName) {
      promptHtml += (child as HTMLElement).outerHTML;
    }
  }

  return promptHtml.trim() || null;
}

/**
 * Build markup by replacing gap elements with {{index}} placeholders
 * and removing gapText and prompt elements
 */
function buildMarkup(
  gapMatchInteraction: HTMLElement,
  responseMap: Map<string, string>
): string {
  // Parse the interaction content
  const interactionHtml = parse(gapMatchInteraction.innerHTML);

  // Remove prompt elements
  const prompts = interactionHtml.getElementsByTagName('prompt');
  for (const prompt of Array.from(prompts)) {
    prompt.remove();
  }

  // Remove gapText elements (these become choices)
  const gapTexts = interactionHtml.getElementsByTagName('gapText');
  for (const gapText of Array.from(gapTexts)) {
    gapText.remove();
  }

  // Replace gap elements with {{index}} placeholders
  let markup = interactionHtml.innerHTML.trim();
  let count = 0;
  let start = markup.indexOf('<gap');

  while (start !== -1) {
    // Extract identifier
    const idStart = markup.indexOf('identifier', start) + 'identifier'.length;
    const idQuoteStart = markup.indexOf('"', idStart) + 1;
    const idQuoteEnd = markup.indexOf('"', idQuoteStart);
    const identifier = markup.substring(idQuoteStart, idQuoteEnd);

    responseMap.set(identifier, String(count));

    // Replace <gap.../> or <gap...></gap> with placeholder
    const end = markup.indexOf('</gap>', start);
    if (end !== -1) {
      const fullGap = markup.substring(start, end + '</gap>'.length);
      markup = markup.replace(fullGap, `{{${count++}}}`);
    } else {
      // Self-closing gap tag
      const selfCloseEnd = markup.indexOf('/>', start);
      if (selfCloseEnd !== -1) {
        const fullGap = markup.substring(start, selfCloseEnd + 2);
        markup = markup.replace(fullGap, `{{${count++}}}`);
      }
    }

    start = markup.indexOf('<gap', start + 1);
  }

  return markup;
}

/**
 * Extract choices from gapText elements
 */
function extractChoices(
  gapMatchInteraction: HTMLElement,
  choiceMap: Map<string, string>
): Choice[] {
  const choices: Choice[] = [];
  const gapTexts = gapMatchInteraction.getElementsByTagName('gapText');

  for (let i = 0; i < gapTexts.length; i++) {
    const gapText = gapTexts[i];
    const identifier = gapText.getAttribute('identifier') || `choice-${i}`;
    const value = gapText.innerHTML.trim()
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    choiceMap.set(identifier, String(i));
    choices.push({
      id: String(i),
      value,
    });
  }

  return choices;
}

/**
 * Extract correct response from responseDeclaration
 * Maps gap index to choice index
 */
function extractCorrectResponse(
  document: HTMLElement,
  responseIdentifier: string,
  responseMap: Map<string, string>,
  choiceMap: Map<string, string>
): { [id: string]: string } {
  const correctResponse: { [id: string]: string } = {};
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  let responseDeclaration: HTMLElement | null = null;
  for (const rd of Array.from(responseDeclarations)) {
    if (rd.getAttribute('identifier') === responseIdentifier) {
      responseDeclaration = rd;
      break;
    }
  }

  if (!responseDeclaration) {
    return correctResponse;
  }

  // Try to get from correctResponse/value elements first
  const correctResponseElement = responseDeclaration.getElementsByTagName('correctResponse')[0];
  if (correctResponseElement) {
    const values = correctResponseElement.getElementsByTagName('value');
    for (const value of Array.from(values)) {
      const text = value.textContent?.trim() || '';
      // Format: "choiceId gapId" (space-separated directed pair)
      const [choiceId, gapId] = text.split(/\s+/);
      if (choiceId && gapId) {
        const responseKey = responseMap.get(gapId);
        const choiceValue = choiceMap.get(choiceId);
        if (responseKey !== undefined && choiceValue !== undefined) {
          correctResponse[responseKey] = choiceValue;
        }
      }
    }
  }

  // If no correct responses found, try mapEntry elements
  if (Object.keys(correctResponse).length === 0) {
    const mapEntries = responseDeclaration.getElementsByTagName('mapEntry');
    for (const mapEntry of Array.from(mapEntries)) {
      // Skip negative scores (incorrect responses)
      const mappedValue = parseFloat(mapEntry.getAttribute('mappedValue') || '0');
      if (mappedValue < 0) continue;

      const mapKey = mapEntry.getAttribute('mapKey') || '';
      const [choiceId, gapId] = mapKey.split(/\s+/);
      if (choiceId && gapId) {
        const responseKey = responseMap.get(gapId);
        const choiceValue = choiceMap.get(choiceId);
        if (responseKey !== undefined && choiceValue !== undefined) {
          correctResponse[responseKey] = choiceValue;
        }
      }
    }
  }

  return correctResponse;
}

/**
 * Check if duplicates are allowed
 * Checks matchMax attributes and duplicate values in correctResponse
 */
function checkDuplicates(
  gapMatchInteraction: HTMLElement,
  document: HTMLElement,
  responseIdentifier: string
): boolean {
  // Check matchMax attributes on gapText elements
  const gapTexts = gapMatchInteraction.getElementsByTagName('gapText');
  for (const gapText of Array.from(gapTexts)) {
    const matchMax = gapText.getAttribute('matchMax');
    if (matchMax && matchMax !== '1') {
      return true; // matchMax 0 or > 1 means duplicates allowed
    }
  }

  // Check for duplicate choice IDs in correct responses
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');
  for (const rd of Array.from(responseDeclarations)) {
    if (rd.getAttribute('identifier') !== responseIdentifier) continue;

    const usedChoices = new Set<string>();
    const correctResponseElement = rd.getElementsByTagName('correctResponse')[0];
    if (!correctResponseElement) continue;

    const values = correctResponseElement.getElementsByTagName('value');
    for (const value of Array.from(values)) {
      const text = value.textContent?.trim() || '';
      const [choiceId] = text.split(/\s+/);
      if (usedChoices.has(choiceId)) {
        return true; // Found duplicate
      }
      usedChoices.add(choiceId);
    }
  }

  return false;
}

/**
 * Extract rationale from modalFeedback
 */
function extractRationale(document: HTMLElement): string | undefined {
  const modalFeedbacks = document.getElementsByTagName('modalFeedback');
  if (modalFeedbacks.length === 0) return undefined;

  return modalFeedbacks[0].innerHTML.trim() || undefined;
}
