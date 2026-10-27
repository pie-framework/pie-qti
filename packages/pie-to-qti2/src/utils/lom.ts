/**
 * IEEE LOM for content package resources
 *
 * The QTI 2.2 content packaging profile admits IEEE LOM (`http://ltsc.ieee.org/xsd/LOM`) in a
 * resource's `<metadata>`. A resource's title, description and language go in `general`; a PIE
 * item's `baseId` and `extensions` follow the encoding in `@pie-qti/transform-types`
 * (`PIE_LOM_BASE_ID_CATALOG`, `PIE_LOM_EXTENSION_SOURCE`), as do its `curriculumStandards` and
 * `skillLevels`, which QTI 3 also carries as Curriculum Standards Metadata.
 */

import {
  type CurriculumStandard,
  LOM_SKILL_LEVEL_PURPOSE,
  PIE_LOM_BASE_ID_CATALOG,
  PIE_LOM_CURRICULUM_STANDARD_SOURCE,
  PIE_LOM_EXTENSION_SOURCE,
  PIE_LOM_NONE_APPLIES_SOURCE,
  PIE_LOM_SKILL_LEVEL_SOURCE,
  type SkillLevel,
} from '@pie-qti/transform-types';

export const LOM_NAMESPACE = 'http://ltsc.ieee.org/xsd/LOM';
export const LOM_SCHEMA_LOCATION = 'http://www.imsglobal.org/xsd/imsmd_loose_v1p3p2.xsd';

export interface ResourceLom {
  baseId?: string;
  title?: string;
  description?: string;
  language?: string;
  extensions?: Record<string, unknown>;
  curriculumStandards?: CurriculumStandard[];
  skillLevels?: SkillLevel[];
}

type LomNode = [name: string, content: string | LomNode[], attributes?: string];

/**
 * `<imsmd:lom>` lines for a resource, indented by `indent`; empty when there is nothing to carry.
 * The `imsmd` prefix is bound to {@link LOM_NAMESPACE} on the manifest root.
 */
export function renderResourceLom(lom: ResourceLom, indent: string): string[] {
  const general: LomNode[] = [];
  if (lom.baseId) {
    general.push([
      'identifier',
      [
        ['catalog', PIE_LOM_BASE_ID_CATALOG],
        ['entry', lom.baseId],
      ],
    ]);
  }
  if (lom.title) general.push(langString('title', lom.title, lom.language));
  if (lom.language) general.push(['language', lom.language]);
  if (lom.description) general.push(langString('description', lom.description, lom.language));

  const categories: LomNode[] = [];
  if (general.length > 0) categories.push(['general', general]);
  for (const [key, value] of Object.entries(lom.extensions ?? {})) {
    if (value !== undefined) categories.push(classification(key, value));
  }
  categories.push(...standardClassifications(lom.curriculumStandards), ...skillLevelClassifications(lom.skillLevels));
  if (categories.length === 0) return [];
  return renderNode(['lom', categories], indent);
}

/**
 * `<imscsmd:curriculumStandardsMetadataSet>` lines for a resource's standards, indented by `indent`;
 * empty when there are none. The `imscsmd` prefix is bound to `QTI3_CSM_NAMESPACE` on the manifest root.
 */
export function renderCurriculumStandardsMetadata(standards: CurriculumStandard[] | undefined, indent: string): string[] {
  const runs: CurriculumStandard[][] = [];
  for (const standard of standards ?? []) {
    const run = runs.at(-1);
    if (run && run[0].providerId === standard.providerId) run.push(standard);
    else runs.push([standard]);
  }
  if (runs.length === 0) return [];
  const metadata = runs.map((run): LomNode => [
    'curriculumStandardsMetadata',
    [
      [
        'setOfGUIDs',
        run.map((standard): LomNode => [
          'labelledGUID',
          [
            ...(standard.label === undefined ? [] : [['label', standard.label] as LomNode]),
            ...(standard.caseItemURI === undefined ? [] : [['caseItemURI', standard.caseItemURI] as LomNode]),
            ['GUID', standard.guid],
          ],
        ]),
      ],
    ],
    `providerId="${escapeXml(run[0].providerId)}"`,
  ]);
  return renderNode(['curriculumStandardsMetadataSet', metadata], indent, 'imscsmd');
}

function standardClassifications(standards: CurriculumStandard[] | undefined): LomNode[] {
  if (!standards) return [];
  if (standards.length === 0) return [noneApplies('curriculumStandards')];
  const nodes: LomNode[] = [];
  for (const { providerId, guid, purpose, primary, provenance, derivedFrom } of standards) {
    if (purpose !== undefined) nodes.push(purposeClassification(purpose, providerId, guid));
    const members = definedMembers({ primary, provenance, derivedFrom });
    if (members) nodes.push(pieClassification(PIE_LOM_CURRICULUM_STANDARD_SOURCE, providerId, guid, members));
  }
  return nodes;
}

function skillLevelClassifications(levels: SkillLevel[] | undefined): LomNode[] {
  if (!levels) return [];
  if (levels.length === 0) return [noneApplies('skillLevels')];
  return levels.flatMap(({ source, id, rationale }) => {
    const members = definedMembers({ rationale });
    return [
      purposeClassification(LOM_SKILL_LEVEL_PURPOSE, source, id),
      ...(members ? [pieClassification(PIE_LOM_SKILL_LEVEL_SOURCE, source, id, members)] : []),
    ];
  });
}

function purposeClassification(purpose: string, source: string, id: string): LomNode {
  return [
    'classification',
    [
      [
        'purpose',
        [
          ['source', 'LOMv1.0'],
          ['value', purpose],
        ],
      ],
      ['taxonPath', [langString('source', source), ['taxon', [['id', id]]]]],
    ],
  ];
}

function pieClassification(source: string, first: string, second: string, members: Record<string, unknown>): LomNode {
  return [
    'classification',
    [
      ['taxonPath', [langString('source', source), ['taxon', [['id', first]]], ['taxon', [['id', second]]]]],
      langString('description', JSON.stringify(members)),
    ],
  ];
}

function noneApplies(field: string): LomNode {
  return ['classification', [['taxonPath', [langString('source', PIE_LOM_NONE_APPLIES_SOURCE), ['taxon', [['id', field]]]]]]];
}

function definedMembers(members: Record<string, unknown>): Record<string, unknown> | undefined {
  const defined = Object.fromEntries(Object.entries(members).filter(([, value]) => value !== undefined));
  return Object.keys(defined).length > 0 ? defined : undefined;
}

function classification(key: string, value: unknown): LomNode {
  const values = (Array.isArray(value) ? value : [value]).filter((entry) => entry !== null && entry !== undefined);
  const children: LomNode[] = [
    [
      'taxonPath',
      [
        langString('source', `${PIE_LOM_EXTENSION_SOURCE}${key}`),
        ...values.map((entry): LomNode => [
          'taxon',
          [langString('entry', typeof entry === 'string' ? entry : JSON.stringify(entry))],
        ]),
      ],
    ],
  ];
  if (typeof value !== 'string') children.push(langString('description', JSON.stringify(value)));
  return ['classification', children];
}

function langString(name: string, text: string, language = 'x-none'): LomNode {
  return [name, [['string', text, `language="${escapeXml(language)}"`]]];
}

function renderNode([name, content, attributes]: LomNode, indent: string, prefix = 'imsmd'): string[] {
  const open = `${prefix}:${name}${attributes ? ` ${attributes}` : ''}`;
  if (typeof content === 'string') {
    return [`${indent}<${open}>${escapeXml(content)}</${prefix}:${name}>`];
  }
  return [
    `${indent}<${open}>`,
    ...content.flatMap((child) => renderNode(child, `${indent}  `, prefix)),
    `${indent}</${prefix}:${name}>`,
  ];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
