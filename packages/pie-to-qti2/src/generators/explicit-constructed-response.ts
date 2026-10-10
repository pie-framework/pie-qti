/**
 * Explicit Constructed Response Generator
 *
 * Generates QTI textEntryInteraction from PIE explicit-constructed-response models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { escapeXml, QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { templateScoring } from '../utils/scoring.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/explicit-constructed-response
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/explicit-constructed-response',
 *   prompt: 'What is the capital of France?',
 *   correctResponse: ['Paris', 'paris'],
 *   maxLength: 100
 * }
 *
 * QTI Output: textEntryInteraction
 */
export class ExplicitConstructedResponseGenerator extends BaseGenerator {
  readonly id = '@pie-element/explicit-constructed-response';
  readonly name = 'Explicit Constructed Response';
  readonly version = '1.0.0';

  /**
   * Also handle text-entry (alias)
   */
  canHandle(model: any): boolean {
    return (
      model.element === '@pie-element/explicit-constructed-response' ||
      model.element === '@pie-element/text-entry'
    );
  }

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating textEntryInteraction');

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build response declaration with correct answer
    // A single response holds one correct value; every accepted answer scores through the mapping,
    // case-sensitively as PIE compares them.
    const accepted: string[] = (
      Array.isArray(model.correctResponse) ? model.correctResponse : [model.correctResponse]
    ).filter((value: unknown): value is string => typeof value === 'string' && value !== '');
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'single',
      baseType: 'string',
      correctResponse: accepted.slice(0, 1),
      mapping: accepted.map((mapKey) => ({ mapKey, mappedValue: 1, caseSensitive: true })),
      mappingBounds: { defaultValue: 0, upperBound: 1 },
    });

    // Build interaction with optional attributes
    const attributes: string[] = [`responseIdentifier="${responseId}"`];

    if (model.maxLength) {
      attributes.push(`expectedLength="${model.maxLength}"`);
    }

    if (model.placeholder) {
      attributes.push(`placeholderText="${escapeXml(String(model.placeholder))}"`);
    }

    const interaction = `<textEntryInteraction ${attributes.join(' ')}/>`;

    // textEntryInteraction is inline and takes no prompt: the prompt becomes body content before it.
    const body = `<p>${interaction}</p>`;
    const itemBody = model.prompt ? `<div>${model.prompt}</div>\n    ${body}` : body;

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Text Entry Item',
      pieElement: model.element || this.id,
      ...templateScoring(accepted.length > 0 ? 'map_response' : 'match_correct'),
    });

    this.debug(context, 'Successfully generated textEntryInteraction');

    return this.createResult(qti);
  }
}

/**
 * Factory function for creating the generator
 */
export function createExplicitConstructedResponseGenerator(): ExplicitConstructedResponseGenerator {
  return new ExplicitConstructedResponseGenerator();
}
