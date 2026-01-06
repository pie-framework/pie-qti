/**
 * EBSR (Evidence-Based Selected Response) Generator
 *
 * Generates QTI with two choiceInteraction elements from PIE ebsr models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/ebsr
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/ebsr',
 *   partA: {
 *     prompt: 'Part A: Select the answer.',
 *     choices: [...],
 *     choiceMode: 'radio'
 *   },
 *   partB: {
 *     prompt: 'Part B: Select evidence.',
 *     choices: [...],
 *     choiceMode: 'checkbox'
 *   }
 * }
 *
 * QTI Output: Two choiceInteraction elements (Part A and Part B)
 */
export class EbsrGenerator extends BaseGenerator {
  readonly id = '@pie-element/ebsr';
  readonly name = 'EBSR';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating EBSR with two choiceInteraction elements');

    // Validate model
    if (!model.partA || !model.partA.choices) {
      throw new Error('ebsr requires partA with choices array');
    }

    if (!model.partB || !model.partB.choices) {
      throw new Error('ebsr requires partB with choices array');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);

    // Build Part A response declaration
    const correctA = model.partA.choices
      .filter((c: any) => c.correct)
      .map((c: any) => c.value);
    const responseADecl = buildResponseDeclaration({
      identifier: 'RESPONSE_A',
      cardinality: model.partA.choiceMode === 'checkbox' ? 'multiple' : 'single',
      baseType: 'identifier',
      correctResponse: correctA,
    });

    // Build Part B response declaration
    const correctB = model.partB.choices
      .filter((c: any) => c.correct)
      .map((c: any) => c.value);
    const responseBDecl = buildResponseDeclaration({
      identifier: 'RESPONSE_B',
      cardinality: model.partB.choiceMode === 'checkbox' ? 'multiple' : 'single',
      baseType: 'identifier',
      correctResponse: correctB,
    });

    // Build item body with both interactions
    const itemBody = this.buildItemBody(model.partA, model.partB, model.prompt);

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(
      itemId,
      [responseADecl, responseBDecl],
      itemBody,
      {
        title: model.title || 'EBSR Item',
        pieElement: this.id,
      }
    );

    const warnings = [
      'EBSR uses two separate choiceInteraction elements - QTI players must support multiple interactions per item',
      'Full PIE model is preserved in pie:sourceModel for accurate reconstruction',
    ];

    this.debug(context, 'Successfully generated EBSR item with Part A and Part B');

    return this.createResult(qti, warnings);
  }

  private buildItemBody(partA: any, partB: any, mainPrompt?: string): string {
    // Main prompt
    const promptHtml = mainPrompt ? `<prompt>${mainPrompt}</prompt>\n    ` : '';

    // Build Part A interaction
    const shuffleA = partA.shuffle !== false ? 'true' : 'false';
    const maxChoicesA = partA.choiceMode === 'checkbox' ? '0' : '1';
    const choicesA = partA.choices
      .map(
        (choice: any) =>
          `        <simpleChoice identifier="${choice.value}">${choice.label}</simpleChoice>`
      )
      .join('\n');

    const partAPrompt = partA.prompt ? `<prompt>${partA.prompt}</prompt>\n      ` : '';
    const interactionA = `<choiceInteraction responseIdentifier="RESPONSE_A" shuffle="${shuffleA}" maxChoices="${maxChoicesA}">
      ${partAPrompt}${choicesA}
    </choiceInteraction>`;

    // Build Part B interaction
    const shuffleB = partB.shuffle !== false ? 'true' : 'false';
    const maxChoicesB = partB.choiceMode === 'checkbox' ? '0' : '1';
    const choicesB = partB.choices
      .map(
        (choice: any) =>
          `        <simpleChoice identifier="${choice.value}">${choice.label}</simpleChoice>`
      )
      .join('\n');

    const partBPrompt = partB.prompt ? `<prompt>${partB.prompt}</prompt>\n      ` : '';
    const interactionB = `<choiceInteraction responseIdentifier="RESPONSE_B" shuffle="${shuffleB}" maxChoices="${maxChoicesB}">
      ${partBPrompt}${choicesB}
    </choiceInteraction>`;

    return `${promptHtml}${interactionA}

    ${interactionB}`;
  }
}

/**
 * Factory function for creating the generator
 */
export function createEbsrGenerator(): EbsrGenerator {
  return new EbsrGenerator();
}
