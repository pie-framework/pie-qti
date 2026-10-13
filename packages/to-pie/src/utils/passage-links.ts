/**
 * Passage links
 *
 * Which passages each converted item is linked to, and in what order. The passages the item body
 * partition resolved come first, in the order the body names them. A passage resource the item
 * declares as a manifest dependency without referencing it follows, in manifest order, so a
 * package that links its stimulus through the manifest alone still links it. When the body names
 * passages and the manifest declares more, the extra one is linked and reported: nothing in the
 * item says where it renders.
 *
 * The item carries every link as a reference, so what the item names, what an import links and
 * what a preview renders are one list. An import names the item by its converted id and the
 * passage by its manifest resource identifier, the same two identifiers the item's own reference
 * and the converted passage carry.
 */

import type { PackageResourceNode } from '@pie-qti/ims-cp-core';
import type {
  TransformOutput,
  TransformOutputItem,
  TransformWarning,
} from '@pie-qti/transform-types';
import type { QtiPassageReference } from './item-body-partition.js';
import type { ReadablePackageResourceNode } from './passage-resources.js';

export const PASSAGE_DEPENDENCY_UNREFERENCED = 'QTI_PASSAGE_DEPENDENCY_UNREFERENCED';

/** One of the package's passage resources, the set analysis converts, and the items linked to it. */
export interface QtiPackagePassage {
  /** The manifest resource identifier. */
  resourceId: string;
  sourcePath: string;
  resourceType: string;
  /** The manifest's title for the resource, when it declares one. */
  title?: string;
  /** In package order. */
  linkedItems: QtiPassageItemLink[];
}

export interface QtiPassageItemLink {
  /** The converted item's id. */
  itemId: string;
  itemResourceId: string;
  /** Where the passage stands among the item's passages, from 0. */
  position: number;
  via: QtiPassageReference['via'];
}

export interface ItemPassageLinks {
  /** The output, each item carrying the manifest dependencies it links to as references. */
  output: TransformOutput;
  links: Array<QtiPassageItemLink & { passageResourceId: string }>;
  warnings: TransformWarning[];
}

/**
 * The identifier an import names a converted item by: its id, which the plugin takes from the QTI
 * `identifier`, or else the resource's identifier, suffixed when the resource converted to more
 * than one item.
 */
export function transformedItemSourceIdentifier(
  content: unknown,
  resourceId: string,
  itemIndex: number
): string {
  const id = isRecord(content) && typeof content.id === 'string' ? content.id.trim() : '';
  if (id) {
    return id;
  }
  return itemIndex === 0 ? resourceId : `${resourceId}#${itemIndex + 1}`;
}

export function itemPassageLinks(
  node: PackageResourceNode,
  output: TransformOutput,
  passageNodes: ReadonlyMap<string, ReadablePackageResourceNode>
): ItemPassageLinks {
  const links: ItemPassageLinks['links'] = [];
  const warnings: TransformWarning[] = [];
  const declared = node.dependencies.filter((dependency) => passageNodes.has(dependency));
  const items = output.items.map((outputItem, itemIndex): TransformOutputItem => {
    if (outputItem.format !== 'pie') {
      return outputItem;
    }
    const itemId = transformedItemSourceIdentifier(outputItem.content, node.identifier, itemIndex);
    const references = qtiPassageReferences(outputItem.content);
    const dependencies: QtiPassageReference[] = declared
      .filter((dependency) => !references.some((reference) => reference.identifier === dependency))
      .map((dependency) => ({
        identifier: dependency,
        href: passageNodes.get(dependency)?.resolvedHref ?? '',
        via: 'manifest-dependency',
      }));
    if (references.length > 0) {
      for (const dependency of dependencies) {
        warnings.push({
          itemId,
          code: PASSAGE_DEPENDENCY_UNREFERENCED,
          message: `Item ${itemId} declares passage ${dependency.identifier} as a manifest dependency, but its body references ${references.map((reference) => reference.identifier).join(', ')}: ${dependency.identifier} is linked after them.`,
        });
      }
    }
    [...references, ...dependencies].forEach((reference, position) => {
      links.push({
        itemId,
        itemResourceId: node.identifier,
        passageResourceId: reference.identifier,
        position,
        via: reference.via,
      });
    });
    return dependencies.length > 0
      ? {
          ...outputItem,
          content: withPassageReferences(outputItem.content, references, dependencies),
        }
      : outputItem;
  });
  return { output: { ...output, items }, links, warnings };
}

/** The first reference is the item's passage, as the partition sets it for the body's. */
function withPassageReferences(
  content: unknown,
  references: QtiPassageReference[],
  dependencies: QtiPassageReference[]
): unknown {
  const item = isRecord(content) ? content : {};
  const metadata = isRecord(item.metadata) ? item.metadata : {};
  const [first] = references.length > 0 ? references : dependencies;
  return {
    ...item,
    passage: first?.identifier,
    metadata: { ...metadata, qtiPassageReferences: [...references, ...dependencies] },
  };
}

export function packagePassages(
  nodes: readonly ReadablePackageResourceNode[],
  links: ItemPassageLinks['links']
): QtiPackagePassage[] {
  return nodes.map((node) => ({
    resourceId: node.identifier,
    sourcePath: node.resolvedHref,
    resourceType: node.type,
    ...(node.metadata?.title ? { title: node.metadata.title } : {}),
    linkedItems: links
      .filter((link) => link.passageResourceId === node.identifier)
      .map(({ passageResourceId: _passageResourceId, ...link }) => link),
  }));
}

function qtiPassageReferences(content: unknown): QtiPassageReference[] {
  const metadata = isRecord(content) && isRecord(content.metadata) ? content.metadata : null;
  const references = metadata?.qtiPassageReferences;
  return Array.isArray(references)
    ? references.filter(
        (reference): reference is QtiPassageReference =>
          isRecord(reference) && typeof reference.identifier === 'string'
      )
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
