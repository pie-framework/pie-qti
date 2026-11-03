import { describe, expect, it } from 'bun:test';
import {
  AcmeAssetResolver,
  AcmeCssClassExtractor,
  AcmeMetadataExtractor,
  AcmeSliderTransformer,
  AcmeVendorDetector,
  createAcmeExtensions,
} from '../src/index.js';

describe('createAcmeExtensions', () => {
  it('returns an instance of every Acme extension', () => {
    const extensions = createAcmeExtensions();

    expect(extensions.detector).toBeInstanceOf(AcmeVendorDetector);
    expect(extensions.transformer).toBeInstanceOf(AcmeSliderTransformer);
    expect(extensions.assetResolver).toBeInstanceOf(AcmeAssetResolver);
    expect(extensions.cssExtractor).toBeInstanceOf(AcmeCssClassExtractor);
    expect(extensions.metadataExtractor).toBeInstanceOf(AcmeMetadataExtractor);
  });
});
