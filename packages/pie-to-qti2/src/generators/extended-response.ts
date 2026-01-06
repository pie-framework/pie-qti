/**
 * Extended Response Generator
 *
 * Generates QTI extendedTextInteraction from PIE extended-response models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/extended-response and @pie-element/extended-text-entry
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/extended-response',
 *   prompt: 'Explain your answer.',
 *   expectedLines: 5,
 *   maxLength: 1000,
 *   placeholder: 'Type your answer here...'
 * }
 *
 * QTI Output: extendedTextInteraction
 */
export class ExtendedResponseGenerator extends BaseGenerator {
  readonly id = '@pie-element/extended-response';
  readonly name = 'Extended Response';
  readonly version = '1.0.0';

  /**
   * Also handle extended-text-entry (alias)
   */
  canHandle(model: any): boolean {
    return (
      model.element === '@pie-element/extended-response' ||
      model.element === '@pie-element/extended-text-entry'
    );
  }

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating extendedTextInteraction');

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build response declaration for string response
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'single',
      baseType: 'string',
    });

    // Build item body
    const prompt = model.prompt ? QtiBuilder.createPrompt(model.prompt) : '';
    const expectedLines = model.expectedLines || 5;

    // Build interaction with optional attributes
    const attributes: string[] = [
      `responseIdentifier="${responseId}"`,
      `expectedLines="${expectedLines}"`,
    ];

    // Add optional attributes
    if (model.maxLength) {
      attributes.push(`expectedLength="${model.maxLength}"`);
    }

    if (model.placeholder) {
      attributes.push(`placeholderText="${model.placeholder}"`);
    }

    const interaction = `<extendedTextInteraction ${attributes.join(' ')}/>`;

    const itemBody = prompt ? `${prompt}\n    ${interaction}` : interaction;

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Extended Response Item',
      pieElement: model.element || this.id,
    });

    this.debug(context, 'Successfully generated extendedTextInteraction');

    return this.createResult(qti);
  }
}

/**
 * Factory function for creating the generator
 */
export function createExtendedResponseGenerator(): ExtendedResponseGenerator {
  return new ExtendedResponseGenerator();
}
