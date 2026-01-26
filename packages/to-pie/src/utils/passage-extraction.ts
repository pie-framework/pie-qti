/**
 * Passage and rubric extraction utilities
 *
 * Extracts inline stimulus and rubric content from QTI items and converts to PIE models
 */

import type { HTMLElement } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { generateStablePassageId, parseObjectReference } from './passage-reusability.js';

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
 * Extract passages from object tags in itemBody
 *
 * QTI Pattern: <object data="passages/passage.xml" type="text/html"/>
 *
 * @param itemBody The itemBody element to search
 * @param _contentLoader Optional function to load external content
 * @returns Array of PassageModel objects and their file paths
 */
export function extractObjectPassages(
  itemBody: HTMLElement,
  _contentLoader?: (filePath: string) => Promise<string> | string
): Array<{ model: PassageModel; filePath: string; passageId: string }> {
  const passages: Array<{ model: PassageModel; filePath: string; passageId: string }> = [];

  // Find all object tags
  const objects = itemBody.getElementsByTagName('object');

  for (const obj of Array.from(objects)) {
    const reference = parseObjectReference(obj);
    if (!reference || !reference.filePath) continue;

    // Extract passage ID from data-pie-passage-id attribute (if present)
    const passageId = obj.getAttribute('data-pie-passage-id') || reference.id;

    // For now, create a placeholder passage
    // In batch mode, content will be loaded and populated
    const modelId = reference.id;

    passages.push({
      model: {
        id: modelId,
        element: '@pie-element/passage',
        passages: [
          {
            title: '',
            text: `[External passage: ${reference.filePath}]`,
          },
        ],
        titleEnabled: false,
        subtitleEnabled: false,
        authorEnabled: false,
        textEnabled: true,
        teacherInstructionsEnabled: false,
      },
      filePath: reference.filePath,
      passageId,
    });

    // Remove the object tag from itemBody (it's now a separate model)
    obj.remove();
  }

  return passages;
}

/**
 * Extract inline stimulus from itemBody and convert to passage model
 *
 * QTI Pattern: <stimulus> element within itemBody, typically before interactions
 *
 * @param itemBody The itemBody element to search
 * @param options Options for extraction
 * @returns PassageModel if stimulus found, null otherwise
 */
export function extractInlineStimulus(
  itemBody: HTMLElement,
  options?: { generateStableId?: boolean }
): PassageModel | null {
  // Look for explicit <stimulus> element
  const stimulusElements = itemBody.getElementsByTagName('stimulus');

  if (stimulusElements.length === 0) {
    return null;
  }

  const stimulus = stimulusElements[0];
  const text = cleanPassageHtml(stimulus.innerHTML.trim());

  if (!text) {
    return null;
  }

  // Generate stable ID based on content if requested
  const modelId = options?.generateStableId
    ? generateStablePassageId({ content: text })
    : uuid();

  return {
    id: modelId,
    element: '@pie-element/passage',
    passages: [
      {
        title: '',
        text,
      },
    ],
    titleEnabled: false,
    subtitleEnabled: false,
    authorEnabled: false,
    textEnabled: true,
    teacherInstructionsEnabled: false,
  };
}

export interface RubricModel {
  id: string;
  element: '@pie-element/rubric';
  rubric: {
    points: string[];
    scales: Array<{
      id: string;
      label: string;
      maxPoints: number;
      scorePointsLabels: string[];
    }>;
  };
}

/**
 * Extract rubricBlock from assessmentItem and convert to rubric model
 *
 * QTI Pattern: <rubricBlock view="scorer"> typically after itemBody
 *
 * @param itemElement The assessmentItem element to search
 * @returns RubricModel if rubricBlock found, null otherwise
 */
export function extractRubricBlock(itemElement: HTMLElement): RubricModel | null {
  // Look for rubricBlock element with view="scorer"
  const rubricBlocks = itemElement.getElementsByTagName('rubricBlock');

  if (rubricBlocks.length === 0) {
    return null;
  }

  // Find scorer rubric block
  const scorerRubric = Array.from(rubricBlocks).find(
    rb => rb.getAttribute('view') === 'scorer'
  );

  if (!scorerRubric) {
    return null;
  }

  const content = cleanPassageHtml(scorerRubric.innerHTML.trim());

  if (!content) {
    return null;
  }

  // Parse rubric content - simple approach for now
  // QTI rubrics are often structured as tables with points and criteria
  // For now, we'll extract as simple text rubric
  const modelId = uuid();

  // Try to extract points from table structure if present
  const points = extractPointsFromRubric(scorerRubric);

  return {
    id: modelId,
    element: '@pie-element/rubric',
    rubric: {
      points: points.length > 0 ? points : ['0', '1', '2', '3'],
      scales: [
        {
          id: uuid(),
          label: 'Score',
          maxPoints: points.length > 0 ? points.length - 1 : 3,
          scorePointsLabels: points.length > 0 ? points : ['0', '1', '2', '3'],
        },
      ],
    },
  };
}

/**
 * Extract point values from rubric table structure
 */
function extractPointsFromRubric(rubricBlock: HTMLElement): string[] {
  const points: string[] = [];

  // Look for table rows with point values
  const tables = rubricBlock.getElementsByTagName('table');
  if (tables.length > 0) {
    const rows = tables[0].getElementsByTagName('tr');
    for (const row of Array.from(rows)) {
      const cells = row.getElementsByTagName('td');
      if (cells.length > 0) {
        const firstCell = cells[0].textContent?.trim();
        // Check if first cell looks like a point value (number)
        if (firstCell && /^\d+$/.test(firstCell)) {
          points.push(firstCell);
        }
      }
    }
  }

  // Sort points numerically
  return points.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

/**
 * Clean passage HTML
 * - Remove CDATA markers
 * - Normalize newlines
 * - Preserve HTML structure
 */
function cleanPassageHtml(html: string): string {
  // Remove CDATA markers
  html = html.replace(/<!\\[CDATA\\[/g, '').replace(/\\]\\]>/g, '');

  // Replace multiple newlines with space (but preserve HTML tags)
  html = html.replace(/\\n\\s*\\n/g, '\\n');

  // Trim whitespace
  html = html.trim();

  return html;
}
