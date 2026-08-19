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
  return serializeNodesWithReplacements(root.childNodes, options);
}

export function serializeNodesWithReplacements(
  nodes: Node[],
  options: SerializeHtmlOptions = {}
): string {
  return cleanTransformHtml(nodes.map((child) => serializeNode(child, options)).join(''));
}

/**
 * Narrows a root's direct children to the window strictly between the
 * top-level siblings that contain `boundaryStart` and `boundaryEnd` (both
 * exclusive). Used to scope a composite unit's own markup/prompt extraction
 * to its local neighborhood instead of the whole item body, matching the
 * `promptBoundaryStart` pattern already used for prompt-only extraction.
 * Falls back to the full child list when a boundary can't be resolved to a
 * distinct top-level sibling (e.g. both boundaries land in the same
 * container), since narrowing to an empty/inverted range would be worse than
 * the pre-existing unbounded behavior.
 */
export function resolveNodeWindow(
  root: HTMLElement,
  boundaryStart?: HTMLElement,
  boundaryEnd?: HTMLElement
): Node[] {
  const children = root.childNodes;
  if (!boundaryStart && !boundaryEnd) {
    return children;
  }

  const startIndex = boundaryStart ? topLevelIndexContaining(children, boundaryStart) : -1;
  const endIndex = boundaryEnd ? topLevelIndexContaining(children, boundaryEnd) : -1;
  const from = startIndex >= 0 ? startIndex + 1 : 0;
  const to = endIndex >= 0 ? endIndex : children.length;

  if (from >= to) {
    return children;
  }
  return children.slice(from, to);
}

function topLevelIndexContaining(nodes: Node[], target: HTMLElement): number {
  return nodes.findIndex((child) => {
    const element = child as HTMLElement;
    return Boolean(element.tagName) && elementIsOrContains(element, target);
  });
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
