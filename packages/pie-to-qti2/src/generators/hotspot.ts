/**
 * Hotspot Generator
 *
 * Generates QTI hotspotInteraction from PIE hotspot models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface Rectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  correct: boolean;
}

interface Polygon {
  id: string;
  points: Array<{ x: number; y: number }>;
  correct: boolean;
}

/**
 * Generator for @pie-element/hotspot
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/hotspot',
 *   prompt: 'Click on the verb in the diagram.',
 *   imageUrl: 'image.png',
 *   dimensions: { width: 500, height: 300 },
 *   multipleCorrect: false,
 *   shapes: {
 *     rectangles: [
 *       { id: 'rect1', x: 100, y: 50, width: 80, height: 40, correct: true }
 *     ],
 *     polygons: [
 *       { id: 'poly1', points: [{x: 200, y: 100}, {x: 250, y: 150}], correct: false }
 *     ]
 *   },
 *   hotspotColor: 'rgba(137, 183, 244, 0.65)',
 *   outlineColor: 'blue',
 *   partialScoring: false
 * }
 *
 * QTI Output: hotspotInteraction with hotspotChoice elements
 */
export class HotspotGenerator extends BaseGenerator {
  readonly id = '@pie-element/hotspot';
  readonly name = 'Hotspot';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating hotspotInteraction');

    // Validate model
    if (!model.imageUrl) {
      throw new Error('hotspot requires imageUrl field');
    }

    if (!model.dimensions || !model.dimensions.width || !model.dimensions.height) {
      throw new Error('hotspot requires dimensions with width and height');
    }

    if (!model.shapes) {
      throw new Error('hotspot requires shapes field');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Collect all correct shape identifiers
    const correctIds: string[] = [];
    const rectangles = model.shapes.rectangles || [];
    const polygons = model.shapes.polygons || [];

    for (const rect of rectangles) {
      if (rect.correct) correctIds.push(rect.id);
    }
    for (const poly of polygons) {
      if (poly.correct) correctIds.push(poly.id);
    }

    // Build response declaration
    const cardinality = correctIds.length > 1 ? 'multiple' : 'single';
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality,
      baseType: 'identifier',
      correctResponse: correctIds,
    });

    // Build item body with hotspotInteraction
    const maxChoices = model.multipleCorrect ? correctIds.length : 1;
    const itemBody = this.buildItemBody(
      model.imageUrl,
      model.dimensions,
      rectangles,
      polygons,
      responseId,
      maxChoices,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Hotspot Item',
      pieElement: this.id,
    });

    const warnings: string[] = [];

    if (model.hotspotColor) {
      warnings.push(
        'hotspotColor is not standard QTI - preserved in data-pie-hotspot-color'
      );
    }

    if (model.outlineColor) {
      warnings.push(
        'outlineColor is not standard QTI - preserved in data-pie-outline-color'
      );
    }

    if (model.partialScoring) {
      warnings.push(
        'Partial scoring is not standard QTI - preserved in data-pie-partial-scoring'
      );
    }

    this.debug(
      context,
      `Successfully generated hotspotInteraction with ${rectangles.length} rectangles and ${polygons.length} polygons`
    );

    return this.createResult(qti, warnings);
  }

  /**
   * Build item body with hotspotInteraction
   */
  private buildItemBody(
    imageUrl: string,
    dimensions: { width: number; height: number },
    rectangles: Rectangle[],
    polygons: Polygon[],
    responseId: string,
    maxChoices: number,
    prompt?: string
  ): string {
    // Build prompt if present
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Build image element
    const imageElement = `<img src="${imageUrl}" width="${dimensions.width}" height="${dimensions.height}" />`;

    // Build hotspotChoice elements for rectangles
    const rectChoices = rectangles
      .map((rect) => {
        const coords = `${rect.x},${rect.y},${rect.x + rect.width},${rect.y + rect.height}`;
        return `      <hotspotChoice identifier="${rect.id}" shape="rect" coords="${coords}" />`;
      })
      .join('\n');

    // Build hotspotChoice elements for polygons
    const polyChoices = polygons
      .map((poly) => {
        const coords = poly.points.map((p) => `${p.x},${p.y}`).join(',');
        return `      <hotspotChoice identifier="${poly.id}" shape="poly" coords="${coords}" />`;
      })
      .join('\n');

    // Combine all choices
    const allChoices = [rectChoices, polyChoices].filter((c) => c).join('\n');

    // Build hotspotInteraction
    const maxChoicesAttr = maxChoices > 1 ? ` maxChoices="${maxChoices}"` : '';
    const interaction = `${promptHtml}<hotspotInteraction responseIdentifier="${responseId}"${maxChoicesAttr}>
      ${imageElement}
${allChoices}
    </hotspotInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createHotspotGenerator(): HotspotGenerator {
  return new HotspotGenerator();
}
