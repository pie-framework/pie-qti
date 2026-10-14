/**
 * QTI 3.0 → QTI 2.2 normalization
 *
 * Every transformer reads the QTI 2.x vocabulary, so a QTI 3.0 document is renamed into it at the
 * entry point: the namespace, `qti-*` element names, and each kebab-case attribute the QTI 2.x
 * schemas spell in camelCase. `qti-content-body`, which QTI 3.0 wraps rubric block content in
 * and QTI 2.2 does not have, is unwrapped. Two structural repairs follow for prompts QTI 2.2 does
 * not admit where QTI 3.0 content puts them.
 *
 * The rename is a generic kebab-to-camel mapping that covers every well-formed `qti-*` tag, so no
 * allow-list of element names has to track what content uses. The constructs it cannot carry are
 * named in `UNSUPPORTED_QTI3_CONSTRUCTS` instead.
 */

import {
  QTI2_PROMPT_BEARING_INTERACTIONS,
  QTI3_ATTRIBUTE_TO_QTI2,
} from '@pie-qti/qti-common/element-mapper';
import { qtiDocumentRootName } from './qti-validator.js';

const QTI3_NAMESPACE_PATTERN = /http:\/\/www\.imsglobal\.org\/xsd\/imsqtiasi_v3p0/g;
const CANONICAL_QTI_NAMESPACE = 'http://www.imsglobal.org/xsd/imsqti_v2p2';

export interface UnsupportedQti3Construct {
  construct: string;
  message: string;
}

/**
 * QTI 3.0 constructs the rename would carry into markup nothing renders. A portable custom
 * interaction is absent here: it normalizes to `portableCustomInteraction`, which the custom
 * interaction rejection reports with its module evidence.
 */
const UNSUPPORTED_QTI3_CONSTRUCTS = [
  {
    pattern: /<\s*(?:[\w.-]+:)?qti-accessibility\b/i,
    construct: 'qti-accessibility',
    message:
      'qti-accessibility is not converted: no QTI 3.0 content seen so far uses it, so its meaning is unverified.',
  },
];

/** Whether the document's root element is a QTI 3.0 `qti-*` element. */
export function isQti3Document(xml: string): boolean {
  return qtiDocumentRootName(xml)?.startsWith('qti-') ?? false;
}

/**
 * The first QTI 3.0 construct in the document that normalization cannot carry, or `undefined`.
 * Checks the authored document for the named constructs and the normalized one for `qti-*`
 * markup the rename left behind.
 */
export function unsupportedQti3Construct(
  authoredXml: string,
  normalizedXml: string
): UnsupportedQti3Construct | undefined {
  const named = UNSUPPORTED_QTI3_CONSTRUCTS.find((entry) => entry.pattern.test(authoredXml));
  if (named) return { construct: named.construct, message: named.message };
  const leftover = /<\s*\/?\s*(?:[\w.-]+:)?(qti-[\w.-]*)/i.exec(normalizedXml);
  return leftover
    ? {
        construct: leftover[1] as string,
        message: `${leftover[1]} has no QTI 2.2 name normalization can give it.`,
      }
    : undefined;
}

/**
 * Exactly the attribute names QTI 2.x spells in camelCase, generated from the vendored schemas.
 * `aria-*`, `data-*`, `xml:lang` and HTML attributes are kebab-case or unprefixed in QTI 2.x as
 * well, so a blanket kebab-to-camel rewrite would corrupt them.
 */
const QTI3_ATTRIBUTE_PATTERN = new RegExp(
  `(\\s)(${[...QTI3_ATTRIBUTE_TO_QTI2.keys()].join('|')})(\\s*=)`,
  'gi'
);

/** A `qti-content-body` start, end or empty tag. */
const QTI3_CONTENT_BODY_TAG = /<\s*\/?\s*(?:[\w.-]+:)?qti-content-body\b[^>]*>/gi;

/** The namespace, the `qti-*` element names and every kebab-case QTI attribute. */
export function normalizeQti3Lexically(xml: string): string {
  return xml
    .replace(QTI3_NAMESPACE_PATTERN, CANONICAL_QTI_NAMESPACE)
    .replace(QTI3_CONTENT_BODY_TAG, '')
    .replace(/<\s*(\/?)\s*(?:[\w.-]+:)?qti-([a-z][\w.-]*)/gi, (_match, slash, name) => {
      return `<${slash}${camelCaseQtiName(name)}`;
    })
    .replace(QTI3_ATTRIBUTE_PATTERN, (match, leading: string, name: string, eq: string) => {
      const camel = QTI3_ATTRIBUTE_TO_QTI2.get(name.toLowerCase());
      return camel ? `${leading}${camel}${eq}` : match;
    });
}

/** `<itemBody …>` with a `prompt` as its first child; `</prompt >` is legal XML. */
const PROMPT_FIRST_IN_ITEM_BODY = /(<itemBody\b[^>]*>)(\s*)(<prompt\b[^>]*>[\s\S]*?<\/prompt\s*>)/i;

/**
 * Move a `prompt` that sits directly inside `itemBody` into the interaction it introduces.
 *
 * This repairs non-conformant source: QTI 3.0 admits `qti-prompt` in the same places QTI 2.2
 * admits `prompt`, inside an interaction, so a prompt under the item body is invalid in both.
 * The move applies only where it is unambiguous:
 *
 * - the prompt is the first element child of `itemBody`, so it is the stem of what follows;
 * - the item holds exactly one interaction, since with two a body-level prompt is a shared stem
 *   and moving it into either changes its meaning;
 * - that interaction's content model admits a prompt, which excludes the inline interactions.
 *
 * Otherwise the document is returned unchanged and `demoteMisplacedQti3Prompts` handles the
 * prompt. Moved, the prompt converts as the interaction's PIE prompt without its `<prompt>` tag.
 */
export function relocateQti3PromptIntoInteraction(xml: string): string {
  const promptMatch = PROMPT_FIRST_IN_ITEM_BODY.exec(xml);
  if (!promptMatch) {
    return xml;
  }
  const prompt = promptMatch[3] as string;
  const withoutPrompt = xml.replace(PROMPT_FIRST_IN_ITEM_BODY, '$1');

  // Only interactions, and only outside the prompt just lifted.
  const interactions = [
    ...withoutPrompt.matchAll(/<([A-Za-z][\w.]*[iI]nteraction)\b[^>]*?(\/?)>/g),
  ];
  if (interactions.length !== 1) {
    return xml;
  }
  const [interaction] = interactions;
  if (!interaction) {
    return xml;
  }
  const tagName = interaction[1] as string;
  const selfClosing = interaction[2] === '/';
  if (selfClosing || !QTI2_PROMPT_BEARING_INTERACTIONS.has(tagName)) {
    return xml;
  }

  const insertAt = (interaction.index ?? 0) + interaction[0].length;
  return withoutPrompt.slice(0, insertAt) + prompt + withoutPrompt.slice(insertAt);
}

/** Spans of CDATA, which hold HTML and are not scanned as QTI markup. */
function cdataSpans(xml: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const match of xml.matchAll(/<!\[CDATA\[[\s\S]*?\]\]>/g)) {
    spans.push([match.index, match.index + match[0].length]);
  }
  return spans;
}

const TAG_PATTERN = /<(\/?)([A-Za-z][\w.:-]*)\b[^>]*?(\/?)>/g;

/**
 * Rewrite each `prompt` outside an interaction as a `<div class="qti-prompt">`, in place.
 *
 * These are the prompts relocation declines, typically nested in `qti-layout-*` columns, where
 * moving them would restructure the layout. The converter passes such a prompt through as body
 * markup, so the output differs only in the tag: a `div` with the shared-vocabulary class is
 * valid HTML, where `<prompt>` reaches the player as an unknown element.
 */
export function demoteMisplacedQti3Prompts(xml: string): string {
  const cdata = cdataSpans(xml);
  const inCdata = (index: number) => cdata.some(([start, end]) => index >= start && index < end);

  let interactionDepth = 0;
  const promptRanges: Array<{
    openStart: number;
    openEnd: number;
    closeStart: number;
    closeEnd: number;
  }> = [];
  let pendingOpen: { openStart: number; openEnd: number } | null = null;

  TAG_PATTERN.lastIndex = 0;
  for (let match = TAG_PATTERN.exec(xml); match; match = TAG_PATTERN.exec(xml)) {
    if (inCdata(match.index)) {
      continue;
    }
    const isClose = match[1] === '/';
    const name = match[2] as string;
    const selfClosing = match[3] === '/';

    // Any interaction: a prompt inside an inline one is invalid, but its transformer reads it.
    if (name.endsWith('Interaction')) {
      if (isClose) {
        interactionDepth = Math.max(0, interactionDepth - 1);
      } else if (!selfClosing) {
        interactionDepth += 1;
      }
      continue;
    }
    if (name !== 'prompt' || interactionDepth > 0) {
      continue;
    }
    if (selfClosing && !isClose) {
      // `<prompt/>` is empty but equally misplaced: the one tag is both ends.
      promptRanges.push({
        openStart: match.index,
        openEnd: match.index + match[0].length,
        closeStart: match.index + match[0].length,
        closeEnd: match.index + match[0].length,
      });
    } else if (!isClose) {
      pendingOpen = { openStart: match.index, openEnd: match.index + match[0].length };
    } else if (pendingOpen) {
      // The close tag's own extent, since `</prompt >` is legal XML.
      promptRanges.push({
        ...pendingOpen,
        closeStart: match.index,
        closeEnd: match.index + match[0].length,
      });
      pendingOpen = null;
    }
  }

  if (promptRanges.length === 0) {
    return xml;
  }

  // Back to front, so earlier offsets stay valid.
  let result = xml;
  for (const range of promptRanges.reverse()) {
    result =
      result.slice(0, range.openStart) +
      '<div class="qti-prompt">' +
      result.slice(range.openEnd, range.closeStart) +
      '</div>' +
      result.slice(range.closeEnd);
  }
  return result;
}

/**
 * The lexical renames, then prompt relocation into a sole interaction, then in-place demotion of
 * the prompts relocation declines. Relocation runs first because a prompt inside its interaction
 * converts as the PIE prompt.
 */
export function normalizeQti3ToQti2(xml: string): string {
  return demoteMisplacedQti3Prompts(relocateQti3PromptIntoInteraction(normalizeQti3Lexically(xml)));
}

/** The QTI 2.x element names with an acronym run, which camel-casing cannot produce. */
const ACRONYM_ELEMENT_NAMES = new Map([
  ['duration-gte', 'durationGTE'],
  ['duration-lt', 'durationLT'],
]);

function camelCaseQtiName(name: string): string {
  return (
    ACRONYM_ELEMENT_NAMES.get(name.toLowerCase()) ??
    name.replace(/-([a-z0-9])/gi, (_match, char) => char.toUpperCase())
  );
}
