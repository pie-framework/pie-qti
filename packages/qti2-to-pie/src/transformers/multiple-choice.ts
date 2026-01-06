/**
 * Multiple Choice Transformer
 *
 * Transforms QTI choiceInteraction to PIE multiple-choice
 */

import type { PieItem, PieMultipleChoiceModel } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { v4 as uuidv4 } from 'uuid';
import { extractInlineStimulus, extractObjectPassages } from '../utils/passage-extraction.js';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

export interface MultipleChoiceOptions {
  partialScoring?: boolean;
  baseId?: string;  // Stable/public identifier for round-trip compatibility
}

export async function transformMultipleChoice(
  itemElement: HTMLElement,
  itemId: string,
  options: MultipleChoiceOptions = {}
): Promise<PieItem> {
  const uuid = uuidv4();
  const { baseId } = options;

  // Get itemBody
  const itemBody = itemElement.querySelector('itemBody') ||
                   itemElement.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  // Get interaction
  const choiceInteraction = itemBody.querySelector('choiceInteraction') ||
                           itemBody.getElementsByTagName('choiceInteraction')[0];

  if (!choiceInteraction) {
    throw createMissingInteractionError('choiceInteraction', {
      itemId,
      details: 'For multiple-choice questions, use <choiceInteraction> with <simpleChoice> options.',
    });
  }

  // Check for inline stimulus (passage content)
  const passageModel = extractInlineStimulus(itemBody);

  // Check for object tag passages (external file references)
  const objectPassages = extractObjectPassages(itemBody);

  // Get response identifier
  const responseId = choiceInteraction.getAttribute('responseIdentifier') || 'RESPONSE';

  // Get maxChoices to determine if single or multiple select
  const maxChoices = parseInt(choiceInteraction.getAttribute('maxChoices') || '1', 10);
  const choiceMode = maxChoices === 1 ? 'radio' : 'checkbox';

  // Get shuffle setting
  const shuffle = choiceInteraction.getAttribute('shuffle') === 'true';

  // Get prompt/stem - skip any content inside <stimulus> tags
  let promptElement = null;
  const allParagraphs = itemBody.getElementsByTagName('p');
  for (const p of Array.from(allParagraphs)) {
    // Check if this paragraph is inside a stimulus element
    let parent = p.parentNode;
    let insideStimulus = false;
    while (parent) {
      if (parent.rawTagName === 'stimulus') {
        insideStimulus = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (!insideStimulus) {
      promptElement = p;
      break;
    }
  }
  const prompt = promptElement ? cleanHtml(promptElement.innerHTML) : '';

  // Get choices
  const simpleChoices = choiceInteraction.getElementsByTagName('simpleChoice');
  const choices = Array.from(simpleChoices).map((choice) => ({
    label: cleanHtml(choice.innerHTML),
    value: choice.getAttribute('identifier') || '',
  }));

  // Get correct response
  const responseDeclaration = itemElement.querySelector(`responseDeclaration[identifier="${responseId}"]`) ||
                             Array.from(itemElement.getElementsByTagName('responseDeclaration'))
                               .find(rd => rd.getAttribute('identifier') === responseId);

  let correctResponse: string[] = [];
  if (responseDeclaration) {
    const correctResponseElement = responseDeclaration.querySelector('correctResponse') ||
                                   responseDeclaration.getElementsByTagName('correctResponse')[0];
    if (correctResponseElement) {
      const values = correctResponseElement.getElementsByTagName('value');
      correctResponse = Array.from(values).map(v => v.text.trim());
    }
  }

  // Create PIE model
  const model: PieMultipleChoiceModel = {
    id: uuid,
    element: '@pie-element/multiple-choice',
    prompt,
    choices: choices.map(choice => ({
      ...choice,
      correct: correctResponse.includes(choice.value),
    })),
    correctResponse,
    partialScoring: options.partialScoring || false,
    shuffle,
    choiceMode,
  };

  // Get title from assessmentItem
  const title = itemElement.getAttribute('title') || '';

  // Build models array - include passage models
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

  // Build elements object
  const elements: Record<string, string> = {
    'multiple-choice': '@pie-element/multiple-choice@latest',
  };
  if (passageModel || objectPassages.length > 0) {
    elements['passage'] = '@pie-element/passage@latest';
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
        itemType: maxChoices === 1 ? 'MC' : 'MCA',
        source: 'qti22',
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
