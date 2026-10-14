/**
 * Accessibility catalogs
 *
 * pie-players' accessibility catalogs attach to a model, the item root, a passage or an
 * assessment, and markup points into them with `data-catalog-idref`. The QTI 2.2 export writes an
 * item's or passage's catalogs as APIP access elements, each linked to the elements whose
 * `data-catalog-idref` names it; an element without an `id` gets one. QTI 2.2 admits `data-*`
 * attributes, so the idrefs stay in the markup.
 *
 * What APIP cannot carry is named in a warning: supports APIP has no element for, catalogs no
 * exported element refers to, and idrefs no exported catalog declares. Assessments carry no APIP,
 * so their catalogs are named whole. When two owners declare one identifier, the first
 * declaration is written.
 *
 * The QTI 3.0 export writes the same catalogs natively as `qti-catalog-info` after the item or
 * stimulus body, every card included. QTI 3.0 types `data-catalog-idref` as an IDREF, so an idref
 * no exported catalog declares is dropped from the markup, and the warning names it.
 */

import {
  type ApipAccessElementSource,
  type ApipContentLink,
  type CatalogCard,
  writeApipAccessibility,
  writeQtiCatalogInfo,
} from '@pie-qti/qti-common/accessibility';
import { toQtiXhtml } from './xhtml.js';

const CATALOG_IDREF = /\bdata-catalog-idref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;

/** Keys holding catalogs: pie-players' owner catalogs, and catalogs its SSML extraction wrote. */
const CATALOG_KEYS = new Set(['accessibilityCatalogs', 'extractedCatalogs']);

/**
 * The catalog identifiers `content` declares or references, in first-seen order. The embedded QTI
 * source under `qtiSource` is skipped: a generated export does not use it.
 */
export function findAccessibilityCatalogs(content: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(CATALOG_IDREF)) {
        const idref = (match[1] ?? match[2] ?? match[3]).trim();
        if (idref) found.add(idref);
      }
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'qtiSource') continue;
      if (CATALOG_KEYS.has(key) && Array.isArray(child)) {
        for (const catalog of child) {
          const identifier = (catalog as { identifier?: unknown } | null)?.identifier;
          if (typeof identifier === 'string' && identifier) found.add(identifier);
        }
        continue;
      }
      visit(child);
    }
  };
  visit(content);
  return [...found];
}

/**
 * A warning naming the catalogs `content` carries, which the export drops, or `undefined` when it
 * carries none. `subject` names what is exported, as in `Item "item-1"`.
 */
export function catalogsNotExportedWarning(
  subject: string,
  content: unknown,
  version: QtiVersion = '2.2'
): string | undefined {
  const catalogs = findAccessibilityCatalogs(content);
  if (catalogs.length === 0) return undefined;
  const names = catalogs.map((catalog) => `"${catalog}"`).join(', ');
  return `${subject} carries accessibility catalogs ${names}, which the QTI ${version} export does not write`;
}

export type QtiVersion = '2.2' | '3.0';

/** Elements an APIP link names as an object rather than by their text. */
const OBJECT_ELEMENTS = new Set(['img', 'object', 'audio', 'video']);
const START_TAG = /<([A-Za-z][\w.:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ID_ATTRIBUTE = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)')/;
const ALL_IDS = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const IDREF_ATTRIBUTE = /(?:^|\s)data-catalog-idref\s*=\s*(?:"([^"]*)"|'([^']*)')/;

export interface ApipExport {
  qtiXml: string;
  /** What the export does not write, or `undefined` when it writes every catalog in full. */
  warning?: string;
}

/**
 * `qtiXml`, an item or passage, with the catalogs `content` declares written as APIP before its
 * closing `assessmentItem` tag. `subject` names what is exported, as in `Item "item-1"`.
 */
export function withApipAccessibility(subject: string, qtiXml: string, content: unknown): ApipExport {
  const declared = declaredCatalogs(content);
  const named = findAccessibilityCatalogs(content);
  const bodyStart = qtiXml.indexOf('<itemBody');
  const close = qtiXml.lastIndexOf('</assessmentItem>');
  if (named.length === 0 && declared.size === 0) return { qtiXml };

  const ids = new Set([...qtiXml.matchAll(ALL_IDS)].map((match) => decode(match[1] ?? match[2] ?? '')));
  const links = new Map<string, ApipContentLink[]>();
  let generated = 0;
  const region = bodyStart === -1 || close === -1 ? '' : qtiXml.slice(bodyStart, close);
  const edited = region.replace(START_TAG, (tag, name: string, attrs: string) => {
    const idrefMatch = IDREF_ATTRIBUTE.exec(attrs);
    const idref = idrefMatch ? decode(idrefMatch[1] ?? idrefMatch[2] ?? '').trim() : '';
    if (!idref) return tag;
    if (!named.includes(idref)) named.push(idref);
    if (!declared.has(idref)) return tag;
    const idMatch = ID_ATTRIBUTE.exec(attrs);
    let id = idMatch ? decode(idMatch[1] ?? idMatch[2] ?? '').trim() : '';
    let edit = tag;
    if (!id) {
      do {
        generated += 1;
        id = `apip-target-${generated}`;
      } while (ids.has(id));
      ids.add(id);
      edit = `<${name} id="${id}"${tag.slice(name.length + 1)}`;
    }
    const local = name.slice(name.indexOf(':') + 1).toLowerCase();
    const targets = links.get(idref) ?? [];
    targets.push({ target: id, ...(OBJECT_ELEMENTS.has(local) ? { object: true } : {}) });
    links.set(idref, targets);
    return edit;
  });

  const elements: ApipAccessElementSource[] = [...declared]
    .filter(([identifier]) => links.has(identifier))
    .map(([identifier, catalog]) => ({ identifier, links: links.get(identifier) ?? [], cards: catalog.cards }));
  const apip = writeApipAccessibility(elements, { reservedIds: ids });

  const reasons = named.flatMap((identifier) => {
    const catalog = declared.get(identifier);
    const reason: string[] = [];
    if (!catalog) reason.push('no catalog in the export declares it');
    else if (!links.has(identifier)) reason.push('no exported element refers to it');
    else reason.push(...(apip.unwritten.get(identifier) ?? []));
    if (catalog?.redeclared) reason.push('declared again, which is not written');
    return reason.length > 0 ? [`"${identifier}" (${reason.join(', ')})`] : [];
  });
  const warning =
    reasons.length > 0
      ? `${subject} carries accessibility catalogs the QTI 2.2 export does not write in full: ${reasons.join(', ')}`
      : undefined;
  if (!apip.xml) return { qtiXml, ...(warning ? { warning } : {}) };
  return {
    qtiXml: `${qtiXml.slice(0, bodyStart)}${edited.replace(/\s*$/, '\n  ')}${apip.xml}\n${qtiXml.slice(close)}`,
    ...(warning ? { warning } : {}),
  };
}

/**
 * `qtiXml`, a QTI 3.0 item or stimulus, with the catalogs `content` declares and its markup
 * refers to written as `qti-catalog-info` after its body. `subject` names what is exported.
 */
export function withQtiCatalogInfo(subject: string, qtiXml: string, content: unknown): ApipExport {
  const declared = declaredCatalogs(content);
  const named = findAccessibilityCatalogs(content);
  const body = /<qti-(item|stimulus)-body[\s/>]/.exec(qtiXml);
  if (named.length === 0 && declared.size === 0) return { qtiXml };

  const referenced = new Set<string>();
  const dropped = new Set<string>();
  const start = body?.index ?? qtiXml.length;
  const edited =
    qtiXml.slice(0, start) +
    qtiXml.slice(start).replace(START_TAG, (tag) => {
      const idrefMatch = IDREF_ATTRIBUTE.exec(tag);
      if (!idrefMatch) return tag;
      const idref = decode(idrefMatch[1] ?? idrefMatch[2] ?? '').trim();
      if (declared.has(idref)) {
        referenced.add(idref);
        return tag;
      }
      if (idref) dropped.add(idref);
      return tag.replace(IDREF_ATTRIBUTE, '');
    });

  for (const idref of dropped) if (!named.includes(idref)) named.push(idref);
  const catalogs = [...declared]
    .filter(([identifier]) => referenced.has(identifier))
    .map(([identifier, catalog]) => ({ identifier, cards: catalog.cards }));
  const reasons = named.flatMap((identifier) => {
    const catalog = declared.get(identifier);
    const reason: string[] = [];
    if (!catalog) reason.push('no catalog in the export declares it');
    else if (!referenced.has(identifier)) reason.push('no exported element refers to it');
    if (catalog?.redeclared) reason.push('declared again, which is not written');
    return reason.length > 0 ? [`"${identifier}" (${reason.join(', ')})`] : [];
  });
  const warning =
    reasons.length > 0
      ? `${subject} carries accessibility catalogs the QTI 3.0 export does not write in full: ${reasons.join(', ')}`
      : undefined;

  const catalogInfo = writeQtiCatalogInfo(catalogs, { html: toQtiXhtml });
  const close = body ? `</qti-${body[1]}-body>` : '';
  const at = close ? edited.lastIndexOf(close) : -1;
  const written =
    catalogInfo && at !== -1
      ? `${edited.slice(0, at + close.length)}\n  ${catalogInfo}${edited.slice(at + close.length)}`
      : edited;
  return { qtiXml: written, ...(warning ? { warning } : {}) };
}

/** The catalogs `content` declares, by identifier: the first declaration's cards. */
function declaredCatalogs(content: unknown): Map<string, { cards: CatalogCard[]; redeclared: boolean }> {
  const declared = new Map<string, { cards: CatalogCard[]; redeclared: boolean }>();
  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'qtiSource') continue;
      if (CATALOG_KEYS.has(key) && Array.isArray(child)) {
        for (const catalog of child as Array<{ identifier?: unknown; cards?: unknown } | null>) {
          const identifier = typeof catalog?.identifier === 'string' ? catalog.identifier : '';
          if (!identifier || !Array.isArray(catalog?.cards)) continue;
          const cards = catalog.cards as CatalogCard[];
          const existing = declared.get(identifier);
          if (!existing) declared.set(identifier, { cards, redeclared: false });
          else if (JSON.stringify(existing.cards) !== JSON.stringify(cards)) existing.redeclared = true;
        }
        continue;
      }
      visit(child);
    }
  };
  visit(content);
  return declared;
}

function decode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
