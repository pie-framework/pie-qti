/**
 * Acme Metadata Extractor
 *
 * Extracts Acme-specific metadata from QTI content
 * Demonstrates the MetadataExtractor extension point
 *
 * Extracts metadata such as:
 * - Difficulty level
 * - Item bank/collection ID
 * - Authoring tool and version
 * - Subject area and standards
 * - Custom Acme-specific fields
 */

import type { MetadataExtractor, VendorInfo } from '@pie-qti/to-pie';
import type { HTMLElement } from 'node-html-parser';

/**
 * Extracts Acme-specific metadata from QTI content
 *
 * Looks for:
 * - <qti-metadata-field name="acme:*"> elements
 * - data-acme-* attributes on assessmentItem
 * - Custom Acme namespace elements
 */
export class AcmeMetadataExtractor implements MetadataExtractor {
  readonly vendor = 'acme';

  extract(_qtiXml: string, parsedDoc: HTMLElement, vendorInfo: VendorInfo): Record<string, any> {
    console.log('[AcmeMetadataExtractor] ========================================');
    console.log('[AcmeMetadataExtractor] Extracting Acme metadata');
    console.log('[AcmeMetadataExtractor] ========================================');

    const metadata: Record<string, any> = {};

    // Find the assessmentItem element
    const assessmentItem = parsedDoc.querySelector('assessmentItem');
    if (!assessmentItem) {
      console.log('[AcmeMetadataExtractor] ⚠️  No assessmentItem found');
      return metadata;
    }

    // Extract standard QTI metadata fields with acme: prefix
    const metadataFields = parsedDoc.querySelectorAll('qti-metadata-field');
    let fieldCount = 0;

    for (const field of metadataFields) {
      const name = field.getAttribute('name');
      if (name && name.startsWith('acme:')) {
        const value = field.textContent?.trim() || '';
        const cleanName = name.replace('acme:', '');
        metadata[cleanName] = value;
        fieldCount++;
        console.log(`[AcmeMetadataExtractor]   ✓ ${cleanName}: ${value}`);
      }
    }

    // Extract data-acme-* attributes from assessmentItem
    const attributes = assessmentItem.attributes;
    let attrCount = 0;

    for (const attrName in attributes) {
      if (attrName.startsWith('data-acme-')) {
        const cleanName = attrName.replace('data-acme-', '');
        const value = assessmentItem.getAttribute(attrName);
        metadata[cleanName] = value;
        attrCount++;
        console.log(`[AcmeMetadataExtractor]   ✓ ${cleanName}: ${value}`);
      }
    }

    // Look for common Acme metadata patterns
    this.extractCommonFields(parsedDoc, metadata);

    // Add vendor info metadata
    metadata._vendorInfo = {
      vendor: vendorInfo.vendor,
      confidence: vendorInfo.confidence,
      detectionMetadata: vendorInfo.metadata,
    };

    console.log('[AcmeMetadataExtractor] Summary:');
    console.log(`[AcmeMetadataExtractor]   - Metadata fields: ${fieldCount}`);
    console.log(`[AcmeMetadataExtractor]   - Data attributes: ${attrCount}`);
    console.log(`[AcmeMetadataExtractor]   - Total fields extracted: ${Object.keys(metadata).length}`);
    console.log('[AcmeMetadataExtractor] ========================================');

    return metadata;
  }

  /**
   * Extract common Acme metadata fields
   */
  private extractCommonFields(parsedDoc: HTMLElement, metadata: Record<string, any>): void {
    // Look for difficulty level in various places
    const difficultyField = parsedDoc.querySelector('[name="acme:difficulty"], [data-acme-difficulty]');
    if (difficultyField) {
      const difficulty = difficultyField.textContent?.trim() || difficultyField.getAttribute('data-acme-difficulty');
      if (difficulty) {
        metadata.difficulty = difficulty;
        console.log(`[AcmeMetadataExtractor]   ✓ difficulty: ${difficulty} (common field)`);
      }
    }

    // Look for item bank ID
    const itemBankField = parsedDoc.querySelector('[name="acme:itemBankId"], [data-acme-item-bank-id]');
    if (itemBankField) {
      const itemBankId = itemBankField.textContent?.trim() || itemBankField.getAttribute('data-acme-item-bank-id');
      if (itemBankId) {
        metadata.itemBankId = itemBankId;
        console.log(`[AcmeMetadataExtractor]   ✓ itemBankId: ${itemBankId} (common field)`);
      }
    }

    // Look for authoring tool
    const generatorField = parsedDoc.querySelector('[name="generator"]');
    if (generatorField?.textContent?.includes('Acme')) {
      const generator = generatorField.textContent.trim();
      metadata.authoringTool = generator;
      console.log(`[AcmeMetadataExtractor]   ✓ authoringTool: ${generator} (common field)`);

      // Try to extract version
      const versionMatch = generator.match(/v?(\d+\.\d+(?:\.\d+)?)/);
      if (versionMatch) {
        metadata.authoringToolVersion = versionMatch[1];
        console.log(`[AcmeMetadataExtractor]   ✓ authoringToolVersion: ${versionMatch[1]} (parsed)`);
      }
    }

    // Look for subject area
    const subjectField = parsedDoc.querySelector('[name="acme:subject"], [data-acme-subject]');
    if (subjectField) {
      const subject = subjectField.textContent?.trim() || subjectField.getAttribute('data-acme-subject');
      if (subject) {
        metadata.subject = subject;
        console.log(`[AcmeMetadataExtractor]   ✓ subject: ${subject} (common field)`);
      }
    }

    // Look for standards alignment
    const standardsField = parsedDoc.querySelector('[name="acme:standards"], [data-acme-standards]');
    if (standardsField) {
      const standards = standardsField.textContent?.trim() || standardsField.getAttribute('data-acme-standards');
      if (standards) {
        // Try to parse as JSON array, otherwise store as string
        try {
          metadata.standards = JSON.parse(standards);
          console.log(`[AcmeMetadataExtractor]   ✓ standards: ${JSON.stringify(metadata.standards)} (parsed array)`);
        } catch {
          metadata.standards = standards;
          console.log(`[AcmeMetadataExtractor]   ✓ standards: ${standards} (common field)`);
        }
      }
    }
  }
}
