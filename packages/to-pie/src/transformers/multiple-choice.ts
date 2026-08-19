/**
 * Multiple Choice Transformer
 *
 * Transforms QTI choiceInteraction to PIE multiple-choice
 */

import type { PieItem, PieMultipleChoiceModel } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { v4 as uuidv4 } from 'uuid';
import { mapChoiceLayout, type PieChoiceLayout } from '../utils/choice-layout.js';
import { extractInlineStimulus, extractObjectPassages } from '../utils/passage-extraction.js';
import { cleanTransformHtml, extractPromptForInteraction } from '../utils/prompt-extraction.js';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';
import { deriveItemScoring, mappingAnswerKeys } from '../utils/response-scoring.js';

export interface MultipleChoiceOptions {
  /** Overrides the partial scoring derived from the QTI source. */
  partialScoring?: boolean;
  baseId?: string; // Stable/public identifier for round-trip compatibility
  promptBoundaryStart?: HTMLElement;
}

export async function transformMultipleChoice(
  itemElement: HTMLElement,
  itemId: string,
  options: MultipleChoiceOptions = {}
): Promise<PieItem> {
  // Get itemBody
  const itemBody =
    itemElement.querySelector('itemBody') || itemElement.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details:
        'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  // Get interaction
  const choiceInteraction =
    itemBody.querySelector('choiceInteraction') ||
    itemBody.getElementsByTagName('choiceInteraction')[0];

  if (!choiceInteraction) {
    throw createMissingInteractionError('choiceInteraction', {
      itemId,
      details:
        'For multiple-choice questions, use <choiceInteraction> with <simpleChoice> options.',
    });
  }

  return transformMultipleChoiceInteraction(
    itemElement,
    itemBody,
    choiceInteraction,
    itemId,
    options
  );
}

export async function transformMultipleChoiceInteraction(
  itemElement: HTMLElement,
  itemBody: HTMLElement,
  choiceInteraction: HTMLElement,
  itemId: string,
  options: MultipleChoiceOptions = {}
): Promise<PieItem> {
  const uuid = uuidv4();
  const { baseId } = options;

  // Check for inline stimulus (passage content)
  const passageModel = extractInlineStimulus(itemBody);

  // Check for object tag passages (external file references)
  const objectPassages = extractObjectPassages(itemBody);

  // Get response identifier
  const responseId = choiceInteraction.getAttribute('responseIdentifier') || 'RESPONSE';

  // maxChoices tells us the intended cardinality, but it is not trusted on its
  // own — see the choiceMode derivation below.
  const maxChoices = parseInt(choiceInteraction.getAttribute('maxChoices') || '1', 10);

  // Carry the authored choice layout across
  const layout = mapChoiceLayout(choiceInteraction.getAttribute('orientation'));

  // Get shuffle setting
  const shuffle = choiceInteraction.getAttribute('shuffle') === 'true';

  const prompt = extractPromptForInteraction(itemBody, choiceInteraction, {
    after: options.promptBoundaryStart,
  });

  // Get choices
  const simpleChoices = choiceInteraction.getElementsByTagName('simpleChoice');
  const choices = Array.from(simpleChoices).map((choice) => ({
    label: cleanTransformHtml(choice.innerHTML),
    value: choice.getAttribute('identifier') || '',
  }));

  // Get correct response
  const responseDeclaration =
    itemElement.querySelector(`responseDeclaration[identifier="${responseId}"]`) ||
    Array.from(itemElement.getElementsByTagName('responseDeclaration')).find(
      (rd) => rd.getAttribute('identifier') === responseId
    );

  let correctResponse: string[] = [];
  if (responseDeclaration) {
    const correctResponseElement =
      responseDeclaration.querySelector('correctResponse') ||
      responseDeclaration.getElementsByTagName('correctResponse')[0];
    if (correctResponseElement) {
      const values = correctResponseElement.getElementsByTagName('value');
      correctResponse = Array.from(values)
        .map((v) => v.text.trim())
        .filter((v) => v !== '');
    }
  }

  // An item scored via map_response need not declare a correctResponse at all.
  // Fall back to the mapping only when the declared key produced nothing, so a
  // declared key is never overwritten.
  if (correctResponse.length === 0) {
    correctResponse = mappingAnswerKeys(itemElement, responseId);
  }

  // Cardinality is not maxChoices alone: the attribute is frequently missing or
  // wrong, and defaulting it to 1 turns a multi-answer item into a radio group
  // that cannot express its own answer key.
  const choiceMode = maxChoices === 1 && correctResponse.length <= 1 ? 'radio' : 'checkbox';

  const scoring = deriveItemScoring(itemElement);

  // The layout fields are intersected in rather than relied on through
  // `PieModel`'s `[key: string]: any`. The installed `@pie-qti/transform-types`
  // does not declare them yet, so without this the values would be accepted
  // unchecked — a typo like `choicesLayout: 'gird'` would compile and silently
  // produce an item the element cannot lay out. The intersection becomes
  // redundant, not wrong, once the types package catches up.
  const model: PieMultipleChoiceModel & PieChoiceLayout = {
    id: uuid,
    element: '@pie-element/multiple-choice',
    prompt,
    choices: choices.map((choice) => ({
      ...choice,
      correct: correctResponse.includes(choice.value),
    })),
    correctResponse,
    partialScoring: options.partialScoring ?? scoring.partialScoring,
    shuffle,
    choiceMode,
    ...layout,
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
    elements.passage = '@pie-element/passage@latest';
  }

  // Create PIE item
  const pieItem: PieItem = {
    id: itemId,
    ...(baseId && { baseId }), // Include baseId if present
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
        itemType: choiceMode === 'radio' ? 'MC' : 'MCA',
        source: 'qti22',
        ...(scoring.weight !== undefined && { maxScore: scoring.weight }),
      },
    },
  };

  // Populate passage property if external passage was found
  // (External passages are from <object> tags, not inline <stimulus>)
  if (objectPassages.length > 0) {
    // Use first external passage reference
    // Note: Multiple passages not currently supported in PIE passage property
    const firstPassage = objectPassages[0];
    if (firstPassage) {
      pieItem.passage = firstPassage.passageId;
    }
  }

  return pieItem;
}
