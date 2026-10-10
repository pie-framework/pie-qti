import type { TransformWarning } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';

const FEEDBACK_ELEMENTS = ['modalFeedback', 'feedbackBlock', 'feedbackInline'] as const;

export interface FeedbackRemoval {
  /** The QTI the built-in transforms read: the input string itself when nothing was removed. */
  xml: string;
  warning?: TransformWarning;
}

/**
 * Removes the QTI feedback that no built-in transform maps onto PIE, and reports it.
 *
 * QTI shows feedback by outcome, and PIE has no outcome to drive it from, so markup carried over
 * into a label or prompt renders unconditionally and can reveal the answer. Removal cuts by source
 * offset, which leaves the rest of the document byte-identical. `assessmentItem` must come from a
 * parse of `qtiXml` itself.
 */
export function removeUnmappedFeedback(
  qtiXml: string,
  assessmentItem: HTMLElement,
  itemId: string,
  interactionTypes: ReadonlySet<string>
): FeedbackRemoval {
  const dropped = FEEDBACK_ELEMENTS.flatMap((name) => descendantsByLocalName(assessmentItem, name)).filter(
    (element) => !isMappedFeedback(element, assessmentItem, interactionTypes)
  );
  if (dropped.length === 0) {
    return { xml: qtiXml };
  }

  const outermost = dropped
    .filter((element) => !dropped.some((other) => other !== element && contains(other, element)))
    .sort((a, b) => b.range[0] - a.range[0]);
  let xml = qtiXml;
  for (const element of outermost) {
    xml = xml.slice(0, element.range[0]) + xml.slice(element.range[1]);
  }

  const counts = FEEDBACK_ELEMENTS.map((name) => {
    const count = dropped.filter((element) => localName(element) === name.toLowerCase()).length;
    return count > 0 ? `${count} ${name}` : '';
  }).filter(Boolean);
  return {
    xml,
    warning: {
      itemId,
      code: 'QTI_FEEDBACK_DROPPED',
      message: `Item ${itemId}: removed QTI feedback that has no PIE equivalent in this transform (${counts.join(', ')}).`,
    },
  };
}

/**
 * Feedback a built-in maps, keyed by the interaction type that selects it: inline-dropdown makes
 * every `feedbackInline` the rationale, EBSR makes each choice's first `feedbackInline` that
 * choice's feedback, and drag-in-the-blank makes the first `modalFeedback` the rationale.
 */
function isMappedFeedback(
  element: HTMLElement,
  assessmentItem: HTMLElement,
  interactionTypes: ReadonlySet<string>
): boolean {
  const name = localName(element);
  if (name === 'feedbackinline') {
    if (interactionTypes.has('inlineChoiceInteraction')) {
      return true;
    }
    if (interactionTypes.has('ebsr')) {
      const choice = closestByLocalName(element, 'simpleChoice');
      return !!choice && descendantsByLocalName(choice, 'feedbackInline')[0] === element;
    }
  }
  if (name === 'modalfeedback' && interactionTypes.has('gapMatchInteraction')) {
    return descendantsByLocalName(assessmentItem, 'modalFeedback')[0] === element;
  }
  return false;
}

function descendantsByLocalName(root: HTMLElement, name: string): HTMLElement[] {
  const target = name.toLowerCase();
  const matches: HTMLElement[] = [];
  const visit = (node: HTMLElement) => {
    for (const child of node.childNodes) {
      const element = child as HTMLElement;
      if (!element.rawTagName) {
        continue;
      }
      if (localName(element) === target) {
        matches.push(element);
      }
      visit(element);
    }
  };
  visit(root);
  return matches;
}

function closestByLocalName(element: HTMLElement, name: string): HTMLElement | null {
  const target = name.toLowerCase();
  let current = element.parentNode as HTMLElement | null;
  while (current?.rawTagName) {
    if (localName(current) === target) {
      return current;
    }
    current = current.parentNode as HTMLElement | null;
  }
  return null;
}

function contains(ancestor: HTMLElement, element: HTMLElement): boolean {
  return ancestor.range[0] <= element.range[0] && element.range[1] <= ancestor.range[1];
}

function localName(element: HTMLElement): string {
  const tagName = element.rawTagName || element.tagName || '';
  return (tagName.split(':').pop() || tagName).toLowerCase();
}
