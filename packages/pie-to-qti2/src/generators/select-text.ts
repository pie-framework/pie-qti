/**
 * Select Text Generator
 *
 * Generates QTI hottextInteraction from PIE select-text models
 */

import { generateIdentifier } from '../utils/identifier-generator.js';
import { QtiBuilder } from '../utils/qti-builder.js';
import { buildResponseDeclaration } from '../utils/response-declaration-builder.js';
import { correctResponseScoring, partialScoringEnabled } from '../utils/scoring.js';
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
    // PIE's maxSelections 0 is unlimited, as is QTI's maxChoices 0; QTI defaults to 1 when omitted.
    const maxChoices = model.maxSelections || 0;
    const cardinality = maxChoices === 1 ? 'single' : 'multiple';
    const { mapping, scoring } = correctResponseScoring(correctTokens, partialScoringEnabled(model));
    const responseDecl = buildResponseDeclaration({
      identifier: responseId,
      cardinality,
      baseType: 'identifier',
      correctResponse: correctTokens,
      ...mapping,
    });

    // Build item body with hottextInteraction
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
      ...scoring,
    });

    const warnings: string[] = [];

    if (model.highlightChoices) {
      warnings.push(
        'highlightChoices is not standard QTI - preserved in data-pie-highlight-choices'
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
    const promptHtml = prompt ? `\n      <prompt>${prompt}</prompt>` : '';

    // Build hottextInteraction
    const maxChoicesAttr = maxChoices === 1 ? '' : ` maxChoices="${maxChoices}"`;
    // hottextInteraction holds block content: wrap passage text that is not already in a block.
    const body = /^\s*<(p|div|blockquote|ul|ol|table|h[1-6])[\s>]/i.test(html) ? html : `<p>${html}</p>`;
    const interaction = `<hottextInteraction responseIdentifier="${responseId}"${maxChoicesAttr}>${promptHtml}
      ${body}
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
