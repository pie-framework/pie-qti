/**
 * Accessibility catalogs
 *
 * QTI 3 accessibility catalogs carried into PIE as `accessibilityCatalogs`, in the card shape
 * pie-players resolves. Each `catalog` becomes one catalog by its `id`, and each `card` one card
 * per `cardEntry`, its `support` the card's `catalog` and the entry's `xml:lang` its `language`.
 * `htmlContent` becomes the card's `content`; `fileHref` becomes its `payload`, a media reference
 * whose source is the path as authored, with the media fragment as a time range. A support PIE does not know is carried as authored.
 *
 * A QTI 2.x APIP `accessElement` becomes one catalog by its `identifier`, its supports cards under
 * the support names QTI 3 uses, as `@pie-qti/qti-common/accessibility` maps them; the
 * accessibility audit reports the supports QTI 3 has no counterpart for. Each content link docks
 * the catalog's idref in the content.
 *
 * The content's preparation, so what QTI voices, hides or suppresses stays so in PIE, is
 * `prepareContentMarkup` in `@pie-qti/qti-common/accessibility`. Its `spoken` cards from SSML join
 * the catalog they dock under, unless that catalog has a `spoken` card already.
 *
 * A catalog attaches where the node it describes renders: to the one model whose content holds
 * its idref, or to the item when its markup or several models hold it. A catalog no output node
 * references attaches nowhere, and the accessibility audit reports it. `companionMaterialsInfo`
 * goes into `metadata.companionMaterials` as an element tree.
 */

import {
  type AccessibilityCatalog,
  type CatalogCard,
  type ContentLink,
  clockSeconds,
  HIDING_STYLES,
  type MediaFragmentRange,
  type MediaKind,
  mediaKind,
  prepareContentMarkup,
  readApipAccessElements,
} from '@pie-qti/qti-common/accessibility';
import type { PieItem, TransformOutput } from '@pie-qti/transform-types';
import { type HTMLElement, NodeType, parse } from 'node-html-parser';
import { unwrapCdataSections } from './cdata.js';

export type {
  AccessibilityCatalog,
  ApipAccessElement,
  ApipContentLink,
  CatalogCard,
  CatalogCardPayload,
  MediaAssetRef,
  MediaFragmentRange,
  MediaKind,
  MediaSource,
} from '@pie-qti/qti-common/accessibility';
export { readApipAccessElements };
export { HIDING_STYLES };

/** An element of `companionMaterialsInfo`, kept whole: a text child is a string. */
export interface CompanionMaterialsNode {
  element: string;
  attributes: Record<string, string>;
  children: Array<CompanionMaterialsNode | string>;
}

export interface QtiAccessibility {
  /** The item as the transformers convert it. */
  xml: string;
  catalogs: AccessibilityCatalog[];
  companionMaterials?: CompanionMaterialsNode;
}

const SPOKEN = 'spoken';
const SIGN_LANGUAGE = 'sign-language';
const IDREF_PATTERN = /\bdata-catalog-idref\s*=\s*(["'])(.*?)\1/g;
const SSML_DEFAULT_NAMESPACE = /^<speak\s+xmlns\s*=\s*(["'])http:\/\/www\.w3\.org\/2001\/10\/synthesis\1(?=[\s>/])/;
const MEDIA_FRAGMENT_PATTERN = /^t=(?:npt:)?([\d.:]*)(?:,([\d.:]+))?$/;

/** Read the item's catalogs and companion materials, and prepare its content for conversion. */
export function prepareQtiAccessibility(qtiXml: string): QtiAccessibility {
  const root = parse(unwrapCdataSections(qtiXml), { lowerCaseTagName: false, comment: false });
  const catalogs = readQtiCatalogs(root);
  const links: ContentLink[] = [];
  for (const { identifier, links: elementLinks, cards } of readApipAccessElements(root)) {
    if (!identifier || cards.length === 0) continue;
    const catalog = catalogs.find((candidate) => candidate.identifier === identifier);
    if (catalog) catalog.cards.push(...cards);
    else catalogs.push({ identifier, cards });
    links.push(...elementLinks.map((link) => ({ idref: identifier, ...link })));
  }
  const prepared = prepareContentMarkup(qtiXml, links);
  for (const { identifier, content } of prepared.spoken) {
    const catalog = catalogs.find((candidate) => candidate.identifier === identifier);
    if (!catalog) {
      catalogs.push({ identifier, cards: [{ catalog: SPOKEN, content }] });
    } else if (!catalog.cards.some((card) => card.catalog === SPOKEN)) {
      catalog.cards.push({ catalog: SPOKEN, content });
    }
  }
  const companion = firstElement(root, 'companionMaterialsInfo');
  return {
    xml: prepared.xml,
    catalogs,
    ...(companion ? { companionMaterials: elementTree(companion) } : {}),
  };
}

/** The catalogs a QTI document's `catalogInfo` declares, in document order. */
export function readQtiCatalogs(root: HTMLElement): AccessibilityCatalog[] {
  const catalogs: AccessibilityCatalog[] = [];
  for (const catalogInfo of elementsNamed(root, 'catalogInfo')) {
    for (const element of childElements(catalogInfo, 'catalog')) {
      const identifier = (element.getAttribute('id') ?? element.getAttribute('identifier'))?.trim();
      if (!identifier) continue;
      const cards = childElements(element, 'card').flatMap(readCard);
      if (cards.length > 0) catalogs.push({ identifier, cards });
    }
  }
  return catalogs;
}

/** Carry the item's catalogs and companion materials onto each PIE item of the output. */
export function withQtiAccessibility(
  output: TransformOutput,
  accessibility: QtiAccessibility
): TransformOutput {
  if (accessibility.catalogs.length === 0 && !accessibility.companionMaterials) {
    return output;
  }
  return {
    ...output,
    items: output.items.map((item) =>
      isPieItem(item.content)
        ? { ...item, content: withAccessibility(item.content, accessibility) }
        : item
    ),
  };
}

function withAccessibility(item: PieItem, accessibility: QtiAccessibility): PieItem {
  const record = item as unknown as Record<string, any>;
  const config = (record.config ?? {}) as Record<string, any>;
  const models: Record<string, any>[] = Array.isArray(config.models) ? [...config.models] : [];
  const itemCatalogs: AccessibilityCatalog[] = [...(record.accessibilityCatalogs ?? [])];
  const carried = new Set(
    [itemCatalogs, config.extractedCatalogs, ...models.map((model) => model?.accessibilityCatalogs)]
      .flatMap((catalogs) => (Array.isArray(catalogs) ? catalogs : []))
      .map((catalog) => catalog?.identifier)
  );
  const markupIdrefs = idrefsIn(config.markup);

  for (const catalog of accessibility.catalogs) {
    if (carried.has(catalog.identifier)) continue;
    const holders = models.flatMap((model, index) =>
      idrefsIn(model).has(catalog.identifier) ? [index] : []
    );
    const [holder] = holders;
    if (markupIdrefs.has(catalog.identifier) || holders.length > 1) {
      itemCatalogs.push(catalog);
    } else if (holder !== undefined) {
      const model = models[holder] as Record<string, any>;
      models[holder] = {
        ...model,
        accessibilityCatalogs: [...(model.accessibilityCatalogs ?? []), catalog],
      };
    }
  }

  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    ...item,
    config: { ...item.config, models },
    ...(itemCatalogs.length > 0 ? { accessibilityCatalogs: itemCatalogs } : {}),
    ...(accessibility.companionMaterials
      ? { metadata: { ...metadata, companionMaterials: accessibility.companionMaterials } }
      : {}),
  } as PieItem;
}

function readCard(card: HTMLElement): CatalogCard[] {
  const support = card.getAttribute('support')?.trim();
  if (!support) return [];
  const entries = childElements(card, 'cardEntry');
  const sources = entries.length > 0 ? entries : [card];
  return sources.flatMap((source) => {
    const language = source.getAttribute('xml:lang')?.trim();
    const body = cardBody(source, support);
    return body ? [{ catalog: support, ...(language ? { language } : {}), ...body }] : [];
  });
}

function cardBody(
  source: HTMLElement,
  support: string
): Pick<CatalogCard, 'content' | 'payload'> | undefined {
  const [htmlContent] = childElements(source, 'htmlContent');
  if (htmlContent) {
    // QTI 3 puts a speak script in the SSML namespace; the card keeps it as authored.
    const content = htmlContent.innerHTML.trim().replace(SSML_DEFAULT_NAMESPACE, '<speak');
    return content ? { content } : undefined;
  }
  const files = childElements(source, 'fileHref').flatMap((fileHref) => {
    const text = fileHref.textContent.trim();
    const hashAt = text.indexOf('#');
    const src = hashAt === -1 ? text : text.slice(0, hashAt);
    if (!src) return [];
    const type = (fileHref.getAttribute('mime-type') ?? fileHref.getAttribute('mimeType'))?.trim();
    const fragment = hashAt === -1 ? undefined : mediaFragment(text.slice(hashAt + 1));
    return [{ src, ...(type ? { type } : {}), fragment }];
  });
  const [first] = files;
  if (!first) return undefined;
  const fragment = files.find((file) => file.fragment)?.fragment;
  return {
    payload: {
      media: {
        version: 1,
        id: first.src,
        kind: mediaKind(first.type, first.src, fallbackKind(support)),
        sources: files.map(({ fragment: _fragment, ...file }) => file),
      },
      ...(fragment ? { fragment } : {}),
    },
  };
}

/** A Media Fragments temporal range: `t=10,20`, `t=,20`, `t=npt:10` or `t=00:01:20`. */
function mediaFragment(fragment: string): MediaFragmentRange | undefined {
  const temporal = fragment.split('&').find((part) => part.startsWith('t='));
  const match = temporal ? MEDIA_FRAGMENT_PATTERN.exec(temporal) : null;
  if (!match) return undefined;
  const startSeconds = match[1] ? clockSeconds(match[1]) : 0;
  const endSeconds = match[2] ? clockSeconds(match[2]) : undefined;
  if (startSeconds === undefined) return undefined;
  return endSeconds === undefined ? { startSeconds } : { startSeconds, endSeconds };
}

function fallbackKind(support: string): MediaKind {
  if (support === SIGN_LANGUAGE) return 'video';
  return support === SPOKEN ? 'audio' : 'other';
}

/** Every `data-catalog-idref` a value's markup holds, at any depth. */
function idrefsIn(value: unknown): Set<string> {
  const idrefs = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      for (const match of node.matchAll(IDREF_PATTERN)) idrefs.add((match[2] as string).trim());
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (typeof node === 'object' && node !== null) {
      for (const [key, child] of Object.entries(node)) {
        if (key !== 'accessibilityCatalogs') visit(child);
      }
    }
  };
  visit(value);
  return idrefs;
}

function elementTree(element: HTMLElement): CompanionMaterialsNode {
  const children: CompanionMaterialsNode['children'] = [];
  for (const child of element.childNodes) {
    if (child.nodeType === NodeType.ELEMENT_NODE) {
      children.push(elementTree(child as HTMLElement));
    } else if (child.nodeType === NodeType.TEXT_NODE) {
      const text = child.textContent.trim();
      if (text) children.push(text);
    }
  }
  return { element: localName(element), attributes: { ...element.attributes }, children };
}

function elementsNamed(root: HTMLElement, name: string): HTMLElement[] {
  return root.querySelectorAll('*').filter((element) => localName(element) === name);
}

function firstElement(root: HTMLElement, name: string): HTMLElement | undefined {
  return elementsNamed(root, name)[0];
}

function childElements(parent: HTMLElement, name: string): HTMLElement[] {
  return allChildElements(parent).filter((child) => localName(child) === name);
}

function allChildElements(parent: HTMLElement): HTMLElement[] {
  return parent.childNodes.filter(
    (child): child is HTMLElement => child.nodeType === NodeType.ELEMENT_NODE
  );
}

function localName(element: HTMLElement): string {
  const raw = element.rawTagName ?? '';
  return raw.slice(raw.indexOf(':') + 1);
}

function isPieItem(value: unknown): value is PieItem {
  return typeof value === 'object' && value !== null && 'config' in value;
}
