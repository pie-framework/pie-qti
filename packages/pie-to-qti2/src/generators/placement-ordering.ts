/**
 * Placement Ordering Generator
 *
 * Generates QTI orderInteraction from PIE placement-ordering models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface Choice {
  id: string;
  label: string;
}

/**
 * Generator for @pie-element/placement-ordering
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/placement-ordering',
 *   prompt: 'Order the steps from first to last.',
 *   choices: [
 *     { id: '0', label: 'Step A' },
 *     { id: '1', label: 'Step B' },
 *     { id: '2', label: 'Step C' }
 *   ],
 *   correctResponse: [
 *     { id: '1' },
 *     { id: '0' },
 *     { id: '2' }
 *   ],
 *   lockChoiceOrder: false,
 *   orientation: 'vertical',
 *   partialScoring: false
 * }
 *
 * QTI Output: orderInteraction with simpleChoice elements
 */
export class PlacementOrderingGenerator extends BaseGenerator {
  readonly id = '@pie-element/placement-ordering';
  readonly name = 'Placement Ordering';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating orderInteraction');

    // Validate model
    if (!model.choices || model.choices.length === 0) {
      throw new Error('placement-ordering requires choices array with at least one choice');
    }

    if (!model.correctResponse || model.correctResponse.length === 0) {
      throw new Error('placement-ordering requires correctResponse array');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build correct response - ordered list of identifiers
    const correctIds = model.correctResponse.map((item: { id: string }) => item.id);

    // Build response declaration (ordered cardinality)
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'ordered',
      baseType: 'identifier',
      correctResponse: correctIds,
    });

    // Build item body with orderInteraction
    const shuffle = model.lockChoiceOrder ? 'false' : 'true';
    const orientation = model.orientation || 'vertical';
    const itemBody = this.buildItemBody(
      model.choices,
      responseId,
      shuffle,
      orientation,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Placement Ordering Item',
      pieElement: this.id,
    });

    const warnings: string[] = [];

    if (model.partialScoring) {
      warnings.push(
        'Partial scoring is not standard QTI - preserved in data-pie-partial-scoring'
      );
    }

    this.debug(context, `Successfully generated orderInteraction with ${model.choices.length} choices`);

    return this.createResult(qti, warnings);
  }

  /**
   * Build item body with orderInteraction
   */
  private buildItemBody(
    choices: Choice[],
    responseId: string,
    shuffle: string,
    orientation: string,
    prompt?: string
  ): string {
    // Build prompt if present
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Build simpleChoice elements
    const choiceElements = choices
      .map(
        (choice) =>
          `      <simpleChoice identifier="${choice.id}">${choice.label}</simpleChoice>`
      )
      .join('\n');

    // Build orderInteraction
    const interaction = `${promptHtml}<orderInteraction responseIdentifier="${responseId}" shuffle="${shuffle}" orientation="${orientation}">
${choiceElements}
    </orderInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createPlacementOrderingGenerator(): PlacementOrderingGenerator {
  return new PlacementOrderingGenerator();
}
