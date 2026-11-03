/**
 * Demo Vendor Extensions Package
 *
 * Demonstrates all 5 vendor extension points for QTI transformation:
 * 1. VendorDetector - Detect vendor-specific QTI patterns
 * 2. VendorTransformer - Custom transformation logic
 * 3. AssetResolver - Load external assets
 * 4. CssClassExtractor - Parse vendor-specific CSS classes
 * 5. MetadataExtractor - Extract vendor-specific metadata
 *
 * This package showcases how vendors can extend the QTI-to-PIE transformation
 * without modifying core code. All extensions include extensive logging to
 * demonstrate when they're triggered during transformation.
 */

import { AcmeVendorDetector } from './acme-vendor-detector.js';
import { AcmeSliderTransformer } from './acme-slider-transformer.js';
import { AcmeAssetResolver } from './acme-asset-resolver.js';
import { AcmeCssClassExtractor } from './acme-css-extractor.js';
import { AcmeMetadataExtractor } from './acme-metadata-extractor.js';

export { AcmeVendorDetector };
export { AcmeSliderTransformer };
export { AcmeAssetResolver };
export { AcmeCssClassExtractor };
export { AcmeMetadataExtractor };

/**
 * Convenience function to create all Acme vendor extensions
 *
 * Usage:
 * ```typescript
 * import { createAcmeExtensions } from '@pie-qti/demo-vendor-extensions';
 * import { QtiToPiePlugin } from '@pie-qti/to-pie';
 *
 * const extensions = createAcmeExtensions();
 * const plugin = new QtiToPiePlugin({
 *   vendorDetectors: [extensions.detector],
 *   vendorTransformers: [extensions.transformer],
 *   assetResolvers: [extensions.assetResolver],
 *   cssClassExtractors: [extensions.cssExtractor],
 *   metadataExtractors: [extensions.metadataExtractor],
 * });
 * ```
 */
export function createAcmeExtensions() {
  return {
    detector: new AcmeVendorDetector(),
    transformer: new AcmeSliderTransformer(),
    assetResolver: new AcmeAssetResolver(),
    cssExtractor: new AcmeCssClassExtractor(),
    metadataExtractor: new AcmeMetadataExtractor(),
  };
}
