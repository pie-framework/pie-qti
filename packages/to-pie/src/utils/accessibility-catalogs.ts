/**
 * Accessibility catalogs
 *
 * QTI 3 accessibility catalogs carried into PIE as `accessibilityCatalogs`, in the card shape
 * pie-players resolves. Each `catalog` becomes one catalog by its `id`, and each `card` one card
 * per `cardEntry`, its `support` the card's `catalog` and the entry's `xml:lang` its `language`.
 * `htmlContent` becomes the card's `content`; `fileHref` becomes its `payload`, a media reference
 * whose source is the path as authored, with the media fragment as a time range. A support PIE does not know is carried as authored.
 *
 * A QTI 2.x APIP `accessElement` becomes one catalog by its `identifier`, its supports cards
 * under the support names QTI 3 uses, as 1EdTech's APIP-to-QTI 3 migration guide maps them:
 *
 * - `spoken`: one script card, the first of `textToSpeechPronunciationSSML` (as `<speak>`),
 *   `textToSpeechPronunciation` and `spokenText`, the others kept as `ext:custom-` cards, and a
 *   card per `audioFileInfo` recording, its `startTime` and `duration` the time range;
 * - `brailleText` as `braille`, `tactileFile` as `tactile`;
 * - `signing` as `sign-language` video, `ase` for ASL and `eng-US` for Signed English, with the
 *   cues as the time range;
 * - `keyWordTranslation` as `keyword-translation`, one card per language;
 * - `guidance`'s `languageLearnerSupport` as `linguistic-guidance`.
 *
 * QTI 3 has no counterpart for the other supports, and the accessibility audit reports them;
 * `voiceType`, `voiceSpeed` and `supportOrder` are dropped, the last because document order is
 * the order. Each content link docks the catalog's idref in the content.
 *
 * The content's preparation, so what QTI voices, hides or suppresses stays so in PIE, is in
 * `accessibility-markup.ts`. Its `spoken` cards from SSML join the catalog they dock under,
 * unless that catalog has a `spoken` card already.
 *
 * A catalog attaches where the node it describes renders: to the one model whose content holds
 * its idref, or to the item when its markup or several models hold it. A catalog no output node
 * references attaches nowhere, and the accessibility audit reports it. `companionMaterialsInfo`
 * goes into `metadata.companionMaterials` as an element tree.
 */

import type { PieItem, TransformOutput } from '@pie-qti/transform-types';
import { type HTMLElement, NodeType, parse } from 'node-html-parser';
import {
  type ContentLink,
  escapeText,
  HIDING_STYLES,
  prepareContentMarkup,
  type TextRange,
} from './accessibility-markup.js';
import { unwrapCdataSections } from './cdata.js';

export { HIDING_STYLES };

export type MediaKind = 'image' | 'audio' | 'video' | 'other';

/** One playable encoding of a media asset. */
export interface MediaSource {
  src: string;
  /** MIME type, omitted when the source does not declare one. */
  type?: string;
}

export interface MediaAssetRef {
  version: 1;
  id: string;
  kind: MediaKind;
  sources: MediaSource[];
}

/** A time slice of a media asset, from a QTI 3 media fragment (`#t=2,5`). */
export interface MediaFragmentRange {
  startSeconds: number;
  endSeconds?: number;
}

/** The structured form of a card: a recording for `spoken`, a video for `sign-language`. */
export interface CatalogCardPayload {
  media: MediaAssetRef;
  fragment?: MediaFragmentRange;
}

/** One alternate representation of a content node. Exactly one of `content` and `payload`. */
export interface CatalogCard {
  /** The QTI `support`, e.g. `spoken`, `sign-language`, `glossary-on-screen`. */
  catalog: string;
  language?: string;
  content?: string;
  payload?: CatalogCardPayload;
}

export interface AccessibilityCatalog {
  identifier: string;
  cards: CatalogCard[];
}

/** An element of `companionMaterialsInfo`, kept whole: a text child is a string. */
export interface CompanionMaterialsNode {
  element: string;
  attributes: Record<string, string>;
  children: Array<CompanionMaterialsNode | string>;
}

/** An APIP link from an access element to the content it describes. */
export interface ApipContentLink {
  /** The `id` of the content element, from `qtiLinkIdentifierRef`; empty when it names none. */
  target: string;
  /** The word or character range of the element's text, when the link has one. */
  range?: TextRange;
}

export interface ApipAccessElement {
  identifier: string;
  links: ApipContentLink[];
  cards: CatalogCard[];
  /** The supports QTI 3 has no counterpart for, by element name. */
  unmapped: string[];
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
const MEDIA_FRAGMENT_PATTERN = /^t=(?:npt:)?([\d.:]*)(?:,([\d.:]+))?$/;
const EXTENSION_KINDS: Record<string, MediaKind> = {
  aac: 'audio',
  m4a: 'audio',
  mp3: 'audio',
  oga: 'audio',
  ogg: 'audio',
  wav: 'audio',
  m4v: 'video',
  mov: 'video',
  mp4: 'video',
  ogv: 'video',
  webm: 'video',
  gif: 'image',
  jpeg: 'image',
  jpg: 'image',
  png: 'image',
  svg: 'image',
  webp: 'image',
};
/** The sign language a `signing` file is in: ASL, and Signed English as the guide codes it. */
const SIGN_FILE_LANGUAGES: Record<string, string> = {
  signFileASL: 'ase',
  signFileSignedEnglish: 'eng-US',
};
const APIP_SUPPORTS: Record<string, (support: HTMLElement) => ApipSupport> = {
  spoken: spokenSupport,
  brailleText: (support) => ({ cards: textCards('braille', textOf(support, 'brailleTextString')) }),
  tactileFile: (support) => {
    const audio = firstChild(support, 'tactileAudioFile');
    const payload = audio && audioPayload(audio);
    return {
      cards: [
        ...textCards('tactile', textOf(support, 'tactileAudioText')),
        ...(payload ? [{ catalog: 'tactile', payload }] : []),
        ...textCards('ext:custom-tactile-braille-text', textOf(support, 'tactileBrailleText')),
      ],
    };
  },
  signing: (support) => {
    const cards: CatalogCard[] = [];
    const unmapped: string[] = [];
    for (const signFile of allChildElements(support)) {
      const language = SIGN_FILE_LANGUAGES[localName(signFile)];
      const video = firstChild(signFile, 'videoFileInfo');
      const payload = language && video ? videoPayload(video) : undefined;
      if (payload) cards.push({ catalog: SIGN_LANGUAGE, language, payload });
      if (!language) unmapped.push(localName(signFile));
      else if (firstChild(signFile, 'boneAnimationVideoFile'))
        unmapped.push('boneAnimationVideoFile');
    }
    return { cards, unmapped };
  },
  keyWordTranslation: (support) => ({
    cards: childElements(support, 'definitionId').flatMap((definition) => {
      const language = definition.getAttribute('xml:lang')?.trim();
      return textCards('keyword-translation', textOf(definition, 'textString')).map((card) =>
        language ? { ...card, language } : card
      );
    }),
  }),
  guidance: (support) => {
    const learner = firstChild(support, 'languageLearnerSupport');
    return {
      cards: learner ? textCards('linguistic-guidance', textOf(learner, 'textString')) : [],
      unmapped: firstChild(support, 'cognitiveGuidanceSupport') ? ['cognitiveGuidanceSupport'] : [],
    };
  },
};

interface ApipSupport {
  cards: CatalogCard[];
  unmapped?: string[];
}

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

/** The APIP access elements a QTI 2.x document declares, in document order. */
export function readApipAccessElements(root: HTMLElement): ApipAccessElement[] {
  return elementsNamed(root, 'accessElement').map((element) => {
    const cards: CatalogCard[] = [];
    const unmapped: string[] = [];
    for (const info of childElements(element, 'relatedElementInfo')) {
      for (const support of allChildElements(info)) {
        const read = APIP_SUPPORTS[localName(support)];
        if (!read) {
          unmapped.push(localName(support));
          continue;
        }
        const mapped = read(support);
        cards.push(...mapped.cards);
        unmapped.push(...(mapped.unmapped ?? []));
      }
    }
    return {
      identifier: element.getAttribute('identifier')?.trim() ?? '',
      links: childElements(element, 'contentLinkInfo').map(contentLink),
      cards,
      unmapped,
    };
  });
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
    const content = htmlContent.innerHTML.trim();
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
  const startSeconds = match[1] ? seconds(match[1]) : 0;
  const endSeconds = match[2] ? seconds(match[2]) : undefined;
  if (startSeconds === undefined) return undefined;
  return endSeconds === undefined ? { startSeconds } : { startSeconds, endSeconds };
}

function seconds(value: string): number | undefined {
  const parts = value.split(':').map(Number);
  if (parts.length > 3 || parts.some((part) => !Number.isFinite(part))) return undefined;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function mediaKind(type: string | undefined, src: string, fallback: MediaKind): MediaKind {
  const prefix = type?.split('/')[0]?.toLowerCase();
  if (prefix === 'image' || prefix === 'audio' || prefix === 'video') return prefix;
  const extension = /\.([a-z0-9]+)$/i.exec(src)?.[1]?.toLowerCase();
  return (extension ? EXTENSION_KINDS[extension] : undefined) ?? fallback;
}

function fallbackKind(support: string): MediaKind {
  if (support === SIGN_LANGUAGE) return 'video';
  return support === SPOKEN ? 'audio' : 'other';
}

function spokenSupport(spoken: HTMLElement): ApipSupport {
  const ssml = firstChild(spoken, 'textToSpeechPronunciationSSML');
  // The first script present is the spoken card; the ones it outranks keep their own names.
  const scripts = [
    [SPOKEN, ssml && speakMarkup(ssml)],
    ['ext:custom-text-to-speech-pronunciation', textOf(spoken, 'textToSpeechPronunciation')],
    ['ext:custom-spoken-text', textOf(spoken, 'spokenText')],
  ].filter((script): script is [string, string] => Boolean(script[1]));
  const recordings = childElements(spoken, 'audioFileInfo').flatMap((audio) => {
    const payload = audioPayload(audio);
    return payload ? [{ catalog: SPOKEN, payload }] : [];
  });
  return {
    cards: [
      ...scripts.map(([catalog, content], index) => ({
        catalog: index === 0 ? SPOKEN : catalog,
        content,
      })),
      ...recordings,
    ],
  };
}

/** `textToSpeechPronunciationSSML` as a `<speak>` document, its elements without prefixes. */
function speakMarkup(ssml: HTMLElement): string | undefined {
  const markup = ssml.innerHTML
    .replace(/<(\/?)[\w.-]+:/g, '<$1')
    .replace(/\s+xmlns(?::[\w.-]+)?\s*=\s*(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!markup) return undefined;
  return /^<speak[\s>]/.test(markup) ? markup : `<speak>${markup}</speak>`;
}

function audioPayload(info: HTMLElement): CatalogCardPayload | undefined {
  const start = timeOf(info, 'startTime');
  const duration = timeOf(info, 'duration');
  const startSeconds = start ?? 0;
  return filePayload(
    info,
    'audio',
    start === undefined && duration === undefined
      ? undefined
      : {
          startSeconds,
          ...(duration === undefined ? {} : { endSeconds: milliseconds(startSeconds + duration) }),
        }
  );
}

function videoPayload(info: HTMLElement): CatalogCardPayload | undefined {
  const start = timeOf(info, 'startCue');
  const end = timeOf(info, 'endCue');
  return filePayload(
    info,
    'video',
    start === undefined && end === undefined
      ? undefined
      : { startSeconds: start ?? 0, ...(end === undefined ? {} : { endSeconds: end }) }
  );
}

function filePayload(
  info: HTMLElement,
  fallback: MediaKind,
  fragment: MediaFragmentRange | undefined
): CatalogCardPayload | undefined {
  const src = firstChild(info, 'fileHref')?.textContent.trim();
  if (!src) return undefined;
  const type = info.getAttribute('mimeType')?.trim();
  return {
    media: {
      version: 1,
      id: src,
      kind: mediaKind(type, src, fallback),
      sources: [{ src, ...(type ? { type } : {}) }],
    },
    ...(fragment ? { fragment } : {}),
  };
}

/** An `xs:time` child as seconds; its time zone, which a media offset has no use for, ignored. */
function timeOf(parent: HTMLElement, name: string): number | undefined {
  const value = firstChild(parent, name)
    ?.textContent.trim()
    .replace(/(?:Z|[+-]\d{2}:\d{2})$/, '');
  return value ? seconds(value) : undefined;
}

function milliseconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function contentLink(link: HTMLElement): ApipContentLink {
  const target = link.getAttribute('qtiLinkIdentifierRef')?.trim() ?? '';
  const textLink = firstChild(link, 'textLink');
  const word = textLink && firstChild(textLink, 'wordLink');
  const character = textLink && firstChild(textLink, 'characterLink');
  const characters = textLink && firstChild(textLink, 'characterStringLink');
  let range: TextRange | undefined;
  if (word) {
    range = { unit: 'word', start: count(word), stop: count(word) };
  } else if (character) {
    range = { unit: 'character', start: count(character), stop: count(character) };
  } else if (characters) {
    range = {
      unit: 'character',
      start: count(firstChild(characters, 'startCharacter')),
      stop: count(firstChild(characters, 'stopCharacter')),
    };
  }
  return { target, ...(range ? { range } : {}) };
}

/** A link's word or character number; not a number when absent, so it locates nothing. */
function count(element: HTMLElement | undefined): number {
  return Number(element?.textContent.trim() || Number.NaN);
}

/** A text child as card content: its text, escaped as HTML. */
function textOf(parent: HTMLElement, name: string): string | undefined {
  const text = firstChild(parent, name)?.textContent.trim();
  return text ? escapeText(text) : undefined;
}

function textCards(catalog: string, content: string | undefined): CatalogCard[] {
  return content ? [{ catalog, content }] : [];
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

function firstChild(parent: HTMLElement, name: string): HTMLElement | undefined {
  return childElements(parent, name)[0];
}

function localName(element: HTMLElement): string {
  const raw = element.rawTagName ?? '';
  return raw.slice(raw.indexOf(':') + 1);
}

function isPieItem(value: unknown): value is PieItem {
  return typeof value === 'object' && value !== null && 'config' in value;
}
