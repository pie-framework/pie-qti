/**
 * Drag in the Blank Generator
 *
 * Generates QTI gapMatchInteraction from PIE drag-in-the-blank models
 * Note: This is a complex interaction with limited QTI support
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/drag-in-the-blank
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/drag-in-the-blank',
 *   prompt: 'Drag words to complete the sentence.',
 *   markup: 'The {{0}} ran {{1}}.',
 *   choices: { '0': [...], '1': [...] },
 *   ...
 * }
 *
 * QTI Output: gapMatchInteraction with gapText and gap elements
 */
export class DragInTheBlankGenerator extends BaseGenerator {
  readonly id = '@pie-element/drag-in-the-blank';
  readonly name = 'Drag in the Blank';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating gapMatchInteraction');

    // Validate model
    if (!model.markup) {
      throw new Error('drag-in-the-blank requires markup field');
    }

    if (!model.choices) {
      throw new Error('drag-in-the-blank requires choices field');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Extract gaps and build correct responses
    const { gaps, correctResponses } = this.extractGaps(model.markup, model.choices);

    // Build response declaration
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'multiple',
      baseType: 'directedPair',
      correctResponse: correctResponses,
    });

    // Build item body with gapMatchInteraction
    const itemBody = this.buildItemBody(
      model.markup,
      model.choices,
      gaps,
      responseId,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Drag in the Blank Item',
      pieElement: this.id,
    });

    const warnings = [
      'drag-in-the-blank uses gapMatchInteraction which has limited support in QTI players',
      'Full PIE model is preserved in pie:sourceModel for accurate reconstruction',
    ];

    this.debug(context, `Successfully generated gapMatchInteraction with ${gaps.length} gaps`);

    return this.createResult(qti, warnings);
  }

  private extractGaps(markup: string, choices: any): { gaps: string[]; correctResponses: string[] } {
    const gapRegex = /\{\{(\d+)\}\}/g;
    const gaps: string[] = [];
    const correctResponses: string[] = [];
    let match;

    while ((match = gapRegex.exec(markup)) !== null) {
      const gapIndex = match[1];
      gaps.push(gapIndex);

      // Find correct choice for this gap
      const choicesForGap = choices[gapIndex] || [];
      const correctChoice = choicesForGap.find((c: any) => c.correct);
      if (correctChoice) {
        correctResponses.push(`CHOICE_${gapIndex}_${correctChoice.value} GAP_${gapIndex}`);
      }
    }

    return { gaps, correctResponses };
  }

  private buildItemBody(
    markup: string,
    choices: any,
    gaps: string[],
    responseId: string,
    prompt?: string
  ): string {
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Build gapText elements (draggable choices)
    const allChoices: string[] = [];
    for (const gapIndex of gaps) {
      const choicesForGap = choices[gapIndex] || [];
      for (const choice of choicesForGap) {
        allChoices.push(
          `      <gapText identifier="CHOICE_${gapIndex}_${choice.value}">${choice.label}</gapText>`
        );
      }
    }

    // Replace {{n}} with <gap> elements
    let processedMarkup = markup;
    for (const gapIndex of gaps) {
      processedMarkup = processedMarkup.replace(`{{${gapIndex}}}`, `<gap identifier="GAP_${gapIndex}"/>`);
    }

    const interaction = `${promptHtml}<gapMatchInteraction responseIdentifier="${responseId}">
${allChoices.join('\n')}
      <blockquote>
        <p>${processedMarkup}</p>
      </blockquote>
    </gapMatchInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createDragInTheBlankGenerator(): DragInTheBlankGenerator {
  return new DragInTheBlankGenerator();
}
