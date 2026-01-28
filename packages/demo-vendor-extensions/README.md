# Demo Vendor Extensions

Demonstrates all 5 vendor extension points for QTI-to-PIE transformation.

## Overview

This package showcases how vendors can customize QTI transformation behavior without modifying core code. It provides working implementations of all extension points with extensive logging for demonstration purposes.

## Extension Points Demonstrated

### 1. VendorDetector - `AcmeVendorDetector`

Detects Acme-specific QTI content patterns.

**Detection Patterns:**
- Custom namespace: `xmlns:acme="http://acme.com/qti"`
- Data attribute: `data-vendor="acme"`
- Generator metadata: Acme QTI Authoring Tool
- Acme-specific CSS classes: `acme-*`

**Implementation:** [acme-vendor-detector.ts](src/acme-vendor-detector.ts)

### 2. VendorTransformer - `AcmeSliderTransformer`

Transforms the currently unsupported `sliderInteraction` type.

**What it does:**
- Handles QTI `sliderInteraction` elements
- Extracts slider properties (lowerBound, upperBound, step, orientation)
- Creates a placeholder PIE item (hello world implementation)
- **TODO:** Create proper PIE slider element in the future

**Why sliderInteraction is unsupported:**
- The item-player HAS a `sliderExtractor` (can render QTI sliders)
- The to-pie transformer LACKS a slider transformer (can't convert to PIE)
- No obvious 1:1 mapping to existing PIE elements
- This extension demonstrates solving that gap

**Implementation:** [acme-slider-transformer.ts](src/acme-slider-transformer.ts)

### 3. AssetResolver - `AcmeAssetResolver`

Resolves assets from Acme-specific locations.

**Handles:**
- `acme://` custom protocol URLs
- `https://cdn.acme.com/` CDN URLs
- `https://assets.acme.com/` asset service URLs

**Note:** This is a no-op demo implementation that logs resolution attempts and returns placeholder content. In production, it would fetch from actual CDN/services.

**Implementation:** [acme-asset-resolver.ts](src/acme-asset-resolver.ts)

### 4. CssClassExtractor - `AcmeCssClassExtractor`

Categorizes Acme-specific CSS classes into behavioral, styling, semantic, and unknown categories.

**Recognized Patterns:**
- **Behavioral:** `acme-input-*`, `acme-labels-*`, `acme-shuffle-*`, `acme-validation-*`
- **Styling:** `acme-theme-*`, `acme-border-*`, `acme-spacing-*`, `acme-font-*`
- **Semantic:** `acme-question`, `acme-answer`, `acme-hint`, `acme-feedback`

**Implementation:** [acme-css-extractor.ts](src/acme-css-extractor.ts)

### 5. MetadataExtractor - `AcmeMetadataExtractor`

Extracts Acme-specific metadata from QTI content.

**Extracts:**
- Difficulty level
- Item bank/collection ID
- Authoring tool and version
- Subject area and standards alignment
- Custom `acme:*` metadata fields
- Data attributes: `data-acme-*`

**Implementation:** [acme-metadata-extractor.ts](src/acme-metadata-extractor.ts)

## Usage

### Direct Instantiation

```typescript
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import {
  AcmeVendorDetector,
  AcmeSliderTransformer,
  AcmeAssetResolver,
  AcmeCssClassExtractor,
  AcmeMetadataExtractor,
} from '@pie-qti/demo-vendor-extensions';

const qtiPlugin = new QtiToPiePlugin({
  vendorDetectors: [new AcmeVendorDetector()],
  vendorTransformers: [new AcmeSliderTransformer()],
  assetResolvers: [new AcmeAssetResolver()],
  cssClassExtractors: [new AcmeCssClassExtractor()],
  metadataExtractors: [new AcmeMetadataExtractor()],
});

transformEngine.use(qtiPlugin);
```

### Convenience Function

```typescript
import { createAcmeExtensions } from '@pie-qti/demo-vendor-extensions';
import { QtiToPiePlugin } from '@pie-qti/to-pie';

const extensions = createAcmeExtensions();
const qtiPlugin = new QtiToPiePlugin({
  vendorDetectors: [extensions.detector],
  vendorTransformers: [extensions.transformer],
  assetResolvers: [extensions.assetResolver],
  cssClassExtractors: [extensions.cssExtractor],
  metadataExtractors: [extensions.metadataExtractor],
});
```

### Already Integrated

The demo extensions are already wired up in the transform app at [packages/transform-app/src/hooks.server.ts](../transform-app/src/hooks.server.ts#L48-L66).

## Testing the Extensions

### 1. Test sliderInteraction Transformation

Create a QTI file with `data-vendor="acme"` and a `sliderInteraction`:

```xml
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="slider-example"
                title="Slider Question"
                data-vendor="acme">
  <itemBody>
    <sliderInteraction responseIdentifier="RESPONSE"
                       lowerBound="0"
                       upperBound="100"
                       step="5"
                       orientation="horizontal">
      <prompt>Select your confidence level</prompt>
    </sliderInteraction>
  </itemBody>
</assessmentItem>
```

Upload this to the transform app and watch the console for:
- `[AcmeVendorDetector]` detection logs
- `[AcmeSliderTransformer]` transformation logs
- Generated placeholder PIE item

### 2. Test Asset Resolution

Include Acme CDN assets in your QTI:

```xml
<link rel="stylesheet" href="https://cdn.acme.com/themes/default.css"/>
```

Watch for `[AcmeAssetResolver]` logs showing asset resolution.

### 3. Test CSS Class Extraction

Add Acme CSS classes to your QTI elements:

```xml
<div class="acme-theme-blue acme-input-large acme-question">...</div>
```

Watch for `[AcmeCssClassExtractor]` logs showing class categorization.

### 4. Test Metadata Extraction

Add Acme metadata to your QTI:

```xml
<qti-metadata>
  <qti-metadata-field name="acme:difficulty">medium</qti-metadata-field>
  <qti-metadata-field name="acme:itemBankId">bank-123</qti-metadata-field>
  <qti-metadata-field name="acme:subject">Mathematics</qti-metadata-field>
</qti-metadata>
```

Or use data attributes:

```xml
<assessmentItem data-acme-difficulty="hard"
                data-acme-item-bank-id="bank-456"
                data-vendor="acme">
```

Watch for `[AcmeMetadataExtractor]` logs showing extracted metadata.

## Architecture

### Plugin System Hierarchy

```
TransformEngine
└── QtiToPiePlugin (sourceFormat: qti22, targetFormat: pie)
    ├── VendorDetector[] (detect vendor-specific patterns)
    ├── VendorTransformer[] (custom transformation logic)
    ├── AssetResolver[] (load external assets)
    ├── CssClassExtractor[] (categorize CSS classes)
    └── MetadataExtractor[] (extract metadata)
```

### Extension Flow

1. **Detection Phase**
   - `VendorDetector.detect()` checks for vendor patterns
   - Returns `VendorInfo` with confidence score and metadata

2. **Transformation Phase**
   - If vendor detected, find matching `VendorTransformer`
   - `VendorTransformer.canHandle()` checks if it can transform
   - `VendorTransformer.transform()` performs transformation
   - Falls back to standard transformation if vendor transformer fails

3. **Asset Resolution Phase**
   - During transformation, assets are discovered
   - `AssetResolver.canResolve()` checks if resolver handles asset
   - `AssetResolver.resolve()` fetches and returns asset

4. **Extraction Phase**
   - `CssClassExtractor.extract()` categorizes CSS classes
   - `MetadataExtractor.extract()` pulls vendor-specific metadata
   - Results included in transformation output

## Logging

All extensions include extensive console logging:
- `✅` Success indicators
- `❌` Failure/not detected indicators
- `✓` Individual field extraction
- `⚠️` Warnings
- `========================================` Section dividers

This makes it easy to see when extensions are triggered during transformation.

## Future Work

### TODO: Create Proper PIE Slider Element

The `AcmeSliderTransformer` currently creates a placeholder PIE item. Future implementation should:

1. Create a proper PIE slider element package (`@pie-element/slider`)
2. Map QTI slider properties:
   - `lowerBound` → `min`
   - `upperBound` → `max`
   - `step` → `step`
   - `orientation` → `orientation`
3. Implement response processing and scoring
4. Add proper validation
5. Create UI component for rendering

## Creating Your Own Extensions

To create vendor extensions for your organization:

1. Copy this package as a template
2. Replace "Acme" with your vendor name
3. Implement the detection logic for your QTI patterns
4. Implement transformers for your custom interaction types
5. Add asset resolvers for your CDN/asset services
6. Customize CSS class categorization for your classes
7. Extract metadata fields specific to your authoring tools

### Example: Creating BobCo Extensions

```typescript
// bobco-vendor-detector.ts
export class BobCoVendorDetector implements VendorDetector {
  readonly name = 'bobco-vendor-detector';

  detect(qtiXml: string, parsedDoc: HTMLElement): VendorInfo | null {
    if (qtiXml.includes('xmlns:bobco=') || qtiXml.includes('bobco:')) {
      return {
        vendor: 'bobco',
        confidence: 0.9,
        metadata: { hasNamespace: true },
      };
    }
    return null;
  }
}

// Register your extensions
const qtiPlugin = new QtiToPiePlugin({
  vendorDetectors: [new BobCoVendorDetector()],
  // ... other extensions
});
```

## License

MIT
