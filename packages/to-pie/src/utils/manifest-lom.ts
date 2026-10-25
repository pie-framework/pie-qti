/**
 * PIE item metadata carried as LOM on a package resource
 *
 * pie-to-qti2 writes a PIE item's `baseId` and `extensions` as LOM on the item's `<resource>`
 * (encoding in `@pie-qti/transform-types` `pie-lom`). Element names are matched by local name, so
 * either LOM binding is read, and only entries carrying the PIE catalog and source markers count.
 */

import {
  PIE_LOM_BASE_ID_CATALOG,
  PIE_LOM_EXTENSION_SOURCE,
  PIE_LOM_LEGACY_EXTENSION_SOURCE,
  type TransformOutput,
} from '@pie-qti/transform-types';
import { XMLParser } from 'fast-xml-parser';

export interface PieResourceLom {
  baseId?: string;
  extensions?: Record<string, unknown>;
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
    if (lom.baseId !== undefined || lom.extensions !== undefined) {
      byResource.set(identifier, lom);
    }
  }
  return byResource;
}

/**
 * Fill each PIE item's `baseId` and `extensions` from its resource's LOM. A value the item
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
    if (lom.extensions !== undefined) {
      content.extensions = { ...lom.extensions, ...(content.extensions ?? {}) };
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

  // A key under the current prefix wins over the same key under the legacy one.
  const legacy: Record<string, unknown> = {};
  const current: Record<string, unknown> = {};
  for (const classification of loms.flatMap((lom) => children(lom, 'classification'))) {
    const taxonPath = [...children(classification, 'taxonPath'), ...children(classification, 'taxonpath')][0];
    const source = taxonPath ? langStringText(children(taxonPath, 'source')[0]) : undefined;
    const prefix = [PIE_LOM_EXTENSION_SOURCE, PIE_LOM_LEGACY_EXTENSION_SOURCE].find((p) => source?.startsWith(p));
    if (!taxonPath || !source || !prefix) continue;
    const key = source.slice(prefix.length);
    if (!key) continue;
    const target = prefix === PIE_LOM_EXTENSION_SOURCE ? current : legacy;
    const typed = decodeJson(langStringText(children(classification, 'description')[0]));
    if (typed.ok) {
      target[key] = typed.value;
      continue;
    }
    const entries = children(taxonPath, 'taxon')
      .map((taxon) => langStringText(children(taxon, 'entry')[0]))
      .filter((entry): entry is string => entry !== undefined);
    if (entries.length === 1) target[key] = entries[0];
    else if (entries.length > 1) target[key] = entries;
  }
  const extensions = { ...legacy, ...current };
  if (Object.keys(extensions).length > 0) result.extensions = extensions;
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
