/**
 * QTI 2.1/2.2 orderInteraction to PIE placement-ordering transformer
 *
 * Transforms QTI orderInteraction elements into PIE placement-ordering items.
 * Handles ordering/sequencing tasks where students arrange items in correct order.
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

export interface PlacementOrderingOptions {
  /** Default orientation if not specified in QTI */
  defaultOrientation?: 'horizontal' | 'vertical';
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
  promptBoundaryStart?: HTMLElement;
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
  const itemBody = document.getElementsByTagName('itemBody')[0];
  const orderInteraction = document.getElementsByTagName('orderInteraction')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details:
        'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  if (!orderInteraction) {
    throw createMissingInteractionError('orderInteraction', {
      itemId,
      details:
        'For ordering/sequencing questions, use <orderInteraction> with <simpleChoice> elements defining the items to order.',
    });
  }

  return transformPlacementOrderingInteraction(
    document,
    itemBody,
    orderInteraction,
    itemId,
    options
  );
}

export function transformPlacementOrderingInteraction(
  document: HTMLElement,
  itemBody: HTMLElement,
  orderInteraction: HTMLElement,
  itemId: string,
  options?: PlacementOrderingOptions
): PieItem {
  const responseIdentifier = orderInteraction.getAttribute('responseIdentifier') || 'RESPONSE';
  const shuffle = orderInteraction.getAttribute('shuffle');
  const orientation = orderInteraction.getAttribute('orientation');

  // Extract prompt
  const prompt = itemBody
    ? extractPromptForInteraction(itemBody, orderInteraction, {
        after: options?.promptBoundaryStart,
      })
    : '';

  // Extract choices
  const choices = extractChoices(orderInteraction);

  // Extract correct response
  const correctResponse = extractCorrectResponse(document, choices, responseIdentifier);

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
          element: '@pie-element/placement-ordering',
          prompt: prompt || '',
          lockChoiceOrder: shuffle === 'false', // shuffle=false means locked order
          orientation:
            (orientation as 'horizontal' | 'vertical') || options?.defaultOrientation || 'vertical',
          partialScoring: options?.partialScoring ?? scoring.partialScoring,
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
        ...(scoring.weight !== undefined && { maxScore: scoring.weight }),
      },
    },
  };

  return pieItem;
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
  const responseDeclaration = findResponseDeclaration(document, responseIdentifier);

  if (!responseDeclaration) {
    return [];
  }

  const declared = readCorrectResponseValues(responseDeclaration);

  // An item scored via map_response need not declare a correctResponse at all.
  // Fall back to the mapping only when the declared key produced nothing, and
  // only for strictly positive mappedValues — a zero-scoring mapEntry is a
  // distractor, not an answer. For an ordered response the
  // mapEntry document order is the intended sequence.
  const identifiers =
    declared.length > 0 ? declared : (readMapping(responseDeclaration)?.positiveKeys ?? []);

  const choiceMap = new Map(choices.map((c, i) => [c.id, i]));

  return identifiers
    .map((identifier) => choiceMap.get(identifier))
    .filter((id): id is number => id !== undefined);
}
