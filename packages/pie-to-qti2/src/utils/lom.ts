/**
 * IEEE LOM for content package resources
 *
 * The QTI 2.2 content packaging profile admits IEEE LOM (`http://ltsc.ieee.org/xsd/LOM`) in a
 * resource's `<metadata>`. A resource's title, description and language go in `general`; a PIE
 * item's `baseId` and `extensions` follow the encoding in `@pie-qti/transform-types`
 * (`PIE_LOM_BASE_ID_CATALOG`, `PIE_LOM_EXTENSION_SOURCE`).
 */

import { PIE_LOM_BASE_ID_CATALOG, PIE_LOM_EXTENSION_SOURCE } from '@pie-qti/transform-types';

export const LOM_NAMESPACE = 'http://ltsc.ieee.org/xsd/LOM';
export const LOM_SCHEMA_LOCATION = 'http://www.imsglobal.org/xsd/imsmd_loose_v1p3p2.xsd';

export interface ResourceLom {
  baseId?: string;
  title?: string;
  description?: string;
  language?: string;
  extensions?: Record<string, unknown>;
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
  if (categories.length === 0) return [];
  return renderNode(['lom', categories], indent);
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

function renderNode([name, content, attributes]: LomNode, indent: string): string[] {
  const open = `imsmd:${name}${attributes ? ` ${attributes}` : ''}`;
  if (typeof content === 'string') {
    return [`${indent}<${open}>${escapeXml(content)}</imsmd:${name}>`];
  }
  return [
    `${indent}<${open}>`,
    ...content.flatMap((child) => renderNode(child, `${indent}  `)),
    `${indent}</imsmd:${name}>`,
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
