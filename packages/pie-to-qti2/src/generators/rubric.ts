/**
 * Rubric Generator
 *
 * Generates a standalone QTI item holding a rubricBlock from a PIE rubric model
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { isRubricModel, renderRubricBlock } from '../utils/rubric-block.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/rubric, @pie-element/multi-trait-rubric and @pie-element/complex-rubric
 *
 * A rubric beside an interaction is exported inside that interaction's item. This generator is for
 * a rubric exported on its own: an item with no interaction, holding the rubricBlock.
 */
export class RubricGenerator extends BaseGenerator {
  readonly id = '@pie-element/rubric';
  readonly name = 'Rubric';
  readonly version = '1.0.0';

  canHandle(model: any): boolean {
    return isRubricModel(model);
  }

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating rubricBlock');

    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const rubric = renderRubricBlock(model);
    const itemBody = rubric?.html ?? '<rubricBlock view="scorer"><p>No rubric content.</p></rubricBlock>';

    const qti = QtiBuilder.createAssessmentItem(itemId, [], itemBody, {
      title: model.title || 'Scoring Rubric',
      pieElement: model.element || this.id,
    });

    const warnings = ['PIE rubric generated as a standalone assessmentItem with no interaction'];

    this.debug(context, 'Successfully generated rubric item');

    return this.createResult(qti, warnings);
  }
}

/**
 * Factory function for creating the generator
 */
export function createRubricGenerator(): RubricGenerator {
  return new RubricGenerator();
}
