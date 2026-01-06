/**
 * Categorize Generator
 *
 * Generates QTI associateInteraction from PIE categorize models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface Category {
  id: string;
  label: string;
  choices: string[];
}

interface Choice {
  id: string;
  content: string;
}

/**
 * Generator for @pie-element/categorize
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/categorize',
 *   prompt: 'Categorize the following items.',
 *   categories: [
 *     { id: 'cat1', label: 'Category 1', choices: ['choice1', 'choice2'] },
 *     { id: 'cat2', label: 'Category 2', choices: ['choice3'] }
 *   ],
 *   choices: [
 *     { id: 'choice1', content: 'Item 1' },
 *     { id: 'choice2', content: 'Item 2' },
 *     { id: 'choice3', content: 'Item 3' }
 *   ],
 *   lockChoiceOrder: false,
 *   partialScoring: false
 * }
 *
 * QTI Output: associateInteraction with simpleAssociableChoice elements
 *
 * Note: PIE categorize (grouping into predefined categories) maps to QTI associateInteraction
 * (free-form pairing). The semantic gap means some information is preserved via data-pie-* attributes.
 */
export class CategorizeGenerator extends BaseGenerator {
  readonly id = '@pie-element/categorize';
  readonly name = 'Categorize';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating associateInteraction for categorize');

    // Validate model
    if (!model.categories || model.categories.length === 0) {
      throw new Error('categorize requires categories array with at least one category');
    }

    if (!model.choices || model.choices.length === 0) {
      throw new Error('categorize requires choices array with at least one choice');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build correct response pairs (choice -> category assignments)
    const correctPairs: string[] = [];
    for (const category of model.categories) {
      if (category.choices && Array.isArray(category.choices)) {
        for (const choiceId of category.choices) {
          // Format: "choiceId categoryId" (directedPair)
          correctPairs.push(`${choiceId} ${category.id}`);
        }
      }
    }

    // Build response declaration (directed pairs: choice -> category)
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'multiple',
      baseType: 'directedPair',
      correctResponse: correctPairs,
    });

    // Build item body with associateInteraction
    const shuffle = model.lockChoiceOrder ? 'false' : 'true';
    const itemBody = this.buildItemBody(
      model.categories,
      model.choices,
      responseId,
      shuffle,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Categorize Item',
      pieElement: this.id,
    });

    const warnings = [
      'PIE categorize (grouping into categories) uses QTI associateInteraction (free-form pairing)',
      'Category structure is preserved in data-pie-categories for accurate reconstruction',
    ];

    if (model.partialScoring) {
      warnings.push('Partial scoring settings preserved in data-pie-partial-scoring');
    }

    this.debug(context, `Successfully generated associateInteraction with ${model.categories.length} categories`);

    return this.createResult(qti, warnings);
  }

  /**
   * Build item body with associateInteraction
   */
  private buildItemBody(
    categories: Category[],
    choices: Choice[],
    responseId: string,
    shuffle: string,
    prompt?: string
  ): string {
    // Build prompt if present
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Calculate max associations
    // Each choice can be associated with any number of categories
    const maxAssociations = categories.length * choices.length;

    // Build simpleAssociableChoice elements for all items (categories + choices)
    // Categories have matchMax = number of choices (can accept multiple items)
    const categoryChoices = categories
      .map(
        (cat) =>
          `      <simpleAssociableChoice identifier="${cat.id}" matchMax="${choices.length}">${cat.label}</simpleAssociableChoice>`
      )
      .join('\n');

    // Choices have matchMax = number of categories (can go into multiple categories if needed)
    const itemChoices = choices
      .map(
        (choice) =>
          `      <simpleAssociableChoice identifier="${choice.id}" matchMax="${categories.length}">${choice.content}</simpleAssociableChoice>`
      )
      .join('\n');

    // Build associateInteraction
    const interaction = `${promptHtml}<associateInteraction responseIdentifier="${responseId}" shuffle="${shuffle}" maxAssociations="${maxAssociations}">
${categoryChoices}
${itemChoices}
    </associateInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createCategorizeGenerator(): CategorizeGenerator {
  return new CategorizeGenerator();
}
