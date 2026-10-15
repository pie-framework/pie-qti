/**
 * Accessibility inventory
 *
 * Every accessibility construct in the QTI input is either carried into the PIE output or reported
 * as a `QTI_ACCESSIBILITY_NOT_CARRIED` warning naming the construct and its count. The carried
 * check reads only what renders: each item's `config`, `passage` and `accessibilityCatalogs`.
 * Metadata is skipped because it embeds the source QTI, which would make every construct look
 * carried; its one exception is `companionMaterials`, the host's record of the materials to offer.
 *
 * An APIP access element counts once per content link, carried when the link docked in rendered
 * content and its catalog reached the output. A support QTI 3 has no counterpart for is always
 * reported, by name.
 */

import type { PieItem, TransformOutput, TransformWarning } from '@pie-qti/transform-types';
import { type HTMLElement, NodeType, parse } from 'node-html-parser';
import { readApipAccessElements } from './accessibility-catalogs.js';
import { escapeText, HIDING_STYLES, SSML_NAMESPACES } from '@pie-qti/qti-common/accessibility';
import { unwrapCdataSections } from './cdata.js';

export const ACCESSIBILITY_NOT_CARRIED = 'QTI_ACCESSIBILITY_NOT_CARRIED';

/** Constructs in the order their warnings are reported. */
export const ACCESSIBILITY_CONSTRUCTS = [
  'apip:accessElement',
  'apip:support',
  'apip:inclusionOrder',
  'catalog',
  'data-catalog-idref',
  'data-ssml',
  'ssml:*',
  'data-qti-suppress-tts',
  'companionMaterialsInfo',
  'qti-visually-hidden',
  'qti-hidden',
  'alt',
  'aria-*',
] as const;

export type AccessibilityConstruct = (typeof ACCESSIBILITY_CONSTRUCTS)[number];

export interface AccessibilityFinding {
  construct: AccessibilityConstruct;
  /** What the carried check matches on: an identifier, idref or attribute value. */
  key?: string;
}

export interface AccessibilityNotCarriedWarning extends TransformWarning {
  code: typeof ACCESSIBILITY_NOT_CARRIED;
  construct: AccessibilityConstruct;
  count: number;
}

export interface AccessibilityAudit {
  found: AccessibilityFinding[];
  carried: AccessibilityFinding[];
  notCarried: AccessibilityFinding[];
  /** Distinct catalog support names the output carries, e.g. `spoken`. */
  supports: string[];
}

const CONSEQUENCES: Record<AccessibilityConstruct, string> = {
  'apip:accessElement': 'the content it links loses its supports',
  'apip:support': 'PIE has no counterpart for it',
  'apip:inclusionOrder': 'PIE has no read-order counterpart',
  catalog: 'the supports it declares are lost',
  'data-catalog-idref': 'the content loses its catalog supports',
  'data-ssml': 'read-aloud ignores its speech markup',
  'ssml:*': 'read-aloud ignores its speech markup',
  'data-qti-suppress-tts': 'read-aloud speaks content the author suppressed',
  companionMaterialsInfo: 'the materials it lists are not offered',
  'qti-visually-hidden': 'screen-reader-only content renders visibly',
  'qti-hidden': 'hidden content renders visibly',
  alt: 'the image loses its text alternative',
  'aria-*': 'assistive technology loses the label or state',
};

const CONTENT_ROOTS = new Set(['itemBody', 'modalFeedback', 'stimulusBody']);
const DECLARATION_BLOCKS = new Set(['apipAccessibility', 'catalogInfo']);
const HIDING_CLASSES = ['qti-visually-hidden', 'qti-hidden'] as const;
const CATALOG_KEYS = new Set(['accessibilityCatalogs', 'extractedCatalogs']);
const ALT_KEYS = new Set(['alt', 'altText', 'alternativeText']);

/** Find every accessibility construct in a QTI document. */
export function inventoryAccessibility(qtiXml: string): AccessibilityFinding[] {
  const root = parse(unwrapCdataSections(qtiXml), { lowerCaseTagName: false, comment: false });
  const ssmlPrefixes = ssmlPrefixesOf(root);
  const found: AccessibilityFinding[] = [];
  for (const { identifier, links, cards, unmapped } of readApipAccessElements(root)) {
    if (cards.length > 0) {
      const key = identifier || undefined;
      for (let link = 0; link < Math.max(links.length, 1); link += 1) {
        found.push({ construct: 'apip:accessElement', key });
      }
    }
    found.push(...unmapped.map((name) => ({ construct: 'apip:support' as const, key: name })));
  }

  const visit = (element: HTMLElement, inContent: boolean, defaultSsml: boolean): void => {
    const [prefix, local] = splitName(element.rawTagName ?? '');
    const xmlns = element.getAttribute('xmlns');
    const ssmlScope = xmlns === undefined ? defaultSsml : SSML_NAMESPACES.has(xmlns.trim());
    const isSsml = prefix === undefined ? ssmlScope : ssmlPrefixes.has(prefix);

    if (local === 'inclusionOrder') {
      found.push({ construct: 'apip:inclusionOrder' });
    } else if (local === 'companionMaterialsInfo') {
      found.push({ construct: 'companionMaterialsInfo' });
    } else if (local === 'catalog' && localName(element.parentNode) === 'catalogInfo') {
      found.push({
        construct: 'catalog',
        key: element.getAttribute('id') ?? element.getAttribute('identifier'),
      });
    }

    const childInContent =
      !DECLARATION_BLOCKS.has(local) && (inContent || CONTENT_ROOTS.has(local));
    if (inContent && !DECLARATION_BLOCKS.has(local)) {
      if (isSsml) {
        found.push({ construct: 'ssml:*', key: `${local}\u0000${normalize(element.textContent)}` });
      }
      found.push(...attributeFindings(element));
    }

    for (const child of element.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        visit(child as HTMLElement, childInContent, ssmlScope);
      }
    }
  };

  for (const child of root.childNodes) {
    if (child.nodeType === NodeType.ELEMENT_NODE) visit(child as HTMLElement, false, false);
  }
  return found;
}

/** Compare the input's inventory with what the output carries. */
export function auditAccessibility(qtiXml: string, items: PieItem[]): AccessibilityAudit {
  const found = inventoryAccessibility(qtiXml);
  const rendered = collectRendered(items);
  const carried: AccessibilityFinding[] = [];
  const notCarried: AccessibilityFinding[] = [];
  for (const finding of found) {
    (isCarried(finding, rendered) ? carried : notCarried).push(finding);
  }
  return { found, carried, notCarried, supports: [...rendered.supports].sort() };
}

/** One warning per construct the output does not carry. */
export function accessibilityWarnings(
  audit: AccessibilityAudit,
  itemId: string
): AccessibilityNotCarriedWarning[] {
  const counts = new Map<AccessibilityConstruct, number>();
  const supports = new Set<string>();
  for (const { construct, key } of audit.notCarried) {
    counts.set(construct, (counts.get(construct) ?? 0) + 1);
    if (construct === 'apip:support' && key) supports.add(key);
  }
  return ACCESSIBILITY_CONSTRUCTS.filter((construct) => counts.has(construct)).map((construct) => {
    const count = counts.get(construct) ?? 0;
    const consequence =
      construct === 'apip:support' && supports.size > 0
        ? `PIE has no counterpart for ${[...supports].sort().join(', ')}`
        : CONSEQUENCES[construct];
    return {
      itemId,
      code: ACCESSIBILITY_NOT_CARRIED,
      construct,
      count,
      message: `${construct} (${count}) not carried into PIE: ${consequence}.`,
    };
  });
}

/**
 * Audit a transform's output: append a warning per construct it drops and record the supports
 * each PIE item carries in `metadata.accessibility.supports`.
 */
export function withAccessibilityAudit(
  output: TransformOutput,
  qtiXml: string,
  itemId: string
): TransformOutput {
  const items = output.items
    .map((item) => item.content)
    .filter((content): content is PieItem => isPieItem(content));
  if (items.length === 0) return output;

  const audit = auditAccessibility(qtiXml, items);
  const warnings = accessibilityWarnings(audit, itemId);
  return {
    ...output,
    items: output.items.map((item) =>
      isPieItem(item.content)
        ? { ...item, content: withSupports(item.content, audit.supports) }
        : item
    ),
    ...(warnings.length > 0 && { warnings: [...(output.warnings ?? []), ...warnings] }),
  };
}

function withSupports(item: PieItem, supports: string[]): PieItem {
  const metadata = (item.metadata ?? {}) as Record<string, any>;
  const existing: string[] = Array.isArray(metadata.accessibility?.supports)
    ? metadata.accessibility.supports
    : [];
  return {
    ...item,
    metadata: {
      ...metadata,
      accessibility: {
        ...(metadata.accessibility ?? {}),
        supports: [...new Set([...existing, ...supports])].sort(),
      },
    },
  };
}

function attributeFindings(element: HTMLElement): AccessibilityFinding[] {
  const findings: AccessibilityFinding[] = [];
  for (const [rawName, value] of Object.entries(element.attributes)) {
    const name = rawName.toLowerCase();
    if (name === 'data-ssml') findings.push({ construct: 'data-ssml', key: normalize(value) });
    else if (name === 'data-catalog-idref')
      findings.push({ construct: 'data-catalog-idref', key: value.trim() });
    else if (name === 'data-qti-suppress-tts')
      findings.push({ construct: 'data-qti-suppress-tts', key: normalize(value) });
    else if (name === 'alt') findings.push({ construct: 'alt', key: normalize(value) });
    else if (name.startsWith('aria-'))
      findings.push({ construct: 'aria-*', key: `${name}=${normalize(value)}` });
  }
  const classes = (element.getAttribute('class') ?? '').split(/\s+/);
  for (const hidingClass of HIDING_CLASSES) {
    if (classes.includes(hidingClass)) findings.push({ construct: hidingClass });
  }
  return findings;
}

interface Rendered {
  catalogIds: Set<string>;
  spokenContents: Set<string>;
  supports: Set<string>;
  idrefs: Multiset;
  alts: Multiset;
  arias: Multiset;
  ttsSuppressions: Multiset;
  /** Elements that carry a hiding class with the inline style it stands for, by class. */
  hidden: Multiset;
  companionMaterials: number;
}

function isCarried(finding: AccessibilityFinding, rendered: Rendered): boolean {
  const { key } = finding;
  switch (finding.construct) {
    case 'catalog':
      return key !== undefined && rendered.catalogIds.has(key);
    case 'apip:accessElement':
    case 'data-catalog-idref':
      return key !== undefined && rendered.catalogIds.has(key) && rendered.idrefs.take(key);
    case 'ssml:*':
      return key !== undefined && isSpoken(key, rendered);
    case 'data-ssml':
      return key !== undefined && rendered.spokenContents.has(key);
    case 'alt':
      return key !== undefined && rendered.alts.take(key);
    case 'aria-*':
      return key !== undefined && rendered.arias.take(key);
    case 'data-qti-suppress-tts':
      return key !== undefined && rendered.ttsSuppressions.take(key);
    case 'qti-hidden':
    case 'qti-visually-hidden':
      return rendered.hidden.take(finding.construct);
    case 'companionMaterialsInfo':
      if (rendered.companionMaterials === 0) return false;
      rendered.companionMaterials -= 1;
      return true;
    default:
      // No output carries these: PIE has no read order, and no counterpart for the supports.
      return false;
  }
}

/** Whether a `spoken` card holds an inline SSML element: its name, and its text as spoken. */
function isSpoken(key: string, rendered: Rendered): boolean {
  const [local = '', text = ''] = key.split('\u0000');
  const tag = new RegExp(`<${local.replace(/[.]/g, '\\.')}[\\s/>]`);
  const spokenText = escapeText(text);
  return [...rendered.spokenContents].some(
    (content) =>
      tag.test(content) && normalize(content.replace(/<[^>]*>/g, '')).includes(spokenText)
  );
}

function collectRendered(items: PieItem[]): Rendered {
  const rendered: Rendered = {
    catalogIds: new Set(),
    spokenContents: new Set(),
    supports: new Set(),
    idrefs: new Multiset(),
    alts: new Multiset(),
    arias: new Multiset(),
    ttsSuppressions: new Multiset(),
    hidden: new Multiset(),
    companionMaterials: 0,
  };

  const visit = (value: unknown, key?: string): void => {
    if (typeof value === 'string') {
      if (key && ALT_KEYS.has(key)) rendered.alts.add(normalize(value));
      if (value.includes('<')) collectMarkup(value, rendered);
      return;
    }
    if (Array.isArray(value)) {
      if (key && CATALOG_KEYS.has(key)) collectCatalogs(value, rendered);
      for (const entry of value) visit(entry);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  };

  for (const item of items) {
    const record = item as unknown as Record<string, unknown>;
    visit(record.config);
    visit(record.passage);
    visit(record.accessibilityCatalogs, 'accessibilityCatalogs');
    if (item.metadata?.companionMaterials) rendered.companionMaterials += 1;
  }
  return rendered;
}

function collectCatalogs(catalogs: unknown[], rendered: Rendered): void {
  for (const catalog of catalogs) {
    if (typeof catalog !== 'object' || catalog === null) continue;
    const { identifier, cards } = catalog as { identifier?: unknown; cards?: unknown };
    if (typeof identifier === 'string') rendered.catalogIds.add(identifier);
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const { catalog: support, content } = (card ?? {}) as {
        catalog?: unknown;
        content?: unknown;
      };
      if (typeof support !== 'string') continue;
      rendered.supports.add(support);
      if (support === 'spoken' && typeof content === 'string') {
        rendered.spokenContents.add(normalize(content));
      }
    }
  }
}

function collectMarkup(markup: string, rendered: Rendered): void {
  for (const element of parse(markup, { comment: false }).querySelectorAll('*')) {
    for (const [rawName, value] of Object.entries(element.attributes)) {
      const name = rawName.toLowerCase();
      if (name === 'alt') rendered.alts.add(normalize(value));
      else if (name === 'data-catalog-idref') rendered.idrefs.add(value.trim());
      else if (name.startsWith('aria-')) rendered.arias.add(`${name}=${normalize(value)}`);
      else if (name === 'data-tts-suppress') rendered.ttsSuppressions.add(normalize(value));
    }
    const classes = (element.getAttribute('class') ?? '').split(/\s+/);
    const style = compactStyle(element.getAttribute('style') ?? '');
    for (const hidingClass of HIDING_CLASSES) {
      if (
        classes.includes(hidingClass) &&
        style.includes(compactStyle(HIDING_STYLES[hidingClass]))
      ) {
        rendered.hidden.add(hidingClass);
      }
    }
  }
}

function compactStyle(style: string): string {
  return style.replace(/\s+/g, '').toLowerCase();
}

function ssmlPrefixesOf(root: HTMLElement): Set<string> {
  const prefixes = new Set(['ssml']);
  for (const element of root.querySelectorAll('*')) {
    for (const [name, value] of Object.entries(element.attributes)) {
      if (name.startsWith('xmlns:') && SSML_NAMESPACES.has(value)) {
        prefixes.add(name.slice('xmlns:'.length));
      }
    }
  }
  return prefixes;
}

function splitName(rawTagName: string): [string | undefined, string] {
  const colon = rawTagName.indexOf(':');
  return colon === -1
    ? [undefined, rawTagName]
    : [rawTagName.slice(0, colon), rawTagName.slice(colon + 1)];
}

function localName(node: unknown): string | undefined {
  const rawTagName = (node as HTMLElement | null)?.rawTagName;
  return rawTagName ? splitName(rawTagName)[1] : undefined;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isPieItem(value: unknown): value is PieItem {
  return typeof value === 'object' && value !== null && 'config' in value;
}

class Multiset {
  private readonly counts = new Map<string, number>();

  add(key: string): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  /** Consume one occurrence of `key`, reporting whether one was left. */
  take(key: string): boolean {
    const count = this.counts.get(key) ?? 0;
    if (count === 0) return false;
    this.counts.set(key, count - 1);
    return true;
  }
}
