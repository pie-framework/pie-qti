/**
 * QTI associateInteraction to PIE categorize transformer
 *
 * EXPERIMENTAL: Maps QTI associateInteraction (free-form pairing from single pool)
 * to PIE categorize element (grouping items into categories).
 *
 * LIMITATIONS:
 * - associateInteraction allows any-to-any pairing (A-B, A-C, B-C, etc.)
 * - categorize expects predefined categories with items assigned to them
 * - This transformation infers categories from correct response pairs
 * - May not preserve full QTI semantics in all cases
 *
 * See docs/associate-interaction-challenges.md for full analysis and alternatives.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

export interface AssociateToCategorizeOptions {
  /** Whether to shuffle choices */
  lockChoiceOrder?: boolean;
  /** Whether to allow partial scoring */
  partialScoring?: boolean;
  /** Number of columns for categories */
  categoriesPerRow?: number;
  /** Position of choices relative to categories */
  choicesPosition?: 'above' | 'below' | 'left' | 'right';
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Pair {
  item1: string;
  item2: string;
}

interface Choice {
  id: string;
  label: string;
  content: string;
}

/**
 * Transform QTI associateInteraction to PIE categorize
 *
 * Strategy: Infer categories from correct response pairs.
 * - Each unique "right-hand" item in pairs becomes a category
 * - Left-hand items become choices to categorize
 * - If symmetric pairs (A-B and B-A), create bidirectional categories
 */
export function transformAssociateToCategorize(
  qtiXml: string,
  itemId: string,
  options?: AssociateToCategorizeOptions
): PieItem {
  const document = parse(qtiXml);
  const itemBody = document.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  const interaction = itemBody.getElementsByTagName('associateInteraction')[0];

  if (!interaction) {
    throw createMissingInteractionError('associateInteraction', {
      itemId,
      details: 'For association questions, use <associateInteraction> with <simpleAssociableChoice> elements. Note: This transformer converts associateInteraction (any-to-any pairing) to categorize format (grouping into categories).',
    });
  }

  // Extract prompt
  const prompt = extractPrompt(interaction);

  // Get response identifier
  const responseIdentifier = interaction.getAttribute('responseIdentifier') || 'RESPONSE';

  // Extract correct pairs
  const correctPairs = extractCorrectPairs(document, responseIdentifier);

  // Extract all choices from simpleAssociableChoice elements
  const allChoices = extractChoices(interaction);

  // Infer categories from correct pairs
  const { categories, choiceAssignments } = inferCategories(correctPairs, allChoices);

  // Build categorize model
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
          element: '@pie-element/categorize',
          prompt: prompt || '',
          promptEnabled: true,
          lockChoiceOrder: options?.lockChoiceOrder ?? false,
          partialScoring: options?.partialScoring ?? false,
          categoriesPerRow: options?.categoriesPerRow ?? 2,
          choicesPosition: options?.choicesPosition || 'above',
          choicesLabel: 'Choices',
          categories: categories.map(cat => ({
            id: cat.id,
            label: cat.label,
            choices: cat.correctChoiceIds,
          })),
          choices: allChoices.map(choice => ({
            id: choice.id,
            content: choice.content,
          })),
          correctResponse: choiceAssignments,
        },
      ],
      elements: {
        categorize: '@pie-element/categorize@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'CAT',
        source: 'qti22',
      },
      transformationNotes: [
        'Transformed from associateInteraction (any-to-any pairing) to categorize (grouping)',
        'Categories were inferred from correct response pairs',
        'Original QTI semantics may not be fully preserved',
      ],
    },
  };

  return pieItem;
}

/**
 * Extract prompt from interaction
 */
function extractPrompt(interaction: HTMLElement): string | null {
  const promptElement = interaction.getElementsByTagName('prompt')[0];
  if (promptElement) {
    return promptElement.innerHTML.trim();
  }
  return null;
}

/**
 * Extract correct pairs from responseDeclaration
 * QTI format: "A P" means A associates with P
 */
function extractCorrectPairs(document: HTMLElement, responseIdentifier: string): Pair[] {
  const pairs: Pair[] = [];
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  for (const rd of Array.from(responseDeclarations)) {
    if (rd.getAttribute('identifier') === responseIdentifier) {
      const values = rd.getElementsByTagName('value');

      for (const value of Array.from(values)) {
        const text = value.textContent?.trim();
        if (!text) continue;

        const parts = text.split(/\s+/);
        if (parts.length >= 2) {
          pairs.push({
            item1: parts[0],
            item2: parts[1],
          });
        }
      }
    }
  }

  return pairs;
}

/**
 * Extract all choices from simpleAssociableChoice elements
 */
function extractChoices(interaction: HTMLElement): Choice[] {
  const choices: Choice[] = [];
  const choiceElements = interaction.getElementsByTagName('simpleAssociableChoice');

  for (const choiceEl of Array.from(choiceElements)) {
    const identifier = choiceEl.getAttribute('identifier');
    if (!identifier) continue;

    const content = choiceEl.innerHTML.trim() || choiceEl.textContent?.trim() || identifier;

    choices.push({
      id: identifier,
      label: content,
      content,
    });
  }

  return choices;
}

/**
 * Infer categories from correct pairs
 *
 * Strategy:
 * - Count how many times each item appears as "right-hand" in pairs
 * - Items that appear most often as targets become categories
 * - Other items become choices to be categorized
 */
function inferCategories(
  correctPairs: Pair[],
  allChoices: Choice[]
): {
  categories: Array<{ id: string; label: string; correctChoiceIds: string[] }>;
  choiceAssignments: Record<string, string[]>;
} {
  // Count appearances in left vs right positions
  const leftCounts = new Map<string, number>();
  const rightCounts = new Map<string, number>();
  const pairMap = new Map<string, string[]>(); // rightItem -> [leftItems]

  for (const pair of correctPairs) {
    leftCounts.set(pair.item1, (leftCounts.get(pair.item1) || 0) + 1);
    rightCounts.set(pair.item2, (rightCounts.get(pair.item2) || 0) + 1);

    if (!pairMap.has(pair.item2)) {
      pairMap.set(pair.item2, []);
    }
    pairMap.get(pair.item2)!.push(pair.item1);
  }

  // Items that appear more often on the right become categories
  const categoryIds = Array.from(rightCounts.keys());

  // Build categories
  const categories = categoryIds.map(catId => {
    const choice = allChoices.find(c => c.id === catId);
    return {
      id: catId,
      label: choice?.label || catId,
      correctChoiceIds: pairMap.get(catId) || [],
    };
  });

  // Build choice assignments (for correct response)
  const choiceAssignments: Record<string, string[]> = {};
  for (const [catId, choiceIds] of pairMap.entries()) {
    for (const choiceId of choiceIds) {
      if (!choiceAssignments[choiceId]) {
        choiceAssignments[choiceId] = [];
      }
      choiceAssignments[choiceId].push(catId);
    }
  }

  return { categories, choiceAssignments };
}
