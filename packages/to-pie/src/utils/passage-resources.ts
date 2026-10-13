/**
 * Passage resources
 *
 * Which of a package's resources hold stimulus content, and the index an item uses to name the
 * passage it references. Analysis converts these resources as the package's passages under their
 * manifest resource identifier, and the item body partition resolves an item's passage
 * references against the same set, so the identifier on a converted item names a passage the
 * package analysis converted.
 */

import {
  type AnalyzedContentPackage,
  type PackageResourceNode,
  resolveCheckedPackagePathFromFile,
} from '@pie-qti/ims-cp-core';

export type ReadablePackageResourceNode = PackageResourceNode & { resolvedHref: string };

/**
 * `manifest.passages` is not this set: the manifest parser counts every `type="webcontent"`
 * resource as a passage, which in a real package is the catch-all for stylesheets, images and
 * fonts. Reading all of those as text and converting them would turn a stylesheet into a
 * passage whose text is CSS, on a delivery where every item references two of them.
 *
 * So a resource qualifies when the package graph classified it as a passage from its declared
 * type, or when it is web content an item declares a dependency on — the shape a shared stimulus
 * usually takes, since an item points at it through `<object data="reading.html">` and the
 * manifest carries the target as `webcontent`. Web content is additionally required to be markup
 * by extension, because a dependency can name an asset as readily as a document.
 */
const PASSAGE_MARKUP_EXTENSIONS = ['.xml', '.html', '.htm', '.xhtml'];

export function passageResourceNodes(
  packageGraph: AnalyzedContentPackage
): ReadablePackageResourceNode[] {
  const itemDependencies = new Set<string>();
  for (const item of packageGraph.manifest.items) {
    for (const dependency of packageGraph.resources.get(item.identifier)?.dependencies ?? []) {
      itemDependencies.add(dependency);
    }
  }

  const nodes: ReadablePackageResourceNode[] = [];
  for (const node of packageGraph.resources.values()) {
    const resolvedHref = node.resolvedHref;
    if (!resolvedHref) {
      continue;
    }
    if (node.kind === 'passage') {
      nodes.push({ ...node, resolvedHref });
      continue;
    }
    const lowerHref = resolvedHref.toLowerCase();
    if (
      node.kind === 'webcontent' &&
      itemDependencies.has(node.identifier) &&
      PASSAGE_MARKUP_EXTENSIONS.some((extension) => lowerHref.endsWith(extension))
    ) {
      nodes.push({ ...node, resolvedHref });
    }
  }
  return nodes;
}

/** Resolves an href in an item to the manifest resource identifier of the passage it names. */
export interface PassageResourceIndex {
  resolve(href: string): string | undefined;
}

/**
 * The passage resources of a package, keyed by path. An href resolves relative to the item's own
 * path, and matches exactly or, failing that, case-insensitively, since packages authored on
 * case-insensitive file systems reference `Passage.html` as `passage.html`. Without a package or
 * an item path nothing resolves.
 */
export function passageResourceIndex(
  packageGraph: AnalyzedContentPackage | undefined,
  sourcePath: string | undefined
): PassageResourceIndex {
  if (!packageGraph || !sourcePath) {
    return { resolve: () => undefined };
  }
  const byPath = new Map<string, string>();
  const byLowerPath = new Map<string, string>();
  for (const node of passageResourceNodes(packageGraph)) {
    byPath.set(node.resolvedHref, node.identifier);
    if (!byLowerPath.has(node.resolvedHref.toLowerCase())) {
      byLowerPath.set(node.resolvedHref.toLowerCase(), node.identifier);
    }
  }
  const lookup = (path: string | null) =>
    path ? (byPath.get(path) ?? byLowerPath.get(path.toLowerCase())) : undefined;
  return {
    resolve(href) {
      const path = href.trim().replace(/[?#].*$/, '');
      return (
        lookup(resolveCheckedPackagePathFromFile(sourcePath, path)) ??
        lookup(resolveCheckedPackagePathFromFile(sourcePath, decodedPath(path)))
      );
    },
  };
}

/** Manifests and item bodies disagree on percent-encoding, so a match is tried both ways. */
function decodedPath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}
