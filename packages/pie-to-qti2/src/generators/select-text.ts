/**
 * Select Text Generator
 *
 * Generates QTI hottextInteraction from PIE select-text models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { BaseGenerator } from './base-generator.js';
import type { GeneratorContext, GeneratorResult } from './types.js';

interface Token {
  text: string;
  start: number;
  end: number;
  correct: boolean;
}

/**
 * Generator for @pie-element/select-text
 *
 * PIE Model Structure:
 * {
 *   element: '@pie-element/select-text',
 *   prompt: 'Select all verbs in the sentence.',
 *   text: 'The cat runs quickly across the yard.',
 *   tokens: [
 *     { text: 'runs', start: 8, end: 12, correct: true },
 *     { text: 'quickly', start: 13, end: 20, correct: false }
 *   ],
 *   highlightChoices: false,
 *   maxSelections: 0,
 *   partialScoring: false
 * }
 *
 * QTI Output: hottextInteraction with hottext elements
 */
export class SelectTextGenerator extends BaseGenerator {
  readonly id = '@pie-element/select-text';
  readonly name = 'Select Text';
  readonly version = '1.0.0';

  generate(context: GeneratorContext): GeneratorResult {
    const { pieItem, model } = context;

    this.debug(context, 'Generating hottextInteraction');

    // Validate model
    if (!model.text) {
      throw new Error('select-text requires text field');
    }

    if (!model.tokens || model.tokens.length === 0) {
      throw new Error('select-text requires tokens array with at least one token');
    }

    // Generate item identifier
    const itemId = generateIdentifier(pieItem.id || pieItem.uuid);
    const responseId = 'RESPONSE';

    // Extract correct token identifiers
    const correctTokens = model.tokens
      .map((token: Token, idx: number) => ({ ...token, identifier: `TOKEN_${idx}` }))
      .filter((token: Token & { identifier: string }) => token.correct)
      .map((token: Token & { identifier: string }) => token.identifier);

    // Build response declaration
    const cardinality = correctTokens.length > 1 ? 'multiple' : 'single';
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality,
      baseType: 'identifier',
      correctResponse: correctTokens,
    });

    // Build item body with hottextInteraction
    const maxChoices = model.maxSelections || 0;
    const itemBody = this.buildItemBody(
      model.text,
      model.tokens,
      responseId,
      maxChoices,
      model.prompt
    );

    // Generate assessment item
    const qti = QtiBuilder.createAssessmentItem(itemId, [responseDecl], itemBody, {
      title: model.title || 'Select Text Item',
      pieElement: this.id,
    });

    const warnings: string[] = [];

    if (model.highlightChoices) {
      warnings.push(
        'highlightChoices is not standard QTI - preserved in data-pie-highlight-choices'
      );
    }

    if (model.partialScoring) {
      warnings.push(
        'Partial scoring is not standard QTI - preserved in data-pie-partial-scoring'
      );
    }

    this.debug(context, `Successfully generated hottextInteraction with ${model.tokens.length} tokens`);

    return this.createResult(qti, warnings);
  }

  /**
   * Build item body by inserting hottext elements at token positions
   */
  private buildItemBody(
    text: string,
    tokens: Token[],
    responseId: string,
    maxChoices: number,
    prompt?: string
  ): string {
    // Sort tokens by start position (descending) to insert from end to beginning
    const sortedTokens = [...tokens]
      .map((token, idx) => ({ ...token, identifier: `TOKEN_${idx}` }))
      .sort((a, b) => b.start - a.start);

    // Build text with hottext elements inserted
    let html = text;
    for (const token of sortedTokens) {
      const before = html.substring(0, token.start);
      const after = html.substring(token.end);
      const hottextElement = `<hottext identifier="${token.identifier}">${token.text}</hottext>`;
      html = before + hottextElement + after;
    }

    // Build prompt if present
    const promptHtml = prompt ? `<prompt>${prompt}</prompt>\n    ` : '';

    // Build hottextInteraction
    const maxChoicesAttr = maxChoices > 0 ? ` maxChoices="${maxChoices}"` : '';
    const interaction = `${promptHtml}<hottextInteraction responseIdentifier="${responseId}"${maxChoicesAttr}>
      ${html}
    </hottextInteraction>`;

    return interaction;
  }
}

/**
 * Factory function for creating the generator
 */
export function createSelectTextGenerator(): SelectTextGenerator {
  return new SelectTextGenerator();
}
