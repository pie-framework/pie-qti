/**
 * PIE item metadata carried as LOM on a package resource
 *
 * pie-to-qti2 writes a PIE item's `baseId` and `extensions` as LOM on the item's `<resource>`, and
 * its `curriculumStandards` and `skillLevels` as CSM and LOM (encoding in `@pie-qti/transform-types`
 * `pie-lom`). Element names are matched by local name, so either LOM binding is read. `baseId` and
 * `extensions` count only under the PIE catalog and source markers; standards and skill levels are
 * read from any package, and only their PIE extensions need the PIE sources.
 */

import {
  type CurriculumStandard,
  LOM_SKILL_LEVEL_PURPOSE,
  PIE_LOM_BASE_ID_CATALOG,
  PIE_LOM_CURRICULUM_STANDARD_SOURCE,
  PIE_LOM_EXTENSION_SOURCE,
  PIE_LOM_LEGACY_EXTENSION_SOURCE,
  PIE_LOM_NONE_APPLIES_SOURCE,
  PIE_LOM_SKILL_LEVEL_SOURCE,
  type SkillLevel,
  type TransformOutput,
} from '@pie-qti/transform-types';
import { XMLParser } from 'fast-xml-parser';

export interface PieResourceLom {
  baseId?: string;
  extensions?: Record<string, unknown>;
  curriculumStandards?: CurriculumStandard[];
  skillLevels?: SkillLevel[];
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
    const metadata = children(resource, 'metadata');
    const loms = metadata.flatMap((node) => children(node, 'lom'));
    const lom = { ...readLom(loms), ...readAlignments(metadata, loms) };
    if (Object.values(lom).some((value) => value !== undefined)) {
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
    if (lom.curriculumStandards !== undefined && content.curriculumStandards === undefined) {
      content.curriculumStandards = lom.curriculumStandards;
    }
    if (lom.skillLevels !== undefined && content.skillLevels === undefined) {
      content.skillLevels = lom.skillLevels;
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

interface LomClassification {
  purpose?: string;
  source?: string;
  /** The first taxonPath's taxa: `id`, else the entry text. */
  taxa: string[];
  description?: string;
}

/**
 * Standards from CSM, skill levels from LOM purpose "skill level", then each one's `purpose` and
 * PIE extensions from the classifications that name it. A field is `[]` only when the package
 * says none applies.
 */
function readAlignments(
  metadata: XmlNode[],
  loms: XmlNode[]
): Pick<PieResourceLom, 'curriculumStandards' | 'skillLevels'> {
  const standards: CurriculumStandard[] = [];
  for (const csm of metadata
    .flatMap((node) => children(node, 'curriculumStandardsMetadataSet'))
    .flatMap((set) => children(set, 'curriculumStandardsMetadata'))) {
    const providerId = trimmed(csm['@_providerId']);
    if (!providerId) continue;
    for (const labelled of children(csm, 'setOfGUIDs').flatMap((set) => children(set, 'labelledGUID'))) {
      const guid = trimmed(text(children(labelled, 'GUID')[0]));
      if (!guid) continue;
      const caseItemURI = trimmed(text(children(labelled, 'caseItemURI')[0]));
      const label = trimmed(text(children(labelled, 'label')[0]));
      standards.push({
        providerId,
        guid,
        ...(caseItemURI === undefined ? {} : { caseItemURI }),
        ...(label === undefined ? {} : { label }),
      });
    }
  }

  const classifications = loms.flatMap((lom) => children(lom, 'classification')).map(readClassification);
  const skillLevels: SkillLevel[] = [];
  const noneApplies = new Set<string>();
  for (const { purpose, source, taxa } of classifications) {
    const id = taxa.at(-1);
    if (purpose === LOM_SKILL_LEVEL_PURPOSE && source && id) skillLevels.push({ source, id });
    if (purpose === undefined && source === PIE_LOM_NONE_APPLIES_SOURCE) taxa.forEach((field) => noneApplies.add(field));
  }

  const standard = (providerId: string | undefined, guid: string | undefined) =>
    standards.find((entry) => entry.providerId === providerId && entry.guid.toLowerCase() === guid?.toLowerCase());
  for (const { purpose, source, taxa, description } of classifications) {
    if (purpose !== undefined && purpose !== LOM_SKILL_LEVEL_PURPOSE) {
      const entry = standard(source, taxa.at(-1));
      if (entry && entry.purpose === undefined) entry.purpose = purpose;
      continue;
    }
    if (purpose !== undefined) continue;
    const members = decodeJson(description);
    if (!members.ok || !isNode(members.value)) continue;
    const { primary, provenance, derivedFrom, rationale } = members.value;
    if (source === PIE_LOM_CURRICULUM_STANDARD_SOURCE) {
      const entry = standard(taxa[0], taxa[1]);
      if (!entry) continue;
      if (typeof primary === 'boolean') entry.primary = primary;
      if (typeof provenance === 'string') entry.provenance = provenance as CurriculumStandard['provenance'];
      if (isNode(derivedFrom) && typeof derivedFrom.providerId === 'string' && typeof derivedFrom.guid === 'string') {
        entry.derivedFrom = { providerId: derivedFrom.providerId, guid: derivedFrom.guid };
      }
    } else if (source === PIE_LOM_SKILL_LEVEL_SOURCE) {
      const entry = skillLevels.find((level) => level.source === taxa[0] && level.id === taxa[1]);
      if (entry && typeof rationale === 'string') entry.rationale = rationale;
    }
  }

  return {
    curriculumStandards:
      standards.length > 0 ? standards : noneApplies.has('curriculumStandards') ? [] : undefined,
    skillLevels: skillLevels.length > 0 ? skillLevels : noneApplies.has('skillLevels') ? [] : undefined,
  };
}

function readClassification(classification: XmlNode): LomClassification {
  const purpose = children(classification, 'purpose')[0];
  const taxonPath = [...children(classification, 'taxonPath'), ...children(classification, 'taxonpath')][0];
  return {
    purpose: purpose ? trimmed(text(children(purpose, 'value')[0])) : undefined,
    source: taxonPath ? trimmed(langStringText(children(taxonPath, 'source')[0])) : undefined,
    taxa: children(taxonPath, 'taxon')
      .map((taxon) => trimmed(text(children(taxon, 'id')[0])) ?? trimmed(langStringText(children(taxon, 'entry')[0])))
      .filter((value): value is string => value !== undefined),
    description: langStringText(children(classification, 'description')[0]),
  };
}

/** Text with surrounding whitespace removed; empty reads as absent. */
function trimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result === '' ? undefined : result;
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
