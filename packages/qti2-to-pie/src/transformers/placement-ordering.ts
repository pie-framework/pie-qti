/**
 * QTI 2.1/2.2 orderInteraction to PIE placement-ordering transformer
 *
 * Transforms QTI orderInteraction elements into PIE placement-ordering items.
 * Handles ordering/sequencing tasks where students arrange items in correct order.
 */

import type { PieItem } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createMissingInteractionError } from '../utils/qti-errors.js';

export interface PlacementOrderingOptions {
  /** Default orientation if not specified in QTI */
  defaultOrientation?: 'horizontal' | 'vertical';
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Choice {
  id: string;
  label: string;
}

/**
 * Transform QTI orderInteraction to PIE placement-ordering
 */
export function transformPlacementOrdering(
  qtiXml: string,
  itemId: string,
  options?: PlacementOrderingOptions
): PieItem {
  const document = parse(qtiXml);
  const orderInteraction = document.getElementsByTagName('orderInteraction')[0];

  if (!orderInteraction) {
    throw createMissingInteractionError('orderInteraction', {
      itemId,
      details: 'For ordering/sequencing questions, use <orderInteraction> with <simpleChoice> elements defining the items to order.',
    });
  }

  const responseIdentifier = orderInteraction.getAttribute('responseIdentifier') || 'RESPONSE';
  const shuffle = orderInteraction.getAttribute('shuffle');
  const orientation = orderInteraction.getAttribute('orientation');

  // Extract prompt
  const prompt = extractPrompt(document);

  // Extract choices
  const choices = extractChoices(orderInteraction);

  // Extract correct response
  const correctResponse = extractCorrectResponse(document, choices, responseIdentifier);

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
          element: '@pie-element/placement-ordering',
          prompt: prompt || '',
          lockChoiceOrder: shuffle === 'false', // shuffle=false means locked order
          orientation: (orientation as 'horizontal' | 'vertical') || options?.defaultOrientation || 'vertical',
          partialScoring: options?.partialScoring ?? false,
          choiceLabel: '',
          choices: choices.map((c, index) => ({
            id: String(index),
            label: c.label,
          })),
          correctResponse: correctResponse.map((id) => ({
            id: String(id),
          })),
        },
      ],
      elements: {
        'placement-ordering': '@pie-element/placement-ordering@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'PO',
        source: 'qti22',
      },
    },
  };

  return pieItem;
}

/**
 * Extract prompt from QTI itemBody
 */
function extractPrompt(document: HTMLElement): string | null {
  const itemBody = document.getElementsByTagName('itemBody')[0];
  if (!itemBody) return null;

  const promptElement = itemBody.getElementsByTagName('prompt')[0];
  if (promptElement) {
    return promptElement.innerHTML.trim();
  }

  // If no prompt element, look for content before orderInteraction
  let promptHtml = '';
  const orderInteraction = itemBody.getElementsByTagName('orderInteraction')[0];

  for (const child of itemBody.childNodes) {
    if (child === orderInteraction) break;

    if (child.nodeType === 3) { // Text node
      const text = child.textContent?.trim();
      if (text) promptHtml += text;
    } else if ((child as HTMLElement).tagName) {
      promptHtml += (child as HTMLElement).outerHTML;
    }
  }

  return promptHtml.trim() || null;
}

/**
 * Extract choices from orderInteraction
 */
function extractChoices(orderInteraction: HTMLElement): Choice[] {
  const simpleChoices = orderInteraction.getElementsByTagName('simpleChoice');

  return Array.from(simpleChoices).map((choice, index) => ({
    id: choice.getAttribute('identifier') || `choice-${index}`,
    label: choice.innerHTML.trim(),
  }));
}

/**
 * Extract correct response from responseDeclaration
 */
function extractCorrectResponse(
  document: HTMLElement,
  choices: Choice[],
  responseIdentifier: string
): number[] {
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  let responseDeclaration: HTMLElement | null = null;
  for (const rd of Array.from(responseDeclarations)) {
    if (rd.getAttribute('identifier') === responseIdentifier) {
      responseDeclaration = rd;
      break;
    }
  }

  if (!responseDeclaration) {
    return [];
  }

  const correctResponse = responseDeclaration.getElementsByTagName('correctResponse')[0];
  if (!correctResponse) {
    return [];
  }

  const values = correctResponse.getElementsByTagName('value');
  const choiceMap = new Map(choices.map((c, i) => [c.id, i]));

  return Array.from(values)
    .map(v => {
      const identifier = v.textContent?.trim() || '';
      return choiceMap.get(identifier);
    })
    .filter((id): id is number => id !== undefined);
}
