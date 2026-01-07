/**
 * QTI Extension Embedder
 *
 * Utilities for embedding QTI source XML in PIE items for lossless round-trips
 */

import type { PieItem } from '@pie-qti/transform-types';

export const QTI_NAMESPACE = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
export const QTI_PREFIX = 'qti';

export interface QtiExtensionMetadata {
  generator?: {
    package: string;
    version: string;
  };
  timestamp?: Date;
  qtiVersion?: '2.2';
}

/**
 * Embed original QTI XML in PIE item for lossless round-trip
 */
export function embedQtiSourceInPie(
  pieItem: PieItem,
  originalQtiXml: string,
  metadata?: QtiExtensionMetadata
): PieItem {
  return {
    ...pieItem,
    metadata: {
      ...pieItem.metadata,
      qtiSource: {
        xml: originalQtiXml,
        metadata: {
          generator: metadata?.generator || {
            package: '@pie-qti/qti2-to-pie',
            version: '1.0.0',
          },
          timestamp: metadata?.timestamp || new Date(),
          qtiVersion: '2.2',
        },
      },
    },
  };
}

/**
 * Extract original QTI XML from PIE item
 */
export function extractQtiSourceFromPie(pieItem: PieItem): string | null {
  return pieItem.metadata?.qtiSource?.xml || null;
}

/**
 * Check if PIE item has embedded QTI source
 */
export function hasQtiSource(pieItem: PieItem): boolean {
  return !!(pieItem.metadata?.qtiSource?.xml);
}
