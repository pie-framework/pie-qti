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

export { AcmeVendorDetector } from './acme-vendor-detector.js';
export { AcmeSliderTransformer } from './acme-slider-transformer.js';
export { AcmeAssetResolver } from './acme-asset-resolver.js';
export { AcmeCssClassExtractor } from './acme-css-extractor.js';
export { AcmeMetadataExtractor } from './acme-metadata-extractor.js';

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
  const { AcmeVendorDetector } = require('./acme-vendor-detector.js');
  const { AcmeSliderTransformer } = require('./acme-slider-transformer.js');
  const { AcmeAssetResolver } = require('./acme-asset-resolver.js');
  const { AcmeCssClassExtractor } = require('./acme-css-extractor.js');
  const { AcmeMetadataExtractor } = require('./acme-metadata-extractor.js');

  return {
    detector: new AcmeVendorDetector(),
    transformer: new AcmeSliderTransformer(),
    assetResolver: new AcmeAssetResolver(),
    cssExtractor: new AcmeCssClassExtractor(),
    metadataExtractor: new AcmeMetadataExtractor(),
  };
}
