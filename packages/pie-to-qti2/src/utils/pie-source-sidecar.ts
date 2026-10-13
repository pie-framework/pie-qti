/**
 * PIE source sidecar
 *
 * The PIE item an exported QTI item came from is written beside it as JSON, since QTI 2.2 admits no
 * foreign elements in `assessmentItem`. The contract is `PieSourceSidecar` in
 * `@pie-qti/transform-types`; to-pie reads it back.
 */

/**
 * Path of an item's sidecar: the item path with `.xml` replaced by `.pie.json`.
 */
export function pieSourceSidecarPath(itemPath: string): string {
  return `${itemPath.replace(/\.xml$/i, '')}.pie.json`;
}
