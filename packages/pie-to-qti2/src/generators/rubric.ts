/**
 * Rubric Generator
 *
 * Generates QTI rubricBlock from PIE rubric models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { escapeXml, QtiBuilder } from '../utils/qti-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/rubric and @pie-element/complex-rubric
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/rubric',
 *   rubricContent: '<table>...</table>',
 *   excludeZero: false,
 *   halfScoring: false,
 *   maxPoints: 4,
 *   points: [0, 1, 2, 3, 4],
 *   criteria: [...] // Optional structured criteria
 * }
 *
 * QTI Output: assessmentItem with rubricBlock
 *
 * Note: QTI rubricBlocks are typically embedded within assessmentItems
 * containing interactions. This generator creates a standalone item
 * with only the rubric for cases where the rubric is a separate entity.
 */
export class RubricGenerator extends BaseGenerator {
  readonly id = '@pie-element/rubric';
  readonly name = 'Rubric';
  readonly version = '1.0.0';

  canHandle(model: any): boolean {
    return model.element === '@pie-element/rubric' ||
           model.element === '@pie-element/complex-rubric';
  }

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating rubricBlock');

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);

    // Build rubric content
    const rubricContent = this.buildRubricContent(model);

    // Generate assessment item with rubric
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="${escapeXml(itemId)}"
  title="${escapeXml(model.title || 'Scoring Rubric')}"
  adaptive="false"
  timeDependent="false">
  <!-- Generated from ${model.element} -->
  <itemBody>
    <div class="rubric-introduction">
      <p>This is a scoring rubric for use by instructors or scorers.</p>
    </div>
  </itemBody>
  ${rubricContent}
</assessmentItem>`;

    const qti = QtiBuilder.format(xml);

    const warnings = [
      'PIE rubric generated as standalone assessmentItem with rubricBlock',
      'In QTI, rubrics are typically embedded within items containing interactions',
    ];

    this.debug(context, 'Successfully generated rubric item');

    return this.createResult(qti, warnings);
  }

  /**
   * Build rubricBlock content
   */
  private buildRubricContent(model: any): string {
    // If rubricContent HTML is provided, use it directly
    if (model.rubricContent) {
      return `<rubricBlock view="scorer">
    ${model.rubricContent}
  </rubricBlock>`;
    }

    // Otherwise, build from structured criteria
    if (model.criteria && Array.isArray(model.criteria)) {
      return this.buildStructuredRubric(model);
    }

    // Fallback: create simple rubric from points
    return this.buildSimpleRubric(model);
  }

  /**
   * Build rubric from structured criteria
   */
  private buildStructuredRubric(model: any): string {
    const rows = model.criteria.map((criterion: any) => {
      return `      <tr>
        <td>${criterion.points || 0}</td>
        <td>${criterion.description || ''}</td>
      </tr>`;
    }).join('\n');

    return `<rubricBlock view="scorer">
    <p><strong>Scoring Guide:</strong></p>
    <table>
      <tr>
        <th>Points</th>
        <th>Criteria</th>
      </tr>
${rows}
    </table>
  </rubricBlock>`;
  }

  /**
   * Build simple rubric from points array
   */
  private buildSimpleRubric(model: any): string {
    const maxPoints = model.maxPoints || 4;
    const points = model.points || Array.from({ length: maxPoints + 1 }, (_, i) => i);

    const rows = points.map((point: number) => {
      return `      <tr>
        <td>${point}</td>
        <td>Score level ${point}</td>
      </tr>`;
    }).join('\n');

    return `<rubricBlock view="scorer">
    <p><strong>Scoring Guide:</strong></p>
    <table>
      <tr>
        <th>Points</th>
        <th>Criteria</th>
      </tr>
${rows}
    </table>
  </rubricBlock>`;
  }
}

/**
 * Factory function for creating the generator
 */
export function createRubricGenerator(): RubricGenerator {
  return new RubricGenerator();
}
