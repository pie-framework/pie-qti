/**
 * Custom Interaction Generator
 *
 * Fallback generator for unsupported PIE element types
 * Uses QTI customInteraction with embedded PIE model
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for unsupported PIE elements
 *
 * Creates a QTI customInteraction with the full PIE model embedded
 * as data-pie-model attribute for runtime rendering
 */
export class CustomInteractionGenerator extends BaseGenerator {
  readonly id = 'custom-interaction';
  readonly name = 'Custom Interaction';
  readonly version = '1.0.0';

  /**
   * This generator can handle any model (acts as fallback)
   */
  canHandle(): boolean {
    return true;
  }

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    const elementType = model.element || 'unknown';
    this.info(context, `Generating customInteraction for unsupported element: ${elementType}`);

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build response declaration (generic string response)
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'single',
      baseType: 'string',
    });

    // Build custom interaction with embedded PIE model
    const interaction = QtiBuilder.createCustomInteraction(responseId, elementType, model);

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], interaction, {
      title: model.title || 'Custom Interaction Item',
      pieElement: elementType,
    });

    const warnings = [
      `Element type '${elementType}' does not have a native QTI generator. Using customInteraction with embedded PIE model.`,
    ];

    this.warn(context, warnings[0]);

    return this.createResult(qti, warnings);
  }
}

/**
 * Factory function for creating the generator
 */
export function createCustomInteractionGenerator(): CustomInteractionGenerator {
  return new CustomInteractionGenerator();
}
