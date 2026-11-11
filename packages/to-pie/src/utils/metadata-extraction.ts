/**
 * Metadata Extraction Utilities
 *
 * Extracts a PIE item's extensions from QTI items
 */

import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { createInvalidContentError } from './qti-errors.js';

/**
 * Extract a PIE item's extensions from a QTI item
 *
 * Priority 1: Check for PIE extension with embedded extensions (perfect reconstruction)
 * Priority 2: Parse QTI metadata section
 *
 * A `pie:sourceModel` element holding malformed JSON throws: silently falling through to the
 * QTI metadata would drop the author's embedded extensions as if none existed. An absent
 * element, or a valid `sourceModel` without an `extensions` object, falls through normally.
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
    // node-html-parser keeps the CDATA wrapper in textContent; rawText holds the bare content.
    let json = (pieExtension.rawText || pieExtension.text || '').trim();
    if (json.startsWith('<![CDATA[') && json.endsWith(']]>')) {
      json = json.substring(9, json.length - 3).trim();
    }
    if (json) {
      let sourceModel: any;
      try {
        sourceModel = JSON.parse(json);
      } catch (parseError) {
        throw createInvalidContentError(
          'pie:sourceModel JSON',
          `The embedded sourceModel is not valid JSON: ${(parseError as Error).message}`,
          { details: `Content excerpt: ${json.slice(0, 120)}` },
        );
      }
      const extensions = sourceModel?.extensions;
      if (extensions) {
        return extensions;
      }
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
