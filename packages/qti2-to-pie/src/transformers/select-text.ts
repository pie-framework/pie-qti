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
import { createMissingInteractionError } from '../utils/qti-errors.js';

export interface SelectTextOptions {
  /** Whether to enable partial scoring by default */
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
  const prompt = extractPrompt(document);

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
          partialScoring: options?.partialScoring ?? false,
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
      },
    },
  };

  return pieItem;
}

/**
 * Extract prompt from QTI itemBody
 */
function extractPrompt(document: HTMLElement): string | null {
  const itemBody = document.getElementsByTagName('itemBody')[0];
  if (!itemBody) return null;

  const promptElement = itemBody.getElementsByTagName('prompt')[0];
  if (promptElement) {
    return promptElement.innerHTML.trim();
  }

  // If no prompt element, look for content before hottextInteraction
  let promptHtml = '';
  const hottextInteraction = itemBody.getElementsByTagName('hottextInteraction')[0];

  for (const child of itemBody.childNodes) {
    if (child === hottextInteraction) break;

    if (child.nodeType === 3) {
      // Text node
      const text = child.textContent?.trim();
      if (text) promptHtml += text;
    } else if ((child as HTMLElement).tagName) {
      promptHtml += (child as HTMLElement).outerHTML;
    }
  }

  return promptHtml.trim() || null;
}

/**
 * Extract correct answers from responseDeclaration
 */
function extractCorrectAnswers(
  document: HTMLElement,
  responseIdentifier: string
): Set<string> {
  const correctAnswers = new Set<string>();
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  let responseDeclaration: HTMLElement | null = null;
  for (const rd of Array.from(responseDeclarations)) {
    if (rd.getAttribute('identifier') === responseIdentifier) {
      responseDeclaration = rd;
      break;
    }
  }

  if (!responseDeclaration) {
    return correctAnswers;
  }

  const correctResponse = responseDeclaration.getElementsByTagName('correctResponse')[0];
  if (!correctResponse) {
    return correctAnswers;
  }

  const values = correctResponse.getElementsByTagName('value');
  for (const value of Array.from(values)) {
    const text = value.textContent?.trim();
    if (text) {
      correctAnswers.add(text);
    }
  }

  return correctAnswers;
}

/**
 * Extract text content and tokens from hottextInteraction
 * Converts <hottext> elements to plain text and creates token markers
 */
function extractTextAndTokens(
  hottextInteraction: HTMLElement,
  correctAnswers: Set<string>
): { text: string; tokens: Token[] } {
  // Get the inner HTML of the interaction
  let interactionHtml = hottextInteraction.innerHTML;

  // Remove prompt tag if present
  interactionHtml = removePromptTag(interactionHtml);

  // Remove self-closed hottext tags (empty selections)
  interactionHtml = removeSelfClosedHottextTags(interactionHtml);

  // Unescape HTML entities
  interactionHtml = unescapeHtml(interactionHtml);

  // Extract tokens by iterating through hottext tags
  const tokens: Token[] = [];
  let text = interactionHtml;

  // Process each hottext tag
  let startIndex = text.indexOf('<hottext');
  while (startIndex !== -1) {
    // Get identifier
    const idStart = text.indexOf('identifier="', startIndex);
    if (idStart === -1) break;
    const idQuoteStart = idStart + 'identifier="'.length;
    const idQuoteEnd = text.indexOf('"', idQuoteStart);
    const identifier = text.substring(idQuoteStart, idQuoteEnd);

    // Get content
    const contentStart = text.indexOf('>', startIndex) + 1;
    const contentEnd = text.indexOf('</hottext>', contentStart);
    if (contentEnd === -1) break;

    const content = text.substring(contentStart, contentEnd);

    // Create token with current position in text
    tokens.push({
      text: content,
      start: startIndex,
      end: startIndex + content.length,
      correct: correctAnswers.has(identifier),
    });

    // Remove the hottext tags, keeping just the content
    text = text.substring(0, startIndex) + content + text.substring(contentEnd + '</hottext>'.length);

    // Find next hottext tag
    startIndex = text.indexOf('<hottext', startIndex + content.length);
  }

  return {
    text: text.trim(),
    tokens,
  };
}

/**
 * Remove prompt tag from interaction HTML
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

  return (html.substring(0, promptStart) + html.substring(promptEnd)).trim();
}

/**
 * Remove self-closed hottext tags (empty selections)
 */
function removeSelfClosedHottextTags(html: string): string {
  // Match <hottext .../> tags
  const selfClosedRegex = /<hottext[^>]*\/>/gi;
  return html.replace(selfClosedRegex, '');
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
