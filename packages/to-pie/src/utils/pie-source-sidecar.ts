/**
 * PIE source sidecar reading
 *
 * pie-to-qti2 writes the PIE item an exported QTI item came from beside it as `<item>.pie.json`,
 * listed under the item's `<resource>`. The sidecar only adds fidelity, so a value that does not
 * match the contract is reported and the item is transformed from its QTI body.
 */

import { PIE_SOURCE_SIDECAR_FORMAT, type PieSourceSidecar } from '@pie-qti/transform-types';

/**
 * The sidecar, from its parsed value or its JSON text; `null` when it does not match the contract.
 */
export function readPieSourceSidecar(value: unknown): PieSourceSidecar | null {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) {
    return null;
  }
  if (parsed.format !== PIE_SOURCE_SIDECAR_FORMAT || parsed.version !== 1 || !isRecord(parsed.sourceModel)) {
    return null;
  }
  return parsed as unknown as PieSourceSidecar;
}

/**
 * The sidecar among a package resource's files.
 */
export function findPieSourceSidecarPath(resourceFiles: readonly string[]): string | undefined {
  return resourceFiles.find((file) => /\.pie\.json$/i.test(file));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
