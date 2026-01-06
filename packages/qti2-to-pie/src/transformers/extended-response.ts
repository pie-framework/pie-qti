/**
 * Extended Response Transformer
 *
 * Transforms QTI extendedTextInteraction to PIE extended-text-entry
 */

import type { PieExtendedTextModel, PieItem } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { v4 as uuidv4 } from 'uuid';
import { extractInlineStimulus, extractObjectPassages, extractRubricBlock } from '../utils/passage-extraction.js';
import { createMissingInteractionError } from '../utils/qti-errors.js';

export interface ExtendedResponseOptions {
  maxScore?: number;
  equationEditor?: string;
  baseId?: string;  // Stable/public identifier for round-trip compatibility
}

export async function transformExtendedResponse(
  itemElement: HTMLElement,
  itemId: string,
  options: ExtendedResponseOptions = {}
): Promise<PieItem> {
  const uuid = uuidv4();
  const { baseId } = options;

  // Get interaction
  const extendedTextInteraction = itemElement.querySelector('extendedTextInteraction') ||
                                  itemElement.getElementsByTagName('extendedTextInteraction')[0];

  if (!extendedTextInteraction) {
    throw createMissingInteractionError('extendedTextInteraction', {
      itemId,
      details: 'For essay/extended response questions, use <extendedTextInteraction> with expectedLines attribute.',
    });
  }

  // Get response identifier
  const responseId = extendedTextInteraction.getAttribute('responseIdentifier') || 'RESPONSE';

  // Get itemBody
  const itemBody = itemElement.querySelector('itemBody') ||
                  itemElement.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw new Error(`No itemBody found in item ${itemId}`);
  }

  // Check for inline stimulus (passage content)
  const passageModel = extractInlineStimulus(itemBody);

  // Check for object tag passages (external file references)
  const objectPassages = extractObjectPassages(itemBody);

  // Check for rubric block (scoring guide)
  const rubricModel = extractRubricBlock(itemElement);

  // Get prompt/stem from itemBody > p (main question) or prompt element (within interaction)
  // Priority: itemBody > p first, then fallback to prompt within interaction
  let promptElement = itemBody.querySelector('p') ||
                     itemBody.getElementsByTagName('p')[0];

  // If no p element in itemBody, check for prompt within the interaction
  if (!promptElement || !promptElement.innerHTML.trim()) {
    promptElement = extendedTextInteraction.querySelector('prompt') ||
                   extendedTextInteraction.getElementsByTagName('prompt')[0];
  }

  const prompt = promptElement ? cleanHtml(promptElement.innerHTML) : '';

  // Get expectedLines for height calculation
  const expectedLines = parseInt(extendedTextInteraction.getAttribute('expectedLines') || '0', 10);
  const height = expectedLines > 0 ? `${Math.max(expectedLines * 20, 100)}px` : '200px';

  // Get maxStrings/expectedLength for character limit
  const expectedLength = parseInt(extendedTextInteraction.getAttribute('expectedLength') || '0', 10);
  const maxLength = expectedLength > 0 ? expectedLength : undefined;

  // Determine if this is a math response (formula entry)
  // Check if responseDeclaration baseType is string (ER) or float/integer (FE)
  const responseDeclaration = itemElement.querySelector(`responseDeclaration[identifier="${responseId}"]`) ||
                             Array.from(itemElement.getElementsByTagName('responseDeclaration'))
                               .find(rd => rd.getAttribute('identifier') === responseId);

  let mathInput = false;
  if (responseDeclaration) {
    const baseType = responseDeclaration.getAttribute('baseType');
    mathInput = baseType === 'float' || baseType === 'integer';
  }

  // Create PIE model
  const model: PieExtendedTextModel = {
    id: uuid,
    element: '@pie-element/extended-text-entry',
    prompt,
    height,
    width: '500px',
    mathInput,
    expectedLines: expectedLines > 0 ? expectedLines : undefined,
    maxLength,
    equationEditor: options.equationEditor || (mathInput ? 'everything' : undefined),
    customKeys: [],
    teacherInstructions: '',
    rationale: '',
  };

  // Get title from assessmentItem
  const title = itemElement.getAttribute('title') || '';

  // Determine item type (ER = Extended Response, FE = Formula Entry)
  const itemType = mathInput ? 'FE' : 'ER';

  // Build models array - include passage and rubric models if present
  const models = [];

  // Add inline stimulus passage
  if (passageModel) {
    models.push(passageModel);
  }

  // Add object tag passages
  for (const objPassage of objectPassages) {
    models.push(objPassage.model);
  }

  models.push(model);

  if (rubricModel) {
    models.push(rubricModel);
  }

  // Build elements object
  const elements: Record<string, string> = {
    'extended-text-entry': '@pie-element/extended-text-entry@latest',
  };
  if (passageModel || objectPassages.length > 0) {
    elements['passage'] = '@pie-element/passage@latest';
  }
  if (rubricModel) {
    elements['rubric'] = '@pie-element/rubric@latest';
  }

  // Create PIE item
  const pieItem: PieItem = {
    id: itemId,
    ...(baseId && { baseId }),  // Include baseId if present
    uuid,
    config: {
      id: uuid,
      models,
      elements,
    },
    metadata: {
      // Renaissance-specific search metadata
      searchMetaData: {
        title,
        itemType,
        source: 'qti22',
        maxScore: options.maxScore,
      },
    },
  };

  // Populate passage property if external passage was found
  // (External passages are from <object> tags, not inline <stimulus>)
  if (objectPassages.length > 0) {
    // Use first external passage reference
    // Note: Multiple passages not currently supported in PIE passage property
    pieItem.passage = objectPassages[0].passageId;
  }

  return pieItem;
}

/**
 * Clean HTML content - remove extra whitespace, trim
 */
function cleanHtml(html: string): string {
  return html
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><');
}
