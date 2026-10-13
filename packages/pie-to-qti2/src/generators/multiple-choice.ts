/**
 * Multiple Choice Generator
 *
 * Generates QTI choiceInteraction from PIE multiple-choice models
 */

import { generateChoiceIdentifier, generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import {
  choiceSelectionScoring,
  correctResponseScoring,
  partialScoringEnabled,
  templateScoring,
} from '../utils/scoring.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

/**
 * Generator for @pie-element/multiple-choice
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/multiple-choice',
 *   prompt: 'What is 2 + 2?',
 *   choiceMode: 'radio' | 'checkbox',
 *   lockChoiceOrder: boolean,
 *   choices: [
 *     { label: '3', value: 'a', correct: false },
 *     { label: '4', value: 'b', correct: true }
 *   ],
 *   partialScoring: boolean
 * }
 *
 * QTI Output: choiceInteraction with simpleChoice elements
 */
export class MultipleChoiceGenerator extends BaseGenerator {
  readonly id = '@pie-element/multiple-choice';
  readonly name = 'Multiple Choice';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating choiceInteraction');

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Extract model properties
    const choices = model.choices || [];
    const shuffle = model.lockChoiceOrder ? 'false' : 'true';
    const maxChoices = model.choiceMode === 'checkbox' ? String(choices.length) : '1';

    // Validate choices
    if (choices.length === 0) {
      this.warn(context, 'No choices provided');
    }

    // Generate choice elements
    const choicesXml = choices
      .map((choice: any, i: number) => {
        const identifier = generateChoiceIdentifier(i);
        return QtiBuilder.createSimpleChoice(identifier, choice.label || choice.value);
      })
      .join('\n    ');

    // Build response declaration with correct answers
    const correctValues = choices
      .map((choice: any, i: number) => (choice.correct ? generateChoiceIdentifier(i) : null))
      .filter(Boolean);

    // PIE scores a radio item all-or-nothing whatever its partialScoring setting. A partial-credit
    // checkbox item keeps its mapping for importers and map_response consumers, and is scored by
    // PIE's own selection rule, which a mapping cannot express.
    const { mapping, scoring: mappedScoring } =
      maxChoices === '1'
        ? { mapping: {}, scoring: templateScoring('match_correct') }
        : correctResponseScoring(correctValues, partialScoringEnabled(model));
    const scoring = mapping.mapping ? choiceSelectionScoring(responseId, correctValues) : mappedScoring;

    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality: maxChoices === '1' ? 'single' : 'multiple',
      baseType: 'identifier',
      correctResponse: correctValues,
      ...mapping,
    });

    // Build item body
    const prompt = model.prompt ? QtiBuilder.createPrompt(model.prompt) : '';

    // Carry the choice layout back to QTI's orientation. QTI 2.2 allows only
    // horizontal and vertical, so `grid` and its column count are not emitted.
    const orientation =
      model.choicesLayout === 'horizontal' || model.choicesLayout === 'vertical'
        ? ` orientation="${model.choicesLayout}"`
        : '';

    const interaction = `<choiceInteraction responseIdentifier="${responseId}" shuffle="${shuffle}" maxChoices="${maxChoices}"${orientation}>${prompt ? `\n    ${prompt}` : ''}
    ${choicesXml}
  </choiceInteraction>`;

    const itemBody = interaction;

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Multiple Choice Item',
      pieElement: this.id,
      ...scoring,
    });

    const warnings: string[] = [];

    this.debug(context, 'Successfully generated choiceInteraction');

    return this.createResult(qti, warnings);
  }
}

/**
 * Factory function for creating the generator
 */
export function createMultipleChoiceGenerator(): MultipleChoiceGenerator {
  return new MultipleChoiceGenerator();
}
