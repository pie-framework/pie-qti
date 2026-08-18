import type { HTMLElement } from 'node-html-parser';
import { unwrapCdataSections } from './cdata.js';

export interface PromptExtractionOptions {
  after?: HTMLElement;
}

export function extractPromptForInteraction(
  itemBody: HTMLElement,
  interaction: HTMLElement,
  options: PromptExtractionOptions = {}
): string {
  const interactionPrompt = directChildByTagName(interaction, 'prompt');
  if (interactionPrompt) {
    const prompt = cleanTransformHtml(interactionPrompt.innerHTML);
    if (prompt) {
      return prompt;
    }
  }

  return extractItemBodyPromptBeforeInteraction(itemBody, interaction, options);
}

export function extractItemBodyPromptBeforeInteraction(
  itemBody: HTMLElement,
  interaction: HTMLElement,
  options: PromptExtractionOptions = {}
): string {
  return cleanTransformHtml(contentBeforeTarget(itemBody, interaction, options.after));
}

export function containsElement(element: HTMLElement, target: HTMLElement): boolean {
  if (element === target) {
    return true;
  }

  for (const child of element.childNodes) {
    if ((child as HTMLElement).tagName && containsElement(child as HTMLElement, target)) {
      return true;
    }
  }
  return false;
}

function contentBeforeTarget(
  parent: HTMLElement,
  target: HTMLElement,
  startAfter?: HTMLElement
): string {
  let html = '';
  let collecting = !startAfter;
  for (const child of parent.childNodes) {
    if (child === target) {
      break;
    }
    if (child.nodeType === 3) {
      if (!collecting) {
        continue;
      }
      const text = cleanTransformHtml(child.textContent ?? '');
      if (text) {
        html += text;
      }
      continue;
    }
    if (!(child as HTMLElement).tagName) {
      continue;
    }

    const element = child as HTMLElement;
    const tagName = element.tagName?.toLowerCase();
    if (isSkippedPromptContainer(tagName)) {
      continue;
    }

    if (!collecting && startAfter) {
      if (element === startAfter) {
        collecting = true;
        continue;
      }
      if (containsElement(element, startAfter)) {
        if (containsElement(element, target)) {
          const nested = contentBeforeTarget(element, target, startAfter);
          if (nested) {
            html += tagName === 'p' ? nested : wrapWithOriginalElement(element, nested);
          }
          break;
        }
        collecting = true;
      }
      continue;
    }

    if (containsElement(element, target)) {
      const nested = contentBeforeTarget(element, target);
      if (nested) {
        html += tagName === 'p' ? nested : wrapWithOriginalElement(element, nested);
      }
      break;
    }

    const childHtml = tagName === 'p' ? element.innerHTML : element.outerHTML;
    const cleaned = cleanTransformHtml(childHtml);
    if (cleaned) {
      html += cleaned;
    }
  }
  return html;
}

function isSkippedPromptContainer(tagName: string | undefined) {
  return tagName === 'stimulus' || tagName === 'rubricblock' || tagName === 'feedbackblock';
}

function wrapWithOriginalElement(element: HTMLElement, innerHtml: string) {
  const originalInnerHtml = element.innerHTML;
  const outerHtml = element.outerHTML;
  const innerStartsAt = outerHtml.indexOf(originalInnerHtml);
  if (innerStartsAt < 0) {
    return innerHtml;
  }
  return `${outerHtml.slice(0, innerStartsAt)}${innerHtml}${outerHtml.slice(
    innerStartsAt + originalInnerHtml.length
  )}`;
}

function directChildByTagName(element: HTMLElement, tagName: string): HTMLElement | null {
  const normalizedTagName = tagName.toLowerCase();
  for (const child of element.childNodes) {
    const childElement = child as HTMLElement;
    if (childElement.tagName?.toLowerCase() === normalizedTagName) {
      return childElement;
    }
  }
  return null;
}

export function cleanTransformHtml(html: string): string {
  return unwrapCdataSections(html).trim().replace(/\s+/g, ' ').replace(/>\s+</g, '><');
}
