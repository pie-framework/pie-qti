/**
 * XHTML normalization
 *
 * PIE content is HTML; an item body is XML in the QTI namespace. Every body is re-serialized as
 * XML before it is written: entities are decoded and the text re-escaped, so `&nbsp;` becomes the
 * character; childless elements are self-closed, so `<br>` no longer swallows what follows;
 * all-uppercase HTML tags are lowercased; `img` gains the `alt` the schema requires; and `u`, `s`
 * and `strike`, absent from QTI's XHTML profile, become styled spans. The function is idempotent.
 */

import { CommentNode, HTMLElement, type Node, parse, TextNode } from 'node-html-parser';

const TEXT_DECORATION: Record<string, string> = {
  u: 'underline',
  s: 'line-through',
  strike: 'line-through',
};

export function toQtiXhtml(html: string): string {
  const root = parse(html, {
    lowerCaseTagName: false,
    comment: true,
    blockTextElements: { script: true, style: true },
  });
  return root.childNodes.map(serialize).join('');
}

/**
 * Normalize the content of every `itemBody` in a document.
 */
export function normalizeItemBody(qtiXml: string): string {
  return qtiXml.replace(
    /(<itemBody\b[^>]*>)([\s\S]*?)(<\/itemBody>)/,
    (_, open: string, body: string, close: string) => `${open}${toQtiXhtml(body)}${close}`
  );
}

function serialize(node: Node): string {
  if (node instanceof TextNode) {
    return escapeText(node.text);
  }
  if (node instanceof CommentNode) {
    return `<!--${node.rawText.replaceAll('--', '- -')}-->`;
  }
  if (!(node instanceof HTMLElement)) {
    return '';
  }

  let tag = /^[A-Z][A-Z0-9]*$/.test(node.rawTagName) ? node.rawTagName.toLowerCase() : node.rawTagName;
  const attributes = { ...node.attributes };
  const decoration = TEXT_DECORATION[tag];
  if (decoration) {
    tag = 'span';
    const style = attributes.style?.trim().replace(/;?$/, '; ') ?? '';
    attributes.style = `${style}text-decoration: ${decoration};`;
  }
  if (tag === 'img' && attributes.alt === undefined) {
    attributes.alt = '';
  }

  const attrs = Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
  const children = node.childNodes.map(serialize).join('');
  return children ? `<${tag}${attrs}>${children}</${tag}>` : `<${tag}${attrs}/>`;
}

function escapeText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}
