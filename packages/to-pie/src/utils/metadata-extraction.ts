/**
 * Metadata Extraction Utilities
 *
 * Extracts a PIE item's extensions from QTI items
 */

import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';

/**
 * Extract a PIE item's extensions from a QTI item
 *
 * Priority 1: Check for PIE extension with embedded extensions (perfect reconstruction)
 * Priority 2: Parse QTI metadata section
 *
 * @param qtiXml - QTI XML string or parsed HTMLElement
 * @returns Extracted extensions object
 */
export function extractExtensions(qtiXml: string | HTMLElement): Record<string, any> {
  // Parse if needed
  const doc = typeof qtiXml === 'string'
    ? parse(qtiXml, { lowerCaseTagName: false, comment: false })
    : qtiXml;

  // Priority 1: Try PIE extension first (perfect reconstruction)
  const pieExtension = doc.querySelector('pie\\:sourceModel') ||
                       Array.from(doc.getElementsByTagName('*'))
                         .find(el => el.rawTagName === 'pie:sourceModel');

  if (pieExtension) {
    try {
      const sourceModelText = pieExtension.textContent || pieExtension.innerHTML;
      const sourceModel = JSON.parse(sourceModelText);
      // `searchMetaData` is the bag's name in PIE items written before `extensions`
      const extensions = sourceModel.extensions ?? sourceModel.searchMetaData;
      if (extensions) {
        return extensions;
      }
    } catch (e) {
      // Fall through to QTI metadata parsing
    }
  }

  // Priority 2: Parse <qti-metadata> section
  const metadata: Record<string, any> = {};
  const metadataSection = doc.querySelector('qti-metadata') ||
                          doc.getElementsByTagName('qti-metadata')[0];

  if (metadataSection) {
    const fields = metadataSection.querySelectorAll('qti-metadata-field') ||
                   metadataSection.getElementsByTagName('qti-metadata-field');

    for (const field of Array.from(fields)) {
      const name = field.getAttribute('name');
      const value = field.getAttribute('value');
      const dataType = field.getAttribute('data-type');

      if (!name || value === null || value === undefined) continue;

      // Restore original type
      if (dataType === 'array') {
        metadata[name] = value.split(',').map(v => v.trim());
      } else if (dataType === 'number') {
        metadata[name] = parseFloat(value);
      } else {
        metadata[name] = value;
      }
    }
  }

  return metadata;
}
