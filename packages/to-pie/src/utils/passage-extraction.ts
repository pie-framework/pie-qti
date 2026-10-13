/**
 * Passage and rubric extraction utilities
 *
 * The PIE passage model and the scorer rubric read from a QTI item. Passages leave the item body
 * through the item body partition.
 */

import type { HTMLElement } from 'node-html-parser';
import { unwrapCdataSections } from './cdata.js';

export interface PassageModel {
  id: string;
  element: '@pie-element/passage';
  passages: Array<{
    title: string;
    subtitle?: string;
    author?: string;
    text: string;
    teacherInstructions?: string;
  }>;
  titleEnabled: boolean;
  subtitleEnabled: boolean;
  authorEnabled: boolean;
  textEnabled: boolean;
  teacherInstructionsEnabled: boolean;
}

/**
 * The item's scorer guidance: the content of every rubricBlock whose `view` list names `scorer`.
 * A block the candidate also sees is item content and stays out. A block whose content another
 * block already holds is dropped, so guidance copied into a second block appears once.
 */
export function extractScorerRubric(itemElement: HTMLElement): string {
  const selected = Array.from(itemElement.getElementsByTagName('rubricBlock'))
    .filter((rubricBlock) => {
      const views = (rubricBlock.getAttribute('view') ?? '').trim().split(/\s+/);
      return views.includes('scorer') && !views.includes('candidate');
    })
    .map((rubricBlock) => cleanPassageHtml(rubricBlock.innerHTML))
    .filter(Boolean);
  const blocks = selected.filter(
    (block, index) =>
      !selected.some((other, otherIndex) =>
        other === block ? otherIndex < index : other.includes(block)
      )
  );
  return blocks.length > 1
    ? blocks.map((block) => `<div>${block}</div>`).join('')
    : (blocks[0] ?? '');
}

/**
 * Clean passage HTML
 * - Remove CDATA markers
 * - Normalize newlines
 * - Preserve HTML structure
 */
export function cleanPassageHtml(html: string): string {
  // Remove CDATA markers
  html = unwrapCdataSections(html);

  // Replace multiple newlines with space (but preserve HTML tags)
  html = html.replace(/\n\s*\n/g, '\n');

  // Trim whitespace
  html = html.trim();

  return html;
}
