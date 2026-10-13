/**
 * QTI Manifest (imsmanifest.xml) parser
 *
 * Parses IMS Content Package manifests to extract:
 * - Resource definitions (items, passages, assessments)
 * - Dependencies between resources
 * - File locations and types
 */

import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { PassageRegistry } from './passage-reusability.js';

/**
 * QTI resource type
 */
export type ResourceType =
  | 'imsqti_item_xmlv2p1'
  | 'imsqti_item_xmlv2p2'
  | 'imsqti_test_xmlv2p1'
  | 'imsqti_test_xmlv2p2'
  | 'imsqti_assessment_xmlv2p1'
  | 'imsqti_apip_xmlv2p2'
  | 'webcontent'
  | 'associatedcontent/imsqti_item_xmlv2p1'
  | string;

/**
 * Manifest resource entry
 */
export interface ManifestResource {
  /** Resource identifier */
  identifier: string;
  /** Resource type */
  type: ResourceType;
  /**
   * Optional xml:base for this resource element.
   * Used by IMS CP to resolve relative hrefs when packages use nested bases.
   */
  xmlBase?: string;
  /** Main file href */
  href?: string;
  /** All files in this resource */
  files: string[];
  /** Dependencies (identifierrefs) */
  dependencies: string[];
  /** Metadata */
  metadata?: {
    title?: string;
    description?: string;
    /** IMS LOM language code (e.g., "en-US", "es-ES") */
    language?: string;
  };
}

/**
 * Parsed manifest structure
 */
export interface ParsedManifest {
  /** Manifest identifier */
  identifier?: string;
  /**
   * Optional xml:base at the manifest element level.
   * Used by IMS CP to resolve relative hrefs.
   */
  xmlBase?: string;
  /** All resources */
  resources: Map<string, ManifestResource>;
  /** Item resources */
  items: ManifestResource[];
  /** Passage/stimulus resources */
  passages: ManifestResource[];
  /** Test/assessment resources */
  tests: ManifestResource[];
  /** Base path for resolving relative paths */
  basePath?: string;
}

/**
 * Parse QTI manifest XML
 */
export function parseManifest(manifestXml: string, basePath?: string): ParsedManifest {
  const doc = parse(manifestXml, {
    lowerCaseTagName: false,
    comment: false,
  });

  const manifest = doc.querySelector('manifest') || doc.getElementsByTagName('manifest')[0];

  if (!manifest) {
    throw new Error('No manifest element found in XML');
  }

  const manifestId = manifest.getAttribute('identifier');
  const manifestXmlBase = manifest.getAttribute('xml:base') || undefined;

  // Parse all resources
  const resourcesElement = manifest.querySelector('resources') ||
                          manifest.getElementsByTagName('resources')[0];

  if (!resourcesElement) {
    return {
      identifier: manifestId,
      resources: new Map(),
      items: [],
      passages: [],
      tests: [],
      basePath,
    };
  }

  const resourceElements = resourcesElement.getElementsByTagName('resource');
  const resources = new Map<string, ManifestResource>();
  const items: ManifestResource[] = [];
  const passages: ManifestResource[] = [];
  const tests: ManifestResource[] = [];

  for (const resourceEl of Array.from(resourceElements)) {
    const resource = parseResource(resourceEl);
    resources.set(resource.identifier, resource);

    // Categorize by type
    if (isItemType(resource.type)) {
      items.push(resource);
    } else if (isPassageType(resource.type)) {
      passages.push(resource);
    } else if (isTestType(resource.type)) {
      tests.push(resource);
    }
  }

  return {
    identifier: manifestId,
    xmlBase: manifestXmlBase,
    resources,
    items,
    passages,
    tests,
    basePath,
  };
}

/**
 * Parse individual resource element
 */
function parseResource(resourceEl: HTMLElement): ManifestResource {
  const identifier = resourceEl.getAttribute('identifier') || '';
  const type = resourceEl.getAttribute('type') || '';
  const href = resourceEl.getAttribute('href') || undefined;
  const xmlBase = resourceEl.getAttribute('xml:base') || undefined;

  // Extract all file elements
  const fileElements = resourceEl.getElementsByTagName('file');
  const files = Array.from(fileElements)
    .map(f => f.getAttribute('href'))
    .filter((h): h is string => !!h);

  // If href not specified but files exist, use first file as href
  const mainHref = href || (files.length > 0 ? files[0] : undefined);

  // Extract dependencies
  const depElements = resourceEl.getElementsByTagName('dependency');
  const dependencies = Array.from(depElements)
    .map(d => d.getAttribute('identifierref'))
    .filter((id): id is string => !!id);

  const metadataEl = resourceEl.querySelector('metadata');
  const metadata = metadataEl ? parseResourceMetadata(metadataEl) : undefined;

  return {
    identifier,
    type,
    xmlBase,
    href: mainHref,
    files,
    dependencies,
    metadata,
  };
}

/**
 * Title, description and language of a resource's `<metadata>`
 *
 * LOM is matched by local name, so a prefixed binding (`imsmd:title`) reads the same as an unprefixed
 * one, and LangString text comes from its first `string` (or LOM 1.2 `langstring`). When the metadata
 * holds LOM, only `general` is read: a `classification` description is not the resource's.
 */
function parseResourceMetadata(metadataEl: HTMLElement): ManifestResource['metadata'] {
  let title: string | undefined;
  let description: string | undefined;
  let language: string | undefined;

  const loms = descendantsNamed(metadataEl, 'lom');
  if (loms.length > 0) {
    const general = loms.flatMap((lom) => childrenNamed(lom, 'general'))[0];
    if (general) {
      title = langStringText(childrenNamed(general, 'title')[0]);
      description = langStringText(childrenNamed(general, 'description')[0]);
      language = textOf(childrenNamed(general, 'language')[0]);
    }
  } else {
    title = langStringText(descendantsNamed(metadataEl, 'title')[0]);
    description = langStringText(descendantsNamed(metadataEl, 'description')[0]);
    const languageEl = descendantsNamed(metadataEl, 'language')[0] ||
                       metadataEl.querySelector('[\\:language]') ||
                       metadataEl.querySelector('[name="language"]');
    language = textOf(languageEl ?? undefined);
  }

  return title || description || language ? { title, description, language } : undefined;
}

function langStringText(el: HTMLElement | undefined): string | undefined {
  if (!el) return undefined;
  const string = [...childrenNamed(el, 'string'), ...childrenNamed(el, 'langstring')][0];
  return textOf(string ?? el);
}

function textOf(el: HTMLElement | undefined): string | undefined {
  return el?.textContent?.trim() || undefined;
}

/** Tag name without its namespace prefix, lowercased. */
function localName(el: HTMLElement): string {
  return (el.rawTagName ?? '').replace(/^[^:]*:/, '').toLowerCase();
}

function childrenNamed(el: HTMLElement, name: string): HTMLElement[] {
  return el.children.filter((child) => localName(child) === name);
}

function descendantsNamed(el: HTMLElement, name: string): HTMLElement[] {
  return el.children.flatMap((child) => [
    ...(localName(child) === name ? [child] : []),
    ...descendantsNamed(child, name),
  ]);
}

/**
 * Check if resource type is an item
 */
function isItemType(type: string): boolean {
  return type.includes('imsqti_item') ||
         type.includes('qti_item') ||
         type === 'associatedcontent/imsqti_item_xmlv2p1';
}

/**
 * Check if resource type is a passage/stimulus
 */
function isPassageType(type: string): boolean {
  return type === 'webcontent' ||
         type.includes('passage') ||
         type.includes('stimulus') ||
         type.includes('apip');
}

/**
 * Check if resource type is a test/assessment
 */
function isTestType(type: string): boolean {
  return type.includes('test') || type.includes('assessment');
}

/**
 * Build passage registry from manifest
 *
 * Analyzes manifest to identify:
 * - Which passages are referenced by items
 * - Which passages are reusable (multiple items reference them)
 */
export function buildPassageRegistryFromManifest(
  manifest: ParsedManifest
): PassageRegistry {
  const registry = new PassageRegistry();

  // Register all passage resources
  for (const passage of manifest.passages) {
    // Find all items that depend on this passage
    for (const item of manifest.items) {
      if (item.dependencies.includes(passage.identifier)) {
        registry.registerReference(item.identifier, {
          id: passage.identifier,  // Use QTI identifier directly
          source: 'manifest',
          qtiIdentifier: passage.identifier,
          filePath: passage.href,
          isReusable: false,  // Will be updated by registry
        });
      }
    }
  }

  return registry;
}

/**
 * Get passage content file path from manifest
 */
export function getPassageFilePath(
  manifest: ParsedManifest,
  passageId: string
): string | undefined {
  const passage = manifest.resources.get(passageId);
  return passage?.href;
}

/**
 * Get all items that depend on a passage
 */
export function getItemsReferencingPassage(
  manifest: ParsedManifest,
  passageId: string
): ManifestResource[] {
  return manifest.items.filter(item =>
    item.dependencies.includes(passageId)
  );
}
