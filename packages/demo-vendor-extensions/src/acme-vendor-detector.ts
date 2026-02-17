/**
 * Acme Vendor Detector
 *
 * Detects Acme-specific QTI content patterns
 * Demonstrates the VendorDetector extension point
 */

import type { VendorDetector, VendorInfo } from '@pie-qti/to-pie';
import type { HTMLElement } from 'node-html-parser';

/**
 * Detects QTI content from Acme Corporation
 *
 * Detection patterns:
 * - Custom namespace: xmlns:acme="http://acme.com/qti"
 * - Data attribute: data-vendor="acme"
 * - Generator metadata: <qti-metadata-field name="generator">Acme QTI Authoring Tool</qti-metadata-field>
 */
export class AcmeVendorDetector implements VendorDetector {
  readonly name = 'acme-vendor-detector';

  detect(qtiXml: string, parsedDoc: HTMLElement): VendorInfo | null {
    console.log('[AcmeVendorDetector] Analyzing QTI content for Acme patterns...');

    let confidence = 0.0;
    const metadata: Record<string, any> = {};

    // Check for Acme namespace
    if (qtiXml.includes('xmlns:acme=') || qtiXml.includes('acme:')) {
      console.log('[AcmeVendorDetector] ✓ Found Acme namespace');
      confidence += 0.5;
      metadata.hasNamespace = true;
    }

    // Check for data-vendor attribute
    const elementsWithVendor = parsedDoc.querySelectorAll('[data-vendor]');
    for (const element of elementsWithVendor) {
      const vendor = element.getAttribute('data-vendor');
      if (vendor === 'acme') {
        console.log('[AcmeVendorDetector] ✓ Found data-vendor="acme" attribute');
        confidence += 0.4;
        metadata.hasVendorAttribute = true;
        break;
      }
    }

    // Check for Acme generator in metadata
    const metadataFields = parsedDoc.querySelectorAll('qti-metadata-field');
    for (const field of metadataFields) {
      const name = field.getAttribute('name');
      if (name === 'generator' && field.textContent?.includes('Acme')) {
        console.log('[AcmeVendorDetector] ✓ Found Acme generator in metadata');
        confidence += 0.3;
        metadata.generator = field.textContent;
        break;
      }
    }

    // Check for Acme-specific CSS classes
    if (qtiXml.includes('acme-') || qtiXml.includes('class="acme')) {
      console.log('[AcmeVendorDetector] ✓ Found Acme CSS classes');
      confidence += 0.1;
      metadata.hasAcmeClasses = true;
    }

    // If confidence is high enough, return vendor info
    if (confidence >= 0.3) {
      console.log(`[AcmeVendorDetector] ✅ Detected Acme vendor (confidence: ${confidence.toFixed(2)})`);
      return {
        vendor: 'acme',
        confidence,
        metadata,
      };
    }

    console.log('[AcmeVendorDetector] ❌ No Acme patterns detected');
    return null;
  }
}
