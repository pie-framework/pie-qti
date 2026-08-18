import {
  type AnalyzedContentPackage,
  analyzeContentPackage,
  type PackageFileAccess,
} from '@pie-qti/ims-cp-core';

/**
 * One QTI item resource exploded from a package, ready to be threaded through the
 * pre-conversion QTI transform stage (ADR 004). `sourcePath` is the resolved href
 * of the item resource within the package; the layered pipeline uses it to feed the
 * transformed QTI' back into the conversion's file access.
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
}

/**
 * Explode a QTI package into its readable item resources' raw XML, without
 * converting. This is the pre-conversion seam for the layered transform pipeline:
 * the QTI transform stage runs over each item's QTI XML before the fixed
 * QTI -> PIE conversion (ADR 004).
 *
 * Item resources that have no resolved source path or cannot be read are skipped
 * here (the conversion records the same skip), so callers only see items that have
 * real QTI XML to transform. The enumeration deliberately mirrors the converter's
 * own item loop so the QTI stage sees exactly the items the conversion will convert.
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
  return { packageGraph, items };
}
