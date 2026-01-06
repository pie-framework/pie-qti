/**
 * Passage Generator
 *
 * Generates QTI stimulus/passage content from PIE passage models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { escapeXml, QtiBuilder } from '../utils/qti-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface PassageData {
  title: string;
  subtitle?: string;
  author?: string;
  text: string;
  teacherInstructions?: string;
}

/**
 * Generator for @pie-element/passage
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/passage',
 *   passages: [
 *     {
 *       title: 'Reading Passage',
 *       subtitle: 'Optional subtitle',
 *       author: 'Optional author',
 *       text: '<p>Passage content here...</p>',
 *       teacherInstructions: 'Optional instructions'
 *     }
 *   ],
 *   titleEnabled: true,
 *   subtitleEnabled: false,
 *   authorEnabled: false,
 *   textEnabled: true,
 *   teacherInstructionsEnabled: false
 * }
 *
 * QTI Output: assessmentItem with stimulus content (no interaction)
 *
 * Note: PIE passages are informational content without interactions.
 * QTI doesn't have a dedicated "passage item" type, so we create an
 * assessmentItem with stimulus content but no interactions.
 */
export class PassageGenerator extends BaseGenerator {
  readonly id = '@pie-element/passage';
  readonly name = 'Passage';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating passage/stimulus content');

    // Validate model
    if (!model.passages || model.passages.length === 0) {
      throw new Error('passage requires passages array with at least one passage');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);

    // Use first passage (PIE supports multiple, but QTI typically has one per item)
    const passage = model.passages[0];

    // Build item body with passage content
    const itemBody = this.buildItemBody(
      passage,
      model.titleEnabled ?? true,
      model.subtitleEnabled ?? false,
      model.authorEnabled ?? false,
      model.textEnabled ?? true,
      model.teacherInstructionsEnabled ?? false
    );

    // Generate assessment item (no response declarations for passages)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="${escapeXml(itemId)}"
  title="${escapeXml(passage.title || 'Passage')}"
  adaptive="false"
  timeDependent="false">
  <!-- Generated from ${this.id} -->
  <itemBody>
    ${itemBody}
  </itemBody>
</assessmentItem>`;

    const qti = QtiBuilder.format(xml);

    const warnings = [
      'PIE passage items do not have interactions - generated as informational content',
      'If multiple passages exist in PIE model, only the first is used',
    ];

    this.debug(context, 'Successfully generated passage item');

    return this.createResult(qti, warnings);
  }

  /**
   * Build item body with passage content
   */
  private buildItemBody(
    passage: PassageData,
    titleEnabled: boolean,
    subtitleEnabled: boolean,
    authorEnabled: boolean,
    textEnabled: boolean,
    teacherInstructionsEnabled: boolean
  ): string {
    const parts: string[] = [];

    // Add title if enabled
    if (titleEnabled && passage.title) {
      parts.push(`<div class="passage-title"><h2>${passage.title}</h2></div>`);
    }

    // Add subtitle if enabled
    if (subtitleEnabled && passage.subtitle) {
      parts.push(`<div class="passage-subtitle"><h3>${passage.subtitle}</h3></div>`);
    }

    // Add author if enabled
    if (authorEnabled && passage.author) {
      parts.push(`<div class="passage-author"><p><em>By ${passage.author}</em></p></div>`);
    }

    // Add main text if enabled
    if (textEnabled && passage.text) {
      parts.push(`<div class="passage-text">${passage.text}</div>`);
    }

    // Add teacher instructions if enabled (usually not visible to students)
    if (teacherInstructionsEnabled && passage.teacherInstructions) {
      parts.push(`<!-- Teacher Instructions: ${escapeXml(passage.teacherInstructions)} -->`);
    }

    return parts.join('\n    ');
  }
}

/**
 * Factory function for creating the generator
 */
export function createPassageGenerator(): PassageGenerator {
  return new PassageGenerator();
}
