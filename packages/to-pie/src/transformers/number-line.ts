import type { PieItem, PieModel } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { extractPromptForInteraction } from '../utils/prompt-extraction.js';
import { createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

export function transformNumberLine(qtiXml: string, itemId: string): PieItem {
  const document = parse(qtiXml, {
    lowerCaseTagName: false,
    comment: false,
  });
  const assessmentItem = document.getElementsByTagName('assessmentItem')[0];
  const itemBody = document.getElementsByTagName('itemBody')[0];
  if (!assessmentItem || !itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'sliderInteraction conversion requires an assessmentItem with itemBody.',
    });
  }

  const slider = itemBody.getElementsByTagName('sliderInteraction')[0];
  if (!slider) {
    throw createMissingInteractionError('sliderInteraction', {
      itemId,
      details: 'Number-line conversion requires a QTI sliderInteraction.',
    });
  }

  return transformNumberLineInteraction(assessmentItem, itemBody, slider, itemId);
}

export function transformNumberLineInteraction(
  assessmentItem: HTMLElement,
  itemBody: HTMLElement,
  slider: HTMLElement,
  itemId: string,
  promptBoundaryStart?: HTMLElement
): PieItem {
  const responseIdentifier = slider.getAttribute('responseIdentifier') || 'RESPONSE';
  const modelId = uuid();
  const model: PieModel & Record<string, unknown> = {
    id: modelId,
    element: '@pie-element/number-line',
    prompt: extractPromptForInteraction(itemBody, slider, { after: promptBoundaryStart }),
    min: numberAttribute(slider, 'lowerBound', 0),
    max: numberAttribute(slider, 'upperBound', 100),
    interval: numberAttribute(slider, 'step', 1),
    responseIdentifier,
  };
  const correctResponse = numericCorrectResponse(assessmentItem, responseIdentifier);
  if (correctResponse !== undefined) {
    model.correctResponse = correctResponse;
  }
  if (slider.getAttribute('stepLabel') != null) {
    model.stepLabel = slider.getAttribute('stepLabel') === 'true';
  }
  const orientation = slider.getAttribute('orientation');
  if (orientation) {
    model.orientation = orientation;
  }
  if (slider.getAttribute('reverse') != null) {
    model.reverse = slider.getAttribute('reverse') === 'true';
  }

  return {
    id: itemId,
    uuid: modelId,
    config: {
      id: modelId,
      models: [model],
      elements: {
        'number-line': '@pie-element/number-line@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: assessmentItem.getAttribute('title') || itemId,
        itemType: 'number-line',
        source: 'qti22',
      },
    },
  };
}

function numberAttribute(element: HTMLElement, name: string, fallback: number) {
  const parsed = Number(element.getAttribute(name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numericCorrectResponse(assessmentItem: HTMLElement, responseIdentifier: string) {
  const responseDeclaration = assessmentItem
    .getElementsByTagName('responseDeclaration')
    .find((declaration) => declaration.getAttribute('identifier') === responseIdentifier);
  const value = responseDeclaration?.getElementsByTagName('value')[0]?.text.trim();
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
