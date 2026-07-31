/**
 * QTI 2.1/2.2 hottextInteraction to PIE select-text transformer
 *
 * Transforms QTI hottextInteraction elements into PIE select-text items.
 * Handles text selection tasks where students select highlighted words/phrases.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { extractPromptForInteraction } from '../utils/prompt-extraction.js';
import { createMissingInteractionError } from '../utils/qti-errors.js';
import {
  deriveItemScoring,
  findResponseDeclaration,
  readCorrectResponseValues,
  readMapping,
} from '../utils/response-scoring.js';

export interface SelectTextOptions {
  /** Overrides the partial scoring derived from the QTI source. */
  partialScoring?: boolean;
  /** Whether to highlight all selectable choices */
  highlightChoices?: boolean;
  /** Maximum number of selections allowed (0 = unlimited) */
  maxSelections?: number;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Token {
  text: string;
  start: number;
  end: number;
  correct: boolean;
}

/**
 * Transform QTI hottextInteraction to PIE select-text
 */
export function transformSelectText(
  qtiXml: string,
  itemId: string,
  options?: SelectTextOptions
): PieItem {
  const document = parse(qtiXml);
  const hottextInteraction = document.getElementsByTagName('hottextInteraction')[0];

  if (!hottextInteraction) {
    throw createMissingInteractionError('hottextInteraction', {
      itemId,
      details: 'For text selection questions, use <hottextInteraction> with <hottext> elements marking selectable text.',
    });
  }

  const responseIdentifier = hottextInteraction.getAttribute('responseIdentifier') || 'RESPONSE';
  const maxChoices = hottextInteraction.getAttribute('maxChoices');

  // Extract prompt
  const itemBody = document.getElementsByTagName('itemBody')[0];
  const prompt = itemBody ? extractPromptForInteraction(itemBody, hottextInteraction) : '';

  // Extract correct answers
  const correctAnswers = extractCorrectAnswers(document, responseIdentifier);

  // Extract text content and tokens from hottextInteraction
  const { text, tokens } = extractTextAndTokens(hottextInteraction, correctAnswers);

  // Determine max selections
  let maxSelections = options?.maxSelections ?? 1;
  if (maxChoices) {
    maxSelections = parseInt(maxChoices, 10);
  }

  // If correct answers exceed max selections, set to unlimited
  if (maxSelections !== 0 && correctAnswers.size > maxSelections) {
    maxSelections = 0;
  }

  const modelId = uuid();
  const scoring = deriveItemScoring(document);

  const pieItem: PieItem = {
    id: itemId,
    ...(options?.baseId && { baseId: options.baseId }),
    uuid: modelId,
    config: {
      id: modelId,
      models: [
        {
          id: modelId,
          element: '@pie-element/select-text',
          prompt: prompt || '',
          highlightChoices: options?.highlightChoices ?? false,
          maxSelections,
          text,
          tokens,
          partialScoring: options?.partialScoring ?? scoring.partialScoring,
          mode: '',
        },
      ],
      elements: {
        'select-text': '@pie-element/select-text@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'ST',
        source: 'qti22',
        ...(scoring.weight !== undefined && { maxScore: scoring.weight }),
      },
    },
  };

  return pieItem;
}

/**
 * Extract correct answers from responseDeclaration
 */
function extractCorrectAnswers(
  document: HTMLElement,
  responseIdentifier: string
): Set<string> {
  const responseDeclaration = findResponseDeclaration(document, responseIdentifier);

  if (!responseDeclaration) {
    return new Set<string>();
  }

  const declared = readCorrectResponseValues(responseDeclaration);

  // An item scored via map_response need not declare a correctResponse at all.
  // Fall back to the mapping only when the declared key produced nothing, and
  // only for strictly positive mappedValues — a zero-scoring mapEntry is a
  // distractor, not an answer.
  const keys = declared.length > 0 ? declared : (readMapping(responseDeclaration)?.positiveKeys ?? []);

  return new Set(keys);
}

/**
 * Extract the passage text and selectable tokens from a `hottextInteraction`.
 *
 * `<hottext>` wrappers are unwrapped — their content stays in the passage — and each one
 * becomes a token carrying the character range it occupies.
 *
 * **The offset invariant is structural, not asserted:** the passage is built by appending
 * to `text`, and a token's `start`/`end` are read off `text.length` immediately before and
 * after its content is appended, so `text.slice(start, end) === token.text` cannot drift.
 * It is written this way on purpose. PIE's select-text model requires `start`/`end` and its
 * controller scores by comparing them alone (`pie-elements` -
 * `packages/select-text/controller/src/index.js`), so an offset that does not index the
 * emitted `text` is a wrong answer key rather than a cosmetic slip — and the previous
 * approach (measure positions while splicing the string being measured, then normalize the
 * result) produced exactly that, invisibly, because the element's view re-resolves tokens
 * by string search and papers over it at render time.
 *
 * Corollary worth keeping: nothing may reshape `text` after this loop. Normalization
 * happens up front, before any position is taken.
 */
function extractTextAndTokens(
  hottextInteraction: HTMLElement,
  correctAnswers: Set<string>
): { text: string; tokens: Token[] } {
  let source = hottextInteraction.innerHTML;
  source = removePromptTag(source);
  // Self-closed tags are empty selections; drop them before anything measures positions.
  source = removeSelfClosedHottextTags(source);
  source = unescapeHtml(source);
  source = source.trim();

  const tokens: Token[] = [];
  let text = '';
  let cursor = 0;

  for (const match of source.matchAll(HOTTEXT_ELEMENT_PATTERN)) {
    const content = match[2] ?? '';
    text += source.slice(cursor, match.index);
    const start = text.length;
    text += content;
    tokens.push({
      text: content,
      start,
      end: text.length,
      // Scoped to this tag's own attributes. Reading the identifier out of the wider
      // string would let a tag with no identifier inherit the next tag's, silently
      // marking an unselectable word correct.
      correct: correctAnswers.has(readIdentifier(match[1] ?? '')),
    });
    cursor = (match.index ?? 0) + match[0].length;
  }
  text += source.slice(cursor);

  return { text, tokens };
}

/**
 * A paired `<hottext>` element, capturing its attribute run and its content.
 *
 * The attribute run is `(?:[^>"']|"[^"]*"|'[^']*')*` rather than `[^>]*` so a quoted
 * attribute value containing `>` does not end the tag early — which used to split the tag
 * mid-attribute and leave the remainder in the passage as literal text.
 */
const HOTTEXT_ELEMENT_PATTERN =
  /<hottext\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/hottext\s*>/gi;

/** Attributes may be single- or double-quoted; QTI in the wild uses both. */
const IDENTIFIER_ATTRIBUTE_PATTERN = /\bidentifier\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/** The tag's own `identifier`, or `''` when it declares none (never a neighbour's). */
function readIdentifier(attributes: string): string {
  const match = IDENTIFIER_ATTRIBUTE_PATTERN.exec(attributes);
  return match?.[1] ?? match?.[2] ?? '';
}

/**
 * Remove prompt tag from interaction HTML
 *
 * Deliberately does not trim: `extractTextAndTokens` owns whitespace normalization so it
 * happens once, before token offsets are measured against the result.
 */
function removePromptTag(html: string): string {
  const promptStart = html.indexOf('<prompt');
  if (promptStart === -1) return html;

  let promptEnd = html.indexOf('</prompt>', promptStart);
  if (promptEnd === -1) {
    // Self-closing prompt tag
    promptEnd = html.indexOf('/>', promptStart);
    if (promptEnd !== -1) {
      promptEnd += 2;
    }
  } else {
    promptEnd += 9; // '</prompt>'.length
  }

  if (promptEnd === -1) return html;

  return html.substring(0, promptStart) + html.substring(promptEnd);
}

/**
 * Remove self-closed hottext tags (empty selections)
 *
 * Same quote-aware attribute run as `HOTTEXT_ELEMENT_PATTERN`, so a quoted attribute value
 * containing `>` cannot end the tag early and leave half of it behind in the passage.
 */
function removeSelfClosedHottextTags(html: string): string {
  return html.replace(/<hottext\b(?:[^>"']|"[^"]*"|'[^']*')*\/>/gi, '');
}

/**
 * Unescape HTML entities
 */
function unescapeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
