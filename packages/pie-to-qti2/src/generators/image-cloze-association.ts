/**
 * Image Cloze Association Generator
 *
 * Generates QTI graphicGapMatchInteraction from PIE image-cloze-association models
 * Note: This is a complex interaction with limited QTI support
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/image-cloze-association
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/image-cloze-association',
 *   prompt: 'Drag items to the correct locations.',
 *   imageUrl: 'image.png',
 *   responseContainers: [...],
 *   possibleResponses: [...],
 *   ...
 * }
 *
 * QTI Output: graphicGapMatchInteraction with gapImg and associableHotspot elements
 */
export class ImageClozeAssociationGenerator extends BaseGenerator {
  readonly id = '@pie-element/image-cloze-association';
  readonly name = 'Image Cloze Association';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating graphicGapMatchInteraction');

    // Validate model
    if (!model.imageUrl) {
      throw new Error('image-cloze-association requires imageUrl field');
    }

    if (!model.responseContainers || model.responseContainers.length === 0) {
      throw new Error('image-cloze-association requires responseContainers array');
    }

    if (!model.possibleResponses || model.possibleResponses.length === 0) {
      throw new Error('image-cloze-association requires possibleResponses array');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build correct responses
    const correctPairs: string[] = [];
    for (const container of model.responseContainers) {
      if (container.correctResponse) {
        correctPairs.push(`RESPONSE_${container.correctResponse} CONTAINER_${container.id}`);
      }
    }

    // Build response declaration
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'multiple',
      baseType: 'directedPair',
      correctResponse: correctPairs,
    });

    // Build item body with graphicGapMatchInteraction
    const dimensions = model.dimensions || { width: 500, height: 300 };
    const itemBody = this.buildItemBody(
      model.imageUrl,
      dimensions,
      model.responseContainers,
      model.possibleResponses,
      responseId,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Image Cloze Association Item',
      pieElement: this.id,
    });

    const warnings = [
      'image-cloze-association uses graphicGapMatchInteraction which has limited support in QTI players',
      'Full PIE model is preserved in pie:sourceModel for accurate reconstruction',
    ];

    this.debug(context, `Successfully generated graphicGapMatchInteraction`);

    return this.createResult(qti, warnings);
  }

  private buildItemBody(
    imageUrl: string,
    dimensions: { width: number; height: number },
    containers: any[],
    responses: any[],
    responseId: string,
    prompt?: string
  ): string {
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Build gapImg elements (draggable responses)
    const gapImgElements = responses
      .map(
        (response) =>
          `      <gapImg identifier="RESPONSE_${response.id}">${response.value || response.label}</gapImg>`
      )
      .join('\n');

    // Build associableHotspot elements (drop zones)
    const hotspotElements = containers
      .map((container) => {
        const coords = `${container.x},${container.y},${container.x + container.width},${container.y + container.height}`;
        return `        <associableHotspot identifier="CONTAINER_${container.id}" shape="rect" coords="${coords}" matchMax="1"/>`;
      })
      .join('\n');

    const interaction = `${promptHtml}<graphicGapMatchInteraction responseIdentifier="${responseId}">
${gapImgElements}
      <object type="image/png" data="${imageUrl}" width="${dimensions.width}" height="${dimensions.height}">
${hotspotElements}
      </object>
    </graphicGapMatchInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createImageClozeAssociationGenerator(): ImageClozeAssociationGenerator {
  return new ImageClozeAssociationGenerator();
}
