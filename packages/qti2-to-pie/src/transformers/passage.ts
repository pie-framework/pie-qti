/**
 * QTI Passage transformer
 *
 * Transforms QTI passage/stimulus elements into PIE passage items.
 * Passages provide supporting text, context, or reading material for assessment items.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { createInvalidContentError } from '../utils/qti-errors.js';

export interface PassageOptions {
  /** Whether to show the title */
  titleEnabled?: boolean;
  /** Whether to show the subtitle */
  subtitleEnabled?: boolean;
  /** Whether to show the author */
  authorEnabled?: boolean;
  /** Whether to show the text */
  textEnabled?: boolean;
  /** Whether to show teacher instructions */
  teacherInstructionsEnabled?: boolean;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Passage {
  title: string;
  subtitle?: string;
  author?: string;
  text: string;
  teacherInstructions?: string;
}

/**
 * Transform QTI passage to PIE passage
 */
export function transformPassage(
  qtiXml: string,
  itemId: string,
  options?: PassageOptions
): PieItem {
  const document = parse(qtiXml);

  // Extract passage from various QTI formats
  const passage = extractPassage(document);

  if (!passage) {
    throw createInvalidContentError(
      'passage content',
      'No passage content found in QTI XML. For QTI 2.x input we expect one of: <assessmentPassage>, <assessmentStimulus>, or an inline <stimulus> within an <assessmentItem> with substantial text content.',
      { itemId }
    );
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
          element: '@pie-element/passage',
          passages: [
            {
              title: passage.title,
              subtitle: passage.subtitle || '',
              author: passage.author || '',
              text: passage.text,
              teacherInstructions: passage.teacherInstructions || '',
            },
          ],
          titleEnabled: options?.titleEnabled ?? true,
          subtitleEnabled: options?.subtitleEnabled ?? false,
          authorEnabled: options?.authorEnabled ?? false,
          textEnabled: options?.textEnabled ?? true,
          teacherInstructionsEnabled: options?.teacherInstructionsEnabled ?? false,
        },
      ],
      elements: {
        passage: '@pie-element/passage@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'PASSAGE',
        source: 'qti22',
      },
    },
  };

  return pieItem;
}

/**
 * Extract passage content from QTI XML
 * Supports multiple QTI passage formats
 */
function extractPassage(document: HTMLElement): Passage | null {
  // Try assessmentPassage (QTI 2.x extended format)
  const assessmentPassage = document.getElementsByTagName('assessmentPassage')[0];
  if (assessmentPassage) {
    return extractFromAssessmentPassage(assessmentPassage);
  }

  // Try assessmentStimulus (QTI 2.x)
  const assessmentStimulus = document.getElementsByTagName('assessmentStimulus')[0];
  if (assessmentStimulus) {
    return extractFromAssessmentStimulus(assessmentStimulus);
  }

  // Try assessmentItem with stimulus (embedded in item)
  const assessmentItem = document.getElementsByTagName('assessmentItem')[0];
  if (assessmentItem) {
    const stimulus = extractFromItemStimulus(assessmentItem);
    if (stimulus) {
      return stimulus;
    }
  }

  return null;
}

/**
 * Extract from assessmentPassage element
 */
function extractFromAssessmentPassage(element: HTMLElement): Passage {
  const title = element.getAttribute('title') || 'Passage';

  // Extract from partBody (if present)
  const partBodies = element.getElementsByTagName('partBody');
  let text = '';

  if (partBodies.length > 0) {
    for (const body of Array.from(partBodies)) {
      text += cleanPassageHtml(body.innerHTML.trim());
    }
  } else {
    // Fall back to full inner content
    text = cleanPassageHtml(element.innerHTML.trim());
  }

  return {
    title,
    text,
  };
}

/**
 * Extract from assessmentStimulus element (QTI 2.2)
 */
function extractFromAssessmentStimulus(element: HTMLElement): Passage {
  const title = element.getAttribute('title') || 'Stimulus';

  // Extract from stimulusBody (QTI 2.2 preferred element).
  // Compatibility: some QTI 2.x content uses itemBody here; accept and normalize.
  const stimulusBodies = element.getElementsByTagName('stimulusBody');
  const itemBodies = element.getElementsByTagName('itemBody');
  let text = '';

  if (stimulusBodies.length > 0) {
    text = cleanPassageHtml(stimulusBodies[0].innerHTML.trim());
  } else if (itemBodies.length > 0) {
    // Compatibility: some implementations incorrectly use itemBody
    text = cleanPassageHtml(itemBodies[0].innerHTML.trim());
  } else {
    text = cleanPassageHtml(element.innerHTML.trim());
  }

  return {
    title,
    text,
  };
}

/**
 * Extract stimulus from within an assessmentItem
 */
function extractFromItemStimulus(element: HTMLElement): Passage | null {
  // Look for explicit stimulus element
  const stimulusElements = element.getElementsByTagName('stimulus');
  if (stimulusElements.length > 0) {
    const text = cleanPassageHtml(stimulusElements[0].innerHTML.trim());
    return {
      title: 'Stimulus',
      text,
    };
  }

  // Look for itemBody content that appears to be stimulus
  // (typically content before any interaction)
  const itemBody = element.getElementsByTagName('itemBody')[0];
  if (!itemBody) {
    return null;
  }

  // Check if there's substantial content before any interaction
  const interactions = itemBody.querySelectorAll('[responseIdentifier]');
  if (interactions.length === 0) {
    // No interactions, might be pure passage
    const text = cleanPassageHtml(itemBody.innerHTML.trim());
    if (text.length > 50) {
      // Arbitrary threshold for substantial content
      return {
        title: element.getAttribute('title') || 'Passage',
        text,
      };
    }
  }

  return null;
}

/**
 * Clean passage HTML
 * - Remove CDATA markers
 * - Normalize newlines
 * - Preserve HTML structure
 */
function cleanPassageHtml(html: string): string {
  // Remove CDATA markers
  html = html.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

  // Replace multiple newlines with space (but preserve HTML tags)
  html = html.replace(/\n\s*\n/g, '\n');

  // Trim whitespace
  html = html.trim();

  return html;
}
