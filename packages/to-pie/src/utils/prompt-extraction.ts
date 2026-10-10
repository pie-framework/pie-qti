import { type HTMLElement, parse } from 'node-html-parser';
import { unwrapCdataSections } from './cdata.js';

export interface PromptExtractionOptions {
  after?: HTMLElement;
}

/**
 * The interaction's prompt as a learner sees it: the item body content before the interaction (a
 * stem, a figure), followed by the interaction's own `<prompt>`. Markup with nothing to render
 * counts as absent. When both are present, each that is not already block content is wrapped in a
 * `<div>` so the two do not run together.
 */
export function extractPromptForInteraction(
  itemBody: HTMLElement,
  interaction: HTMLElement,
  options: PromptExtractionOptions = {}
): string {
  const interactionPrompt = directChildByTagName(interaction, 'prompt');
  const prompt = interactionPrompt ? cleanTransformHtml(interactionPrompt.innerHTML) : '';
  const lead = cleanTransformHtml(contentBeforeTarget(itemBody, interaction, options.after));
  const hasPrompt = hasRenderableContent(prompt);
  if (!hasRenderableContent(lead)) {
    return hasPrompt ? prompt : '';
  }
  if (!hasPrompt) {
    return unwrapSoleParagraph(lead);
  }
  return [lead, prompt].map((part) => (isBlockContent(part) ? part : `<div>${part}</div>`)).join('');
}

const MEDIA_TAGS = ['img', 'object', 'embed', 'math', 'svg', 'video', 'audio', 'iframe', 'table', 'canvas'];

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figure', 'footer',
  'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'ol', 'p', 'pre', 'section', 'table', 'ul',
]);

function hasRenderableContent(html: string): boolean {
  const root = parse(html);
  if (root.text.replace(/[\s\u00a0]/g, '')) {
    return true;
  }
  return MEDIA_TAGS.some((tag) => root.getElementsByTagName(tag).length > 0);
}

function isBlockContent(html: string): boolean {
  const nodes = topLevelNodes(html);
  return nodes.length > 0 && nodes.every((node) => BLOCK_TAGS.has(tagNameOf(node)));
}

/** Keeps the inline form a single-paragraph stem has always been stored in. */
function unwrapSoleParagraph(html: string): string {
  const nodes = topLevelNodes(html);
  return nodes.length === 1 && tagNameOf(nodes[0]) === 'p'
    ? cleanTransformHtml((nodes[0] as HTMLElement).innerHTML)
    : html;
}

function topLevelNodes(html: string) {
  return parse(html).childNodes.filter((node) => node.nodeType !== 3 || node.textContent.trim() !== '');
}

function tagNameOf(node: unknown): string {
  return ((node as HTMLElement).tagName ?? '').toLowerCase();
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

    const cleaned = cleanTransformHtml(element.outerHTML);
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
