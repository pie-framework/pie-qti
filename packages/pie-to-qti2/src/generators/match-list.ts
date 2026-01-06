/**
 * Match List Generator
 *
 * Generates QTI matchInteraction from PIE match-list models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface Prompt {
  id: number;
  title: string;
  relatedAnswer: number;
}

interface Answer {
  id: number;
  title: string;
}

/**
 * Generator for @pie-element/match-list
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/match-list',
 *   prompt: 'Match each term to its definition.',
 *   prompts: [
 *     { id: 0, title: 'Term 1', relatedAnswer: 1 },
 *     { id: 1, title: 'Term 2', relatedAnswer: 0 }
 *   ],
 *   answers: [
 *     { id: 0, title: 'Definition A' },
 *     { id: 1, title: 'Definition B' }
 *   ],
 *   lockChoiceOrder: false,
 *   duplicates: false
 * }
 *
 * QTI Output: matchInteraction with two simpleMatchSet elements
 */
export class MatchListGenerator extends BaseGenerator {
  readonly id = '@pie-element/match-list';
  readonly name = 'Match List';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating matchInteraction for match-list');

    // Validate model
    if (!model.prompts || model.prompts.length === 0) {
      throw new Error('match-list requires prompts array with at least one prompt');
    }

    if (!model.answers || model.answers.length === 0) {
      throw new Error('match-list requires answers array with at least one answer');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Build correct response pairs
    const correctPairs: string[] = [];
    for (const prompt of model.prompts) {
      if (prompt.relatedAnswer !== undefined && prompt.relatedAnswer !== null) {
        correctPairs.push(`PROMPT_${prompt.id} ANSWER_${prompt.relatedAnswer}`);
      }
    }

    // Build response declaration (directed pairs)
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: 'multiple',
      baseType: 'directedPair',
      correctResponse: correctPairs,
    });

    // Build item body with matchInteraction
    const shuffle = model.lockChoiceOrder ? 'false' : 'true';
    const itemBody = this.buildItemBody(
      model.prompts,
      model.answers,
      responseId,
      shuffle,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Match List Item',
      pieElement: this.id,
    });

    const warnings: string[] = [];

    if (model.duplicates) {
      warnings.push(
        'Duplicates mode is not standard QTI - preserved in data-pie-duplicates'
      );
    }

    this.debug(context, `Successfully generated matchInteraction with ${model.prompts.length} prompts`);

    return this.createResult(qti, warnings);
  }

  /**
   * Build item body with matchInteraction
   */
  private buildItemBody(
    prompts: Prompt[],
    answers: Answer[],
    responseId: string,
    shuffle: string,
    prompt?: string
  ): string {
    // Build prompt if present
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Build first simpleMatchSet (prompts/questions)
    const promptChoices = prompts
      .map(
        (p) =>
          `        <simpleAssociableChoice identifier="PROMPT_${p.id}" matchMax="1">${p.title}</simpleAssociableChoice>`
      )
      .join('\n');

    // Build second simpleMatchSet (answers/responses)
    const answerChoices = answers
      .map(
        (a) =>
          `        <simpleAssociableChoice identifier="ANSWER_${a.id}" matchMax="${prompts.length}">${a.title}</simpleAssociableChoice>`
      )
      .join('\n');

    // Build matchInteraction
    const interaction = `${promptHtml}<matchInteraction responseIdentifier="${responseId}" shuffle="${shuffle}" maxAssociations="${prompts.length}">
      <simpleMatchSet>
${promptChoices}
      </simpleMatchSet>
      <simpleMatchSet>
${answerChoices}
      </simpleMatchSet>
    </matchInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createMatchListGenerator(): MatchListGenerator {
  return new MatchListGenerator();
}
