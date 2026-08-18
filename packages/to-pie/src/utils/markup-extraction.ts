import type { HTMLElement, Node } from 'node-html-parser';
import { cleanTransformHtml, containsElement } from './prompt-extraction.js';

export interface SerializeHtmlOptions {
  replacements?: Map<HTMLElement, string>;
  omit?: (element: HTMLElement) => boolean;
}

export function serializeChildrenWithReplacements(
  root: HTMLElement,
  options: SerializeHtmlOptions = {}
): string {
  return cleanTransformHtml(root.childNodes.map((child) => serializeNode(child, options)).join(''));
}

function serializeNode(node: Node, options: SerializeHtmlOptions): string {
  if (node.nodeType === 3) {
    return String(node);
  }

  const element = node as HTMLElement;
  if (!element.tagName) {
    return String(node);
  }

  const replacement = options.replacements?.get(element);
  if (replacement !== undefined) {
    return replacement;
  }

  if (options.omit?.(element)) {
    return '';
  }

  if (!containsReplacementOrOmittedElement(element, options)) {
    return element.outerHTML;
  }

  return wrapWithOriginalElement(
    element,
    element.childNodes.map((child) => serializeNode(child, options)).join('')
  );
}

function containsReplacementOrOmittedElement(
  element: HTMLElement,
  options: SerializeHtmlOptions
): boolean {
  for (const child of element.childNodes) {
    const childElement = child as HTMLElement;
    if (!childElement.tagName) {
      continue;
    }
    if (options.replacements?.has(childElement) || options.omit?.(childElement)) {
      return true;
    }
    if (containsReplacementOrOmittedElement(childElement, options)) {
      return true;
    }
  }
  return false;
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

export function elementIsOrContains(element: HTMLElement, target: HTMLElement): boolean {
  return element === target || containsElement(element, target);
}
