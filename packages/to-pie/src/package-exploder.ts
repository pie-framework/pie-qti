import {
  type AnalyzedContentPackage,
  analyzeContentPackage,
  type PackageFileAccess,
} from '@pie-qti/ims-cp-core';
import { passageResourceNodes } from './utils/passage-resources.js';

/**
 * One QTI item resource exploded from a package, for a caller that rewrites item XML before
 * converting it. `sourcePath` is the resolved href of the item resource within the package,
 * where the caller feeds the rewritten XML back into the conversion's file access.
 */
export interface QtiPackageItemSource {
  resourceId: string;
  sourcePath: string;
  xml: string;
}

export interface ExplodeQtiPackageItemsInput {
  packageId?: string;
  manifestXml: string;
  fileAccess: PackageFileAccess;
}

export interface ExplodedQtiPackageItems {
  packageGraph: AnalyzedContentPackage;
  items: QtiPackageItemSource[];
  /**
   * The package's stimulus documents' raw XML, enumerated the same way the items are. They
   * convert to passages through `convertQtiPassageDocument`, and are read here because the
   * package is already open.
   */
  passages: QtiPackagePassageSource[];
}

/**
 * One QTI stimulus document exploded from a package. `resourceId` is the manifest resource
 * identifier, which an item's passage reference names it by.
 */
export interface QtiPackagePassageSource {
  resourceId: string;
  sourcePath: string;
  xml: string;
  /** The manifest's title for the resource, when it declares one. */
  title?: string;
}

/**
 * Explode a QTI package into its readable item resources' raw XML, without
 * converting, so a caller can rewrite each item's XML before the QTI -> PIE conversion.
 *
 * Item resources that have no resolved source path or cannot be read are skipped
 * here (the conversion records the same skip), so callers only see items that have
 * real QTI XML to transform. The enumeration deliberately mirrors the converter's
 * own item loop so the caller sees exactly the items the conversion will convert.
 *
 * The package's stimulus documents come out alongside them; see {@link passageResourceNodes}
 * for which resources those are.
 */
export async function explodeQtiPackageItems(
  input: ExplodeQtiPackageItemsInput
): Promise<QtiPackageItemSource[]> {
  return (await explodeAnalyzedQtiPackageItems(input)).items;
}

export async function explodeAnalyzedQtiPackageItems(
  input: ExplodeQtiPackageItemsInput
): Promise<ExplodedQtiPackageItems> {
  const packageGraph = await analyzeContentPackage({
    packageId: input.packageId,
    manifestXml: input.manifestXml,
    fileAccess: input.fileAccess,
  });

  const items: QtiPackageItemSource[] = [];
  for (const item of packageGraph.manifest.items) {
    const node = packageGraph.resources.get(item.identifier);
    if (!node?.resolvedHref) {
      continue;
    }
    const xml = await input.fileAccess.readText(node.resolvedHref);
    if (!xml) {
      continue;
    }
    items.push({
      resourceId: node.identifier,
      sourcePath: node.resolvedHref,
      xml,
    });
  }

  const passages: QtiPackagePassageSource[] = [];
  for (const node of passageResourceNodes(packageGraph)) {
    const xml = await input.fileAccess.readText(node.resolvedHref);
    if (!xml) {
      continue;
    }
    passages.push({
      resourceId: node.identifier,
      sourcePath: node.resolvedHref,
      xml,
      ...(node.metadata?.title ? { title: node.metadata.title } : {}),
    });
  }

  return { packageGraph, items, passages };
}
