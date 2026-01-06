/**
 * Match Generator
 *
 * Generates QTI matchInteraction from PIE match models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface Row {
  id: string;
  title: string;
  values: boolean[];
}

/**
 * Generator for @pie-element/match
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/match',
 *   prompt: 'Match each item to its category.',
 *   headers: ['', 'Category A', 'Category B'],
 *   rows: [
 *     { id: '0', title: 'Item 1', values: [false, true, false] },
 *     { id: '1', title: 'Item 2', values: [false, false, true] }
 *   ],
 *   lockChoiceOrder: false,
 *   choiceMode: 'radio',
 *   partialScoring: false
 * }
 *
 * QTI Output: matchInteraction with two simpleMatchSet elements
 */
export class MatchGenerator extends BaseGenerator {
  readonly id = '@pie-element/match';
  readonly name = 'Match';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating matchInteraction');

    // Validate model
    if (!model.headers || model.headers.length < 2) {
      throw new Error('match requires headers array with at least 2 headers');
    }

    if (!model.rows || model.rows.length === 0) {
      throw new Error('match requires rows array with at least one row');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build correct response pairs
    const correctPairs: string[] = [];
    for (const row of model.rows) {
      const rowId = row.id;
      // Skip first value (empty column)
      for (let i = 1; i < row.values.length; i++) {
        if (row.values[i]) {
          const colId = `COL_${i - 1}`;
          correctPairs.push(`${rowId} ${colId}`);
        }
      }
    }

    // Build response declaration (pairs)
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'multiple',
      baseType: 'directedPair',
      correctResponse: correctPairs,
    });

    // Build item body with matchInteraction
    const shuffle = model.lockChoiceOrder ? 'false' : 'true';
    const itemBody = this.buildItemBody(
      model.headers,
      model.rows,
      responseId,
      shuffle,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Match Item',
      pieElement: this.id,
    });

    const warnings: string[] = [];

    if (model.choiceMode === 'checkbox') {
      warnings.push(
        'Multiple selections per row (checkbox mode) is not standard QTI - preserved in data-pie-choice-mode'
      );
    }

    if (model.partialScoring) {
      warnings.push(
        'Partial scoring is not standard QTI - preserved in data-pie-partial-scoring'
      );
    }

    this.debug(context, `Successfully generated matchInteraction with ${model.rows.length} rows`);

    return this.createResult(qti, warnings);
  }

  /**
   * Build item body with matchInteraction
   */
  private buildItemBody(
    headers: string[],
    rows: Row[],
    responseId: string,
    shuffle: string,
    prompt?: string
  ): string {
    // Build prompt if present
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Build first simpleMatchSet (rows/stems)
    const rowChoices = rows
      .map(
        (row) =>
          `        <simpleAssociableChoice identifier="${row.id}" matchMax="1">${row.title}</simpleAssociableChoice>`
      )
      .join('\n');

    // Build second simpleMatchSet (columns/options) - skip first empty header
    const colChoices = headers
      .slice(1)
      .map(
        (header, idx) =>
          `        <simpleAssociableChoice identifier="COL_${idx}" matchMax="${rows.length}">${header}</simpleAssociableChoice>`
      )
      .join('\n');

    // Build matchInteraction
    const interaction = `${promptHtml}<matchInteraction responseIdentifier="${responseId}" shuffle="${shuffle}" maxAssociations="${rows.length}">
      <simpleMatchSet>
${rowChoices}
      </simpleMatchSet>
      <simpleMatchSet>
${colChoices}
      </simpleMatchSet>
    </matchInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createMatchGenerator(): MatchGenerator {
  return new MatchGenerator();
}
