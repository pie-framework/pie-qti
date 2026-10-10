# @pie-qti/to-pie

QTI to PIE transformation plugin with vendor extension support.

## Installation

```bash
npm install @pie-qti/to-pie
```

## Basic Usage

### Transform QTI Items

```typescript
import { QtiToPiePlugin } from '@pie-qti/to-pie';

// Create plugin instance
const plugin = new QtiToPiePlugin();

// Transform QTI item to PIE
const result = await plugin.transform(
  { content: qtiItemXmlString, format: 'qti22' },
  { logger: console }
);

console.log(result.items); // PIE items
```

### Transform QTI Assessments

Transform QTI assessmentTest (multi-item tests) to PIE assessment format:

```typescript
import { QtiToPiePlugin } from '@pie-qti/to-pie';

const qtiAssessmentTest = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="final-exam"
  title="Final Exam">
  <timeLimits maxTime="3600" allowLateSubmission="false"/>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="simultaneous">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false">
        <weight identifier="SCORE" value="2.0"/>
      </assessmentItemRef>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum><testVariables variableIdentifier="SCORE"/></sum>
    </setOutcomeValue>
  </outcomeProcessing>
</assessmentTest>`;

const plugin = new QtiToPiePlugin();
const result = await plugin.transform({ content: qtiAssessmentTest }, { logger: console });
const pieAssessment = result.items[0].content;

// PIE assessment with all features preserved:
// - sections with itemRefs
// - outcomeProcessingXml (raw QTI scoring logic)
// - branchRule and preCondition (adaptive navigation)
// - timeLimits, weights, item session controls
console.log(pieAssessment.sections);
console.log(pieAssessment.outcomeProcessingXml);
```

All assessment-level features are preserved through round-trips. See [@pie-qti/pie-to-qti2 Assessment Transformations](../pie-to-qti2/docs/ASSESSMENT-TRANSFORMATIONS.md) for complete documentation.

## Vendor Extensions

This package supports vendor-specific QTI transformations through a flexible extension system. Vendor code lives in separate packages and registers with the plugin.

### Quick Start with Vendor Extensions

```typescript
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import { vendorDetector, vendorTransformer } from '@acme/qti-vendor-extensions';

const plugin = new QtiToPiePlugin();

// Register vendor extensions
plugin.registerVendorDetector(vendorDetector);
plugin.registerVendorTransformer(vendorTransformer);

// Now transforms will automatically detect and handle vendor-specific QTI
```

### Extension Types

The plugin supports five types of vendor extensions:

#### 1. **VendorDetector** - Identify vendor-specific QTI

```typescript
import type { VendorDetector } from '@pie-qti/to-pie';

const myDetector: VendorDetector = {
  name: 'my-vendor-detector',
  detect(qtiXml, parsedDoc) {
    // Check for vendor patterns
    if (qtiXml.includes('my-vendor-identifier')) {
      return {
        vendor: 'my-vendor',
        confidence: 0.95,
        version: '1.0'
      };
    }
    return null;
  }
};

plugin.registerVendorDetector(myDetector);
```

#### 2. **VendorTransformer** - Custom transformation logic

```typescript
import type { VendorTransformer } from '@pie-qti/to-pie';

const myTransformer: VendorTransformer = {
  vendor: 'my-vendor',
  canHandle(qtiXml, vendorInfo, parsedDoc) {
    return vendorInfo.vendor === 'my-vendor';
  },
  async transform(qtiXml, vendorInfo, context, parsedDoc) {
    // Custom transformation logic
    return {
      items: [pieItem],
      format: 'pie',
      metadata: { /* ... */ }
    };
  }
};

plugin.registerVendorTransformer(myTransformer);
```

#### 3. **AssetResolver** - Load external resources

```typescript
import type { AssetResolver } from '@pie-qti/to-pie';

const myAssetResolver: AssetResolver = {
  name: 'my-asset-resolver',
  canResolve(assetType, assetUrl) {
    return assetUrl.startsWith('https://my-vendor-cdn.com/');
  },
  async resolve(assetType, assetUrl, baseDir) {
    // Fetch and return asset
    const response = await fetch(assetUrl);
    const buffer = await response.arrayBuffer();
    return {
      url: assetUrl,
      buffer: Buffer.from(buffer),
      mimeType: response.headers.get('content-type') || 'application/octet-stream'
    };
  }
};

plugin.registerAssetResolver(myAssetResolver);
```

#### 4. **CssClassExtractor** - Parse vendor CSS classes

```typescript
import type { CssClassExtractor } from '@pie-qti/to-pie';

const myClassExtractor: CssClassExtractor = {
  vendor: 'my-vendor',
  extract(element) {
    const classes = element.getAttribute('class')?.split(/\s+/) || [];
    return {
      behavioral: classes.filter(c => c.startsWith('behavior-')),
      styling: classes.filter(c => c.startsWith('style-')),
      semantic: classes.filter(c => c.startsWith('semantic-')),
      unknown: classes.filter(c => !c.startsWith('behavior-') &&
                                   !c.startsWith('style-') &&
                                   !c.startsWith('semantic-'))
    };
  }
};

plugin.registerCssClassExtractor(myClassExtractor);
```

#### 5. **MetadataExtractor** - Extract vendor metadata

```typescript
import type { MetadataExtractor } from '@pie-qti/to-pie';

const myMetadataExtractor: MetadataExtractor = {
  vendor: 'my-vendor',
  extract(qtiXml, parsedDoc, vendorInfo) {
    // Extract vendor-specific metadata
    return {
      vendorId: vendorInfo.metadata?.id,
      customField: parsedDoc.getAttribute('data-custom')
    };
  }
};

plugin.registerMetadataExtractor(myMetadataExtractor);
```

### Helper Utilities

The package provides generic utilities for common vendor customization tasks:

```typescript
import {
  extractCssClasses,
  extractCustomAttributes,
  preserveVendorClasses,
  preserveVendorAttributes,
  applyBehavioralClasses
} from '@pie-qti/to-pie';

// Extract and categorize CSS classes
const classes = extractCssClasses(element);
console.log(classes.behavioral); // ['labels-none', 'input-medium']

// Extract custom attributes
const attrs = extractCustomAttributes(element, 'vendor-');
console.log(attrs.vendor); // Vendor-specific attributes
console.log(attrs.data);   // data-* attributes

// Preserve in PIE model for round-trip
preserveVendorClasses(pieModel, classes);
preserveVendorAttributes(pieModel, attrs);

// Apply behavioral classes to PIE configuration
applyBehavioralClasses(pieModel, classes.behavioral);
```

## Complete Documentation

- **[Type Definitions](./src/types/vendor-extensions.ts)** - Full TypeScript interfaces

## Supported QTI Versions

- QTI 2.2 (primary compatibility baseline)
- QTI 2.1 / 2.0 (compatibility; warnings are emitted for legacy versions)

QTI 3.0 input is detected and not transformed: each QTI 3.0 item fails with a `QTI_VERSION_UNSUPPORTED` diagnostic unless a registered vendor transformer handles it.

The plugin format id remains `qti22` for registry compatibility, but input XML is version-detected at runtime.

## Supported Interaction Types

Standard QTI interactions:

- `choiceInteraction` - Multiple choice
- `extendedTextInteraction` - Extended text response
- `orderInteraction` - Ordering/ranking
- `matchInteraction` - Matching
- `textEntryInteraction` - Fill in the blank
- `inlineChoiceInteraction` - Inline dropdown
- `gapMatchInteraction` - Drag in the blank
- `hotspotInteraction` - Hotspot
- `graphicGapMatchInteraction` - Image cloze
- `selectPointInteraction` - Point selection
- `hottextInteraction` - Selectable text
- `associateInteraction` - Association (mapped to categorize)

Custom interactions (via vendor extensions):

- Add your own by implementing `VendorTransformer`

## Round-Trip Compatibility

This plugin is designed to work seamlessly with `@pie-qti/pie-to-qti2` for bidirectional transformation:

```
PIE Item ──→ @pie-qti/pie-to-qti2 ──→ QTI XML ──→ @pie-qti/to-pie ──→ PIE Item
```

### Identifier Preservation

The transformation pipeline preserves stable identifiers across round-trips:

```typescript
// Original PIE item
const pieItem = {
  id: 'item-internal-456',      // Internal/working ID
  baseId: 'item-stable-123',    // Stable/public ID for round-trips
  uuid: '...',
  config: { /* ... */ }
};

// After PIE → QTI → PIE round-trip
const roundTripped = await transformPieThenQti(pieItem);
console.log(roundTripped.id);     // 'item-stable-123' (restored from baseId)
console.log(roundTripped.baseId); // 'item-stable-123' (preserved)
```

**Key guarantees:**

- `baseId` is preserved bidirectionally via QTI `<qti-metadata-field name="externalId">`
- When transforming QTI → PIE, baseId becomes the PIE item's `id` if present
- When transforming PIE → QTI → PIE, the stable `baseId` is maintained
- Vendor-specific identifiers are preserved through custom metadata

### Output Format Consistency

Both transformation directions use a consistent wrapped output format:

```typescript
interface TransformOutput {
  items: Array<{
    content: any;           // PIE object or QTI XML string
    format: 'pie' | 'qti22' | 'qti30'; // Explicit format tag
  }>;
  format: 'pie' | 'qti22' | 'qti30';   // Primary output format
  metadata: TransformMetadata;
  warnings?: TransformWarning[];
  errors?: TransformError[];
}

// QTI → PIE
const qtiToPieResult = await plugin.transform({ content: qtiXml });
console.log(qtiToPieResult.items[0].format); // 'pie'
const pieItem = qtiToPieResult.items[0].content; // PIE object

// PIE → QTI
const pieToQtiResult = await pieToQti2Plugin.transform({ content: pieItem });
console.log(pieToQtiResult.items[0].format); // 'qti22'
const qtiXml = pieToQtiResult.items[0].content; // QTI XML string
```

### Lossless Round-Trip via the PIE Source Sidecar

`@pie-qti/pie-to-qti2` writes the PIE item beside each QTI item as a `.pie.json` sidecar, listed under
the item's `<resource>` in the content package. `transformQtiPackageToPie` reads a listed sidecar
automatically; a bare item transform takes it as `sidecar`:

```typescript
const result = await plugin.transform({ content: qtiXml, sidecar: sidecarJson }, { logger });
```

The sidecar records a digest of the QTI item it was written beside, and is used only while the item
still has that digest:

- **Unchanged item:** the original PIE item is returned verbatim, with `baseId`, `searchMetaData` and
  vendor configuration.
- **Item edited after export:** the QTI body is transformed, with a `PIE_SOURCE_STALE` warning and a
  `fallback` trace event.
- **Unreadable sidecar:** the QTI body is transformed, with a `PIE_EXTENSION_UNREADABLE` warning.

QTI from releases before the sidecar embeds the PIE item as `<pie:sourceModel>`. It carries no digest,
so it is ignored with a `PIE_SOURCE_STALE` warning and the QTI body is transformed.

The reverse direction works the same way: every transformed item keeps the original QTI in
`metadata.qtiSource` with a digest of the final PIE config, and pie-to-qti2 writes the original QTI back
only while the config is unchanged.

### Metadata Preservation

`baseId` and `searchMetaData` travel in the sidecar. Without a fresh one, `transformQtiPackageToPie`
reads them from the IEEE LOM pie-to-qti2 writes on the item's manifest resource, keeping any value the
item already has; a bare item transform reads `baseId` from a `qti-metadata-field` named `externalId`
or `baseId`, which earlier pie-to-qti2 releases wrote.

### Best Practices for Round-Trip Scenarios

1. **Always use `baseId`** for items that need stable identifiers:

   ```typescript
   const pieItem = {
     id: 'item-work-456',
     baseId: 'item-stable-123',  // This persists across round-trips
     // ...
   };
   ```

2. **Keep the sidecar with the item** when moving QTI exported from PIE: an item transformed
   without it is mapped from its QTI body, which approximates some PIE features.

3. **Use consistent output format** when building pipelines:

   ```typescript
   // Access transformed content consistently
   const content = result.items[0].content;
   const format = result.items[0].format;
   ```

4. **Preserve vendor metadata** for vendor-specific round-trips:

   ```typescript
   plugin.registerMetadataExtractor({
     vendor: 'my-vendor',
     extract(qtiXml, parsedDoc, vendorInfo) {
       return { /* vendor-specific metadata */ };
     }
   });
   ```

### Round-Trip Testing

The test suite includes comprehensive round-trip validation:

```bash
# Run round-trip tests
bun test tests/integration/passage-roundtrip.test.ts

# Tests verify:
# - baseId preservation
# - Identifier mapping
# - Metadata preservation
# - Passage reference integrity
# - Lossless PIE source sidecar extraction
```

## Architecture

```
QTI XML Input
    ↓
Vendor Detection (VendorDetector)
    ↓
├─ Vendor Transformer (if detected)
│   ├─ Asset Resolution (AssetResolver)
│   ├─ CSS Class Extraction (CssClassExtractor)
│   ├─ Metadata Extraction (MetadataExtractor)
│   └─ Custom Transform Logic
│
└─ Standard Transformer (fallback)
    └─ Standard QTI → PIE
    ↓
PIE Output
```

## License

ISC
