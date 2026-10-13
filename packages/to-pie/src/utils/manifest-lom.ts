/**
 * PIE item metadata carried as LOM on a package resource
 *
 * pie-to-qti2 writes a PIE item's `baseId` and `searchMetaData` as LOM on the item's `<resource>`
 * (encoding in `@pie-qti/transform-types` `pie-lom`). Element names are matched by local name, so
 * either LOM binding is read, and only entries carrying the PIE catalog and source markers count.
 */

import {
  PIE_LOM_BASE_ID_CATALOG,
  PIE_LOM_SEARCH_METADATA_SOURCE,
  type TransformOutput,
} from '@pie-qti/transform-types';
import { XMLParser } from 'fast-xml-parser';

export interface PieResourceLom {
  baseId?: string;
  searchMetaData?: Record<string, unknown>;
}

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  isArray: (_name, _path, _isLeaf, isAttribute) => !isAttribute,
});

/** PIE LOM by resource identifier; resources without any are absent. Unparseable XML reads as none. */
export function readPieResourceLom(manifestXml: string): Map<string, PieResourceLom> {
  const byResource = new Map<string, PieResourceLom>();
  let document: XmlNode;
  try {
    document = parser.parse(manifestXml) as XmlNode;
  } catch {
    return byResource;
  }
  const resources = children(document, 'manifest')
    .flatMap((manifest) => children(manifest, 'resources'))
    .flatMap((resources) => children(resources, 'resource'));
  for (const resource of resources) {
    const identifier = resource['@_identifier'];
    if (typeof identifier !== 'string') continue;
    const loms = children(resource, 'metadata').flatMap((metadata) => children(metadata, 'lom'));
    const lom = readLom(loms);
    if (lom.baseId !== undefined || lom.searchMetaData !== undefined) {
      byResource.set(identifier, lom);
    }
  }
  return byResource;
}

/**
 * Fill each PIE item's `baseId` and `searchMetaData` from its resource's LOM. A value the item
 * already has wins, so a fresh sidecar's source model is unchanged.
 */
export function applyPieResourceLom(output: TransformOutput, lom: PieResourceLom | undefined): void {
  if (!lom) return;
  for (const item of output.items) {
    const content = item.content;
    if (item.format !== 'pie' || !content || typeof content !== 'object') continue;
    if (lom.baseId !== undefined && !content.baseId) {
      content.baseId = lom.baseId;
    }
    if (lom.searchMetaData !== undefined) {
      content.searchMetaData = { ...lom.searchMetaData, ...(content.searchMetaData ?? {}) };
    }
  }
}

function readLom(loms: XmlNode[]): PieResourceLom {
  const result: PieResourceLom = {};
  for (const identifier of loms
    .flatMap((lom) => children(lom, 'general'))
    .flatMap((general) => children(general, 'identifier'))) {
    if (text(children(identifier, 'catalog')[0]) !== PIE_LOM_BASE_ID_CATALOG) continue;
    const entry = text(children(identifier, 'entry')[0]);
    if (entry) {
      result.baseId = entry;
      break;
    }
  }

  const searchMetaData: Record<string, unknown> = {};
  for (const classification of loms.flatMap((lom) => children(lom, 'classification'))) {
    const taxonPath = [...children(classification, 'taxonPath'), ...children(classification, 'taxonpath')][0];
    const source = taxonPath ? langStringText(children(taxonPath, 'source')[0]) : undefined;
    if (!taxonPath || !source?.startsWith(PIE_LOM_SEARCH_METADATA_SOURCE)) continue;
    const key = source.slice(PIE_LOM_SEARCH_METADATA_SOURCE.length);
    if (!key) continue;
    const typed = decodeJson(langStringText(children(classification, 'description')[0]));
    if (typed.ok) {
      searchMetaData[key] = typed.value;
      continue;
    }
    const entries = children(taxonPath, 'taxon')
      .map((taxon) => langStringText(children(taxon, 'entry')[0]))
      .filter((entry): entry is string => entry !== undefined);
    if (entries.length === 1) searchMetaData[key] = entries[0];
    else if (entries.length > 1) searchMetaData[key] = entries;
  }
  if (Object.keys(searchMetaData).length > 0) result.searchMetaData = searchMetaData;
  return result;
}

function decodeJson(raw: string | undefined): { ok: true; value: unknown } | { ok: false } {
  if (raw === undefined) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** The first `string` (or LOM 1.2 `langstring`) of a LangString element. */
function langStringText(node: unknown): string | undefined {
  if (!isNode(node)) return undefined;
  return text([...children(node, 'string'), ...children(node, 'langstring')][0]);
}

function text(node: unknown): string | undefined {
  if (typeof node === 'string') return node;
  if (isNode(node) && typeof node['#text'] === 'string') return node['#text'];
  if (isNode(node)) return '';
  return undefined;
}

function children(node: unknown, name: string): XmlNode[] {
  if (!isNode(node)) return [];
  const value = node[name];
  if (!Array.isArray(value)) return [];
  return value.map((child) => (isNode(child) ? child : { '#text': child }));
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
