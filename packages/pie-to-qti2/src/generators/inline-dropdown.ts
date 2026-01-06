/**
 * Inline Dropdown Generator
 *
 * Generates QTI inlineChoiceInteraction from PIE inline-dropdown models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/inline-dropdown
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/inline-dropdown',
 *   markup: 'Text with {{0}} and {{1}} placeholders',
 *   choices: {
 *     '0': [
 *       { value: 'a', label: 'Option A', correct: true },
 *       { value: 'b', label: 'Option B', correct: false }
 *     ],
 *     '1': [
 *       { value: 'c', label: 'Option C', correct: false },
 *       { value: 'd', label: 'Option D', correct: true }
 *     ]
 *   },
 *   lockChoiceOrder: false,
 *   partialScoring: false
 * }
 *
 * QTI Output: Multiple inlineChoiceInteraction elements inline with text
 */
export class InlineDropdownGenerator extends BaseGenerator {
  readonly id = '@pie-element/inline-dropdown';
  readonly name = 'Inline Dropdown';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating inlineChoiceInteraction elements');

    // Validate model
    if (!model.markup) {
      throw new Error('inline-dropdown requires markup field with {{n}} placeholders');
    }

    if (!model.choices || Object.keys(model.choices).length === 0) {
      throw new Error('inline-dropdown requires choices field');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);

    // Extract placeholders from markup
    const placeholders = this.extractPlaceholders(model.markup);

    if (placeholders.length === 0) {
      this.warn(context, 'No {{n}} placeholders found in markup');
    }

    // Validate all placeholders have choices
    for (const index of placeholders) {
      if (!model.choices[index]) {
        throw new Error(`Missing choices for placeholder {{${index}}}`);
      }
    }

    // Build response declarations (one per dropdown)
    const responseDecls: string[] = [];
    for (const index of placeholders) {
      const responseId = `RESPONSE_${index}`;
      const choices = model.choices[index] || [];
      const correctValues = choices
        .filter((choice: any) => choice.correct)
        .map((choice: any) => choice.value);

      responseDecls.push(
        buildResponseDeclaration({
          identifier: responseId,
          cardinality: 'single',
          baseType: 'identifier',
          correctResponse: correctValues,
        })
      );
    }

    // Build item body with inline dropdowns
    const shuffle = model.lockChoiceOrder ? 'false' : 'true';
    const itemBody = this.buildItemBody(model.markup, model.choices, shuffle);

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, responseDecls, itemBody, {
      title: model.title || 'Inline Dropdown Item',
      pieElement: this.id,
    });

    const warnings: string[] = [];

    if (model.partialScoring) {
      warnings.push(
        'Partial scoring is not standard QTI - preserved in data-pie-partial-scoring'
      );
    }

    this.debug(context, `Successfully generated ${placeholders.length} inlineChoiceInteraction elements`);

    return this.createResult(qti, warnings);
  }

  /**
   * Extract placeholder indices from markup (e.g., {{0}}, {{1}})
   */
  private extractPlaceholders(markup: string): string[] {
    const regex = /\{\{(\d+)\}\}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = regex.exec(markup)) !== null) {
      placeholders.push(match[1]);
    }

    return placeholders;
  }

  /**
   * Build item body by replacing {{n}} with inlineChoiceInteraction elements
   */
  private buildItemBody(
    markup: string,
    choices: { [key: string]: any[] },
    shuffle: string
  ): string {
    let html = markup;

    // Replace each {{n}} with an inlineChoiceInteraction
    for (const [index, choiceList] of Object.entries(choices)) {
      const responseId = `RESPONSE_${index}`;
      const placeholder = `{{${index}}}`;

      // Build inlineChoice elements
      const inlineChoices = choiceList
        .map(
          (choice: any) =>
            `<inlineChoice identifier="${choice.value}">${choice.label}</inlineChoice>`
        )
        .join('\n      ');

      // Build inlineChoiceInteraction
      const interaction = `<inlineChoiceInteraction responseIdentifier="${responseId}" shuffle="${shuffle}">
      ${inlineChoices}
    </inlineChoiceInteraction>`;

      // Replace placeholder
      html = html.replace(placeholder, interaction);
    }

    return html;
  }
}

/**
 * Factory function for creating the generator
 */
export function createInlineDropdownGenerator(): InlineDropdownGenerator {
  return new InlineDropdownGenerator();
}
