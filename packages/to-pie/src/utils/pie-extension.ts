/**
 * PIE source data read from the sidecar pie-to-qti2 writes beside an item, and the `data-pie-*`
 * attributes it writes on interactions.
 */

import type { HTMLElement } from 'node-html-parser';

export interface PieExtensionMetadata {
  /** Generator package and version */
  generator?: {
    package: string;
    version: string;
  };
  /** Original PIE element type */
  elementType?: string;
  /** Timestamp of transformation */
  timestamp?: Date;
  /** Additional custom metadata */
  [key: string]: any;
}

export interface PieExtensionData {
  /** Full PIE model from the PIE source sidecar */
  sourceModel: any;
  /** Generator metadata from the sidecar */
  metadata?: PieExtensionMetadata;
  /** Whether a usable PIE source was found */
  hasExtension: boolean;
}

/**
 * Extract data-* attributes from QTI elements for partial metadata preservation
 *
 * @param element - HTML element to extract attributes from
 * @returns Object with extracted data attributes
 */
export function extractDataAttributes(element: HTMLElement): Record<string, any> {
  const dataAttrs: Record<string, any> = {};
  const attrs = element.attributes || {};

  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('data-pie-')) {
      const pieKey = key.replace('data-pie-', '');
      // Try to parse as JSON for boolean/number values
      try {
        dataAttrs[pieKey] = JSON.parse(value);
      } catch {
        dataAttrs[pieKey] = value;
      }
    }
  }

  return dataAttrs;
}
