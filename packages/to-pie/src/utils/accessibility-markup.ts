/**
 * Accessibility markup
 *
 * The edits that prepare a QTI document's content for conversion, so what QTI voices, hides or
 * suppresses stays so in PIE. Each content root (`itemBody`, `modalFeedback`, `stimulusBody`) is
 * read as a token stream into an element tree, and rebuilt with the edits applied; markup outside
 * the roots, comments and processing instructions are left as authored. CDATA is edited like the
 * markup around it, since the HTML it wraps is what converts.
 *
 * 1. `qti-hidden` and `qti-visually-hidden` get the inline style the class stands for, since the
 *    shared-vocabulary stylesheet has no URL a player can load and players strip `<style>`.
 * 2. `data-qti-suppress-tts` is restated as `data-tts-suppress`, the only spelling PIE reads.
 * 3. An element with `data-ssml` gets a generated `data-catalog-idref`, and the SSML becomes a
 *    `spoken` card under it; an element that already names a catalog adds the card to that one.
 * 4. Each APIP content link docks its access element's idref: on the element whose `id` it names,
 *    or on a span around the word or character range its `textLink` counts. Words are counted
 *    from 1 over the element's text split on whitespace, punctuation kept with its word, as
 *    1EdTech's APIP-to-QTI 3 migration guide counts them; characters from 1 with whitespace runs
 *    collapsed. A range that crosses markup or overlaps another range is not docked.
 * 5. Inline SSML elements are unwrapped with their text kept, and their nearest enclosing element
 *    gets a `spoken` card holding its content as SSML: the shape `SSMLExtractor` in pie-players
 *    produces from a `<speak>` element, so both reach `TTSService` alike.
 *
 * Docking puts the idref on the element's start tag, with two exceptions that wrap the element's
 * content instead: a choice, whose attributes the transformers drop along with its tag, and an
 * element that names a catalog already. An idref that cannot dock is left out, and the
 * accessibility audit reports what it would have carried.
 */

import { type HTMLElement, parse } from 'node-html-parser';

export const HIDING_STYLES = {
  'qti-hidden': 'display:none',
  'qti-visually-hidden':
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0',
} as const;

export const SSML_NAMESPACES: ReadonlySet<string> = new Set([
  'http://www.w3.org/2001/10/synthesis',
  'http://www.w3.org/2010/10/synthesis',
]);

/** A word or character range of an element's text, counted from 1, both ends included. */
export interface TextRange {
  unit: 'word' | 'character';
  start: number;
  stop: number;
}

/** An idref to dock on the content element whose `id` is `target`, or on a range of its text. */
export interface ContentLink {
  idref: string;
  target: string;
  range?: TextRange;
}

export interface PreparedMarkup {
  xml: string;
  /** The `spoken` cards the content's SSML makes, by the idref each docked under. */
  spoken: Array<{ identifier: string; content: string }>;
}

interface Span {
  start: number;
  end: number;
}

interface ContentElement {
  kind: 'element';
  name: string;
  local: string;
  attrs: string;
  attributes: Map<string, string | undefined>;
  /** Written as `<name/>`; a void HTML element without the slash has no close tag either. */
  selfClosing: boolean;
  open: Span;
  close?: Span;
  parent?: ContentElement;
  children: ContentNode[];
  ssml: boolean;
  /** The element's start tag as edited: its authored attributes, then the added ones. */
  editedAttrs: string;
  added: string[];
  /** The idref the element's content renders under: authored, or docked by the preparation. */
  idref?: string;
}

interface ContentText extends Span {
  kind: 'text';
  raw: string;
}

type ContentNode = ContentElement | ContentText;

interface Wrap extends Span {
  tag: 'span' | 'div';
  idref: string;
  seq: number;
}

const GENERATED_IDREF_PREFIX = 'ssml-';
const CONTENT_ROOT_PATTERN =
  /<((?:[\w.-]+:)?(?:itemBody|modalFeedback|stimulusBody))\b[\s\S]*?<\/\1\s*>/g;
const TOKEN_PATTERN =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[|\]\]>|<\/([A-Za-z][\w.:-]*)\s*>|<([A-Za-z][\w.:-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE_PATTERN = /([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const XMLNS_ATTRIBUTE_PATTERN = /\s+xmlns(?::[\w.-]+)?\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/g;
const SSML_PREFIX_PATTERN = /\bxmlns:([\w.-]+)\s*=\s*(["'])(.*?)\2/g;
const IDREF_PATTERN = /\bdata-catalog-idref\s*=\s*(["'])(.*?)\1/g;
const CATALOG_ID_PATTERN = /<(?:[\w.-]+:)?catalog\b[^>]*?\bid\s*=\s*(["'])(.*?)\1/g;
/** One character of text: an entity or character reference counts as the character it names. */
const TEXT_UNIT_PATTERN = /&(?:#\d+|#x[\da-f]+|[a-z][\da-z]*);|[\s\S]/gi;
const XML_WHITESPACE = /^[ \t\r\n]$/;
/** Choices: the transformers read their content and drop their tags. */
const CONTENT_WRAPPED = new Set([
  'simpleChoice',
  'simpleAssociableChoice',
  'inlineChoice',
  'gapText',
]);
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const BLOCK_ELEMENTS = new Set([
  'address',
  'blockquote',
  'div',
  'dl',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'ol',
  'p',
  'pre',
  'table',
  'ul',
]);

/** Apply the accessibility edits to a QTI document's content. */
export function prepareContentMarkup(qtiXml: string, links: ContentLink[] = []): PreparedMarkup {
  const roots = [...qtiXml.matchAll(CONTENT_ROOT_PATTERN)].flatMap((match) => {
    const root = contentTree(match[0], match.index, ssmlPrefixesOf(qtiXml));
    return root ? [root] : [];
  });
  const elements = roots.flatMap(descendants);
  const spoken: PreparedMarkup['spoken'] = [];
  const wraps: Wrap[] = [];
  const taken = new Set([
    ...[...qtiXml.matchAll(IDREF_PATTERN)].map((match) => match[2] as string),
    ...[...qtiXml.matchAll(CATALOG_ID_PATTERN)].map((match) => match[2] as string),
    ...links.map((link) => link.idref),
  ]);
  let generated = 0;
  const nextIdref = (): string => {
    let identifier: string;
    do {
      generated += 1;
      identifier = `${GENERATED_IDREF_PREFIX}${generated}`;
    } while (taken.has(identifier));
    taken.add(identifier);
    return identifier;
  };

  const wrap = (span: Span, idref: string, tag: Wrap['tag']): void => {
    wraps.push({ ...span, tag, idref, seq: wraps.length });
  };
  const dock = (element: ContentElement, idref: string): boolean => {
    if (!element.parent) return false;
    if (CONTENT_WRAPPED.has(element.local) || element.ssml || element.idref !== undefined) {
      if (!element.close) return false;
      const block = element.children.some(
        (child) => child.kind === 'element' && BLOCK_ELEMENTS.has(child.local.toLowerCase())
      );
      wrap({ start: element.open.end, end: element.close.start }, idref, block ? 'div' : 'span');
    } else {
      element.added.push(`data-catalog-idref="${escapeAttribute(idref)}"`);
    }
    element.idref ??= idref;
    return true;
  };

  for (const element of elements) {
    if (element.ssml) continue;
    editStartTag(element);
    const authored = unquote(element.attributes.get('data-catalog-idref')).trim();
    if (authored) {
      if (CONTENT_WRAPPED.has(element.local)) dock(element, authored);
      element.idref = authored;
    }
    if (element.attributes.has('data-ssml')) {
      const content = decodedAttribute(element.attrs, 'data-ssml')?.trim();
      if (content) {
        const identifier = element.idref ?? nextIdref();
        if (element.idref !== undefined || dock(element, identifier)) {
          spoken.push({ identifier, content });
        }
      }
    }
  }

  const ids = new Map<string, ContentElement>();
  for (const element of elements) {
    const id = unquote(element.attributes.get('id')).trim();
    if (id && !ids.has(id)) ids.set(id, element);
  }
  const ranges = new Map<ContentText, Span[]>();
  for (const link of links) {
    const element = ids.get(link.target);
    if (!element) continue;
    if (!link.range) {
      dock(element, link.idref);
      continue;
    }
    const located = locateRange(element, link.range);
    if (!located) continue;
    const docked = ranges.get(located.text) ?? [];
    if (docked.some((span) => crosses(span, located))) continue;
    docked.push(located);
    ranges.set(located.text, docked);
    wrap(located, link.idref, 'span');
  }

  const hosts = new Map<ContentElement, ContentNode[]>();
  for (const element of elements) {
    if (!element.ssml || element.parent?.ssml) continue;
    let host = element.parent;
    while (host?.ssml) host = host.parent;
    // SSML straight inside a content root speaks on its own: a root's tag does not reach PIE.
    if (!host?.parent) hosts.set(element, [element]);
    else hosts.set(host, host.children);
  }
  for (const [host, nodes] of hosts) {
    const markup = nodes.map(ssmlMarkup).join('').replace(/\s+/g, ' ').trim();
    if (!markup) continue;
    const identifier = host.idref ?? nextIdref();
    if (host.idref !== undefined || dock(host, identifier)) {
      spoken.push({ identifier, content: `<speak>${markup}</speak>` });
    }
  }

  return { xml: rendered(qtiXml, elements, wraps), spoken };
}

function contentTree(
  markup: string,
  offset: number,
  ssmlPrefixes: ReadonlySet<string>
): ContentElement | undefined {
  let root: ContentElement | undefined;
  const stack: Array<ContentElement & { defaultSsml: boolean }> = [];
  let cursor = 0;
  const addText = (end: number): void => {
    const parent = stack.at(-1);
    if (parent && end > cursor) {
      parent.children.push({
        kind: 'text',
        start: offset + cursor,
        end: offset + end,
        raw: markup.slice(cursor, end),
      });
    }
  };

  for (const match of markup.matchAll(TOKEN_PATTERN)) {
    addText(match.index);
    cursor = match.index + match[0].length;
    const [, endName, startName, attrs = '', selfClosing] = match;
    if (endName) {
      let at = stack.length - 1;
      while (at >= 0 && stack[at]?.name !== endName) at -= 1;
      if (at === -1) continue;
      const element = stack[at] as ContentElement;
      element.close = { start: offset + match.index, end: offset + cursor };
      stack.length = at;
      continue;
    }
    if (!startName) continue;

    const parent = stack.at(-1);
    if (!parent && root) continue;
    const colon = startName.indexOf(':');
    const prefix = colon === -1 ? undefined : startName.slice(0, colon);
    const local = startName.slice(colon + 1);
    const attributes = new Map(
      [...attrs.matchAll(ATTRIBUTE_PATTERN)].map((attribute) => [
        (attribute[1] as string).toLowerCase(),
        attribute[2],
      ])
    );
    const xmlns = attributes.get('xmlns');
    const defaultSsml =
      xmlns === undefined ? (parent?.defaultSsml ?? false) : SSML_NAMESPACES.has(unquote(xmlns));
    const element = {
      kind: 'element' as const,
      name: startName,
      local,
      attrs,
      attributes,
      selfClosing: Boolean(selfClosing),
      open: { start: offset + match.index, end: offset + cursor },
      ...(parent ? { parent } : {}),
      children: [],
      ssml: prefix === undefined ? defaultSsml : ssmlPrefixes.has(prefix),
      editedAttrs: attrs,
      added: [],
      defaultSsml,
    };
    if (parent) parent.children.push(element);
    else root = element;
    if (!element.selfClosing && !VOID_ELEMENTS.has(local.toLowerCase())) stack.push(element);
  }
  return root;
}

/** Restate hiding classes and read-aloud suppression in the start tag. */
function editStartTag(element: ContentElement): void {
  const { attributes } = element;
  const classes = unquote(attributes.get('class')).split(/\s+/);
  const hiding = Object.entries(HIDING_STYLES)
    .filter(([hidingClass]) => classes.includes(hidingClass))
    .map(([, style]) => style);
  if (hiding.length > 0) {
    const style = attributes.get('style');
    if (style === undefined) {
      element.added.push(`style="${hiding.join(';')}"`);
    } else {
      const quote = style.startsWith("'") ? "'" : '"';
      const current = unquote(style).trim().replace(/;$/, '');
      const merged = [current, ...hiding].filter(Boolean).join(';');
      element.editedAttrs = element.editedAttrs.replace(
        /(\sstyle\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+)/i,
        `$1${quote}${merged}${quote}`
      );
    }
  }

  const suppress = attributes.get('data-qti-suppress-tts');
  if (suppress !== undefined && !attributes.has('data-tts-suppress')) {
    element.added.push(`data-tts-suppress=${quoted(suppress)}`);
  }
}

/**
 * The span of `element`'s text that `range` counts, when it lies inside one text node. Each
 * whitespace run counts as one character, and whitespace before the first word not at all.
 */
function locateRange(
  element: ContentElement,
  range: TextRange
): (Span & { text: ContentText }) | undefined {
  const characters: Array<Span & { text: ContentText; space: boolean }> = [];
  let space: (Span & { text: ContentText }) | undefined;
  for (const text of textsOf(element)) {
    for (const unit of text.raw.matchAll(TEXT_UNIT_PATTERN)) {
      const start = text.start + unit.index;
      const span = { text, start, end: start + unit[0].length };
      if (XML_WHITESPACE.test(unit[0])) {
        if (characters.length > 0) space ??= span;
        continue;
      }
      if (space) characters.push({ ...space, space: true });
      space = undefined;
      characters.push({ ...span, space: false });
    }
  }

  let first = range.start - 1;
  let last = range.stop - 1;
  if (range.unit === 'word') {
    const words: Array<[number, number]> = [];
    characters.forEach((character, index) => {
      if (character.space) return;
      const word = words.at(-1);
      if (word && word[1] === index - 1) word[1] = index;
      else words.push([index, index]);
    });
    first = words[range.start - 1]?.[0] ?? Number.NaN;
    last = words[range.stop - 1]?.[1] ?? Number.NaN;
  }
  const from = characters[first];
  const to = characters[last];
  if (!from || !to || last < first || from.text !== to.text) return undefined;
  return { text: from.text, start: from.start, end: to.end };
}

/** Two ranges that overlap without one holding the other. */
function crosses(a: Span, b: Span): boolean {
  const overlap = a.start < b.end && b.start < a.end;
  const nested = (a.start <= b.start && b.end <= a.end) || (b.start <= a.start && a.end <= b.end);
  return overlap && !nested;
}

/** Content as SSML: its SSML elements without namespace prefixes, other markup reduced to text. */
function ssmlMarkup(node: ContentNode): string {
  if (node.kind === 'text') return escapeText(parse(node.raw).textContent);
  const classes = unquote(node.attributes.get('class')).split(/\s+/);
  if (
    classes.includes('qti-hidden') ||
    node.attributes.has('data-qti-suppress-tts') ||
    node.attributes.has('data-tts-suppress')
  ) {
    return '';
  }
  const content = node.children.map(ssmlMarkup).join('');
  if (!node.ssml) return content;
  const attrs = node.attrs.replace(XMLNS_ATTRIBUTE_PATTERN, '');
  return node.selfClosing
    ? `<${node.local}${attrs}/>`
    : `<${node.local}${attrs}>${content}</${node.local}>`;
}

/** The document with every edited tag replaced and every wrap inserted. */
function rendered(qtiXml: string, elements: ContentElement[], wraps: Wrap[]): string {
  interface Edit extends Span {
    text: string;
    /** Same-position order: closing wraps, then opening ones, then tag replacements. */
    phase: 0 | 1 | 2;
    wrap?: Wrap;
  }
  const edits: Edit[] = [];
  for (const element of elements) {
    if (element.ssml) {
      edits.push({ ...element.open, text: '', phase: 2 });
      if (element.close) edits.push({ ...element.close, text: '', phase: 2 });
    } else if (element.added.length > 0 || element.editedAttrs !== element.attrs) {
      const added = element.added.map((attribute) => ` ${attribute}`).join('');
      const end = element.selfClosing ? ' />' : '>';
      edits.push({
        ...element.open,
        text: `<${element.name}${element.editedAttrs}${added}${end}`,
        phase: 2,
      });
    }
  }
  for (const wrap of wraps) {
    edits.push({
      start: wrap.start,
      end: wrap.start,
      text: `<${wrap.tag} data-catalog-idref="${escapeAttribute(wrap.idref)}">`,
      phase: 1,
      wrap,
    });
    edits.push({ start: wrap.end, end: wrap.end, text: `</${wrap.tag}>`, phase: 0, wrap });
  }
  // Wraps nest: at one position the innermost closes first and the outermost opens first.
  edits.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.phase !== b.phase) return a.phase - b.phase;
    if (!a.wrap || !b.wrap) return 0;
    if (a.phase === 0) return b.wrap.start - a.wrap.start || b.wrap.seq - a.wrap.seq;
    return b.wrap.end - a.wrap.end || a.wrap.seq - b.wrap.seq;
  });

  let xml = '';
  let cursor = 0;
  for (const edit of edits) {
    xml += qtiXml.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return xml + qtiXml.slice(cursor);
}

function descendants(element: ContentElement): ContentElement[] {
  return [
    element,
    ...element.children.flatMap((child) => (child.kind === 'element' ? descendants(child) : [])),
  ];
}

function textsOf(element: ContentElement): ContentText[] {
  return element.children.flatMap((child) => (child.kind === 'text' ? [child] : textsOf(child)));
}

function ssmlPrefixesOf(qtiXml: string): Set<string> {
  const prefixes = new Set(['ssml']);
  for (const match of qtiXml.matchAll(SSML_PREFIX_PATTERN)) {
    if (SSML_NAMESPACES.has(match[3] as string)) prefixes.add(match[1] as string);
  }
  return prefixes;
}

/** An attribute's value with its entities decoded, as the markup's readers see it. */
function decodedAttribute(attrs: string, name: string): string | undefined {
  const element = parse(`<x${attrs}></x>`).firstChild as HTMLElement | null;
  return element?.getAttribute(name);
}

function unquote(value: string | undefined): string {
  if (!value) return '';
  return /^(["']).*\1$/s.test(value) ? value.slice(1, -1) : value;
}

function quoted(value: string): string {
  return /^["']/.test(value) ? value : `"${value}"`;
}

export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
