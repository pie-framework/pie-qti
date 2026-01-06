# IMS Content Package Manifest Generation

This document describes the IMS Content Package manifest generation feature in pie-to-qti2.

## Overview

The manifest generator creates IMS Content Package v1.1 compliant `imsmanifest.xml` files that declare QTI items, passages, and their dependencies. This enables proper packaging and distribution of QTI content.

## Features

- **IMS CP v1.1 Compliance**: Generates spec-compliant manifest XML
- **Resource Declaration**: Declares items, passages, and assessments as QTI 2.2 resources
- **Assessment Support**: Full support for assessmentTest resources with item dependencies
- **Dependency Management**: Tracks item dependencies on passages, and assessment dependencies on items
- **Passage Deduplication**: Shared passages across items are declared once
- **BaseId Support**: Uses stable identifiers when available
- **Flexible API**: Standalone functions and plugin integration

## Usage

### Plugin Integration

Enable manifest generation by setting `generatePackage: true` in plugin options:

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';

const plugin = new PieToQti2Plugin({
  generatePackage: true,
  passageStrategy: 'external',
  passageResolver: async (passageId) => {
    // Load passage content from your data source
    return {
      id: passageId,
      content: '<p>Passage content...</p>',
      title: 'Passage Title'
    };
  }
});

const result = await plugin.transform({ content: pieItem }, context);

// Access generated manifest
const manifestXml = result.manifest;

// Access passage files
const passageFiles = result.passageFiles;
```

### Standalone API

Generate manifests directly using the manifest generator:

```typescript
import { generateManifest } from '@pie-qti/pie-to-qti2';

const manifestXml = generateManifest({
  items: [
    {
      id: 'item-1',
      filePath: 'items/item-1.xml',
      dependencies: ['passage-abc', 'passage-xyz']
    },
    {
      id: 'item-2',
      filePath: 'items/item-2.xml',
      dependencies: ['passage-abc'] // Shared passage
    }
  ],
  passages: [
    {
      id: 'passage-abc',
      filePath: 'passages/passage-abc.xml'
    },
    {
      id: 'passage-xyz',
      filePath: 'passages/passage-xyz.xml'
    }
  ],
  options: {
    packageId: 'my-assessment-package',
    metadata: {
      title: 'Science Assessment',
      description: 'Grade 8 Science Questions'
    }
  }
});
```

## Manifest Structure

The generated manifest follows this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="pkg-assessment-1"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="...">
  <organizations/>
  <resources>
    <!-- Passage resources declared first (dependencies) -->
    <resource identifier="passage-abc"
              type="imsqti_item_xmlv2p2"
              href="passages/passage-abc.xml">
      <file href="passages/passage-abc.xml"/>
    </resource>

    <!-- Item resources in the middle (depend on passages) -->
    <resource identifier="item-1"
              type="imsqti_item_xmlv2p2"
              href="items/item-1.xml">
      <file href="items/item-1.xml"/>
      <dependency identifierref="passage-abc"/>
    </resource>

    <resource identifier="item-2"
              type="imsqti_item_xmlv2p2"
              href="items/item-2.xml">
      <file href="items/item-2.xml"/>
    </resource>

    <!-- Assessment resource last (depends on items) -->
    <resource identifier="assessment-1"
              type="imsqti_assessment_xmlv2p2"
              href="assessments/assessment-1.xml">
      <file href="assessments/assessment-1.xml"/>
      <dependency identifierref="item-1"/>
      <dependency identifierref="item-2"/>
    </resource>
  </resources>
</manifest>
```

## API Reference

### `generateManifest(input: ManifestInput): string`

Generates an IMS CP manifest XML string.

**Parameters:**
- `input.items`: Array of item resources with their file paths and dependencies
- `input.passages`: Optional array of passage resources
- `input.options`: Optional generation options (packageId, metadata)

**Returns:** Complete manifest XML string with XML declaration

### `buildManifest(input: ManifestInput): ImsManifest`

Builds the structured manifest object (without serialization to XML).

**Returns:** Structured `ImsManifest` object

### `generateSingleItemManifest(...)`

Convenience function for single-item packages.

### `generateBatchManifest(...)`

Convenience function for multi-item packages.

### `generateAssessmentManifest(...)`

Convenience function for assessment packages with items and passages.

**Parameters:**
- `assessmentId`: Assessment identifier
- `assessmentPath`: Assessment file path
- `items`: Array of item resources with their dependencies
- `passages`: Array of passage resources (optional)
- `options`: Generation options (packageId, metadata)

**Returns:** Complete manifest XML string

## Examples

### Single Item with Passage

```typescript
const manifestXml = generateManifest({
  items: [
    {
      id: 'item-reading-1',
      filePath: 'items/item-reading-1.xml',
      dependencies: ['passage-photosynthesis']
    }
  ],
  passages: [
    {
      id: 'passage-photosynthesis',
      filePath: 'passages/passage-photosynthesis.xml'
    }
  ]
});
```

### Multiple Items Sharing Passage

```typescript
const manifestXml = generateManifest({
  items: [
    {
      id: 'item-1',
      filePath: 'items/item-1.xml',
      dependencies: ['shared-passage']
    },
    {
      id: 'item-2',
      filePath: 'items/item-2.xml',
      dependencies: ['shared-passage']
    }
  ],
  passages: [
    {
      id: 'shared-passage',
      filePath: 'passages/shared-passage.xml'
    }
  ]
});
```

The shared passage is declared once, and both items reference it via `<dependency>` elements.

### Item with Additional Files

```typescript
const manifestXml = generateManifest({
  items: [
    {
      id: 'item-with-media',
      filePath: 'items/item-with-media.xml',
      files: [
        'images/diagram.png',
        'styles/custom.css'
      ]
    }
  ]
});
```

Additional files are included in the resource's `<file>` declarations.

### Assessment Package with Items and Passages

```typescript
import { generateAssessmentManifest } from '@pie-qti/pie-to-qti2';

const manifestXml = generateAssessmentManifest(
  'biology-unit-1',
  'assessments/biology-unit-1.xml',
  [
    {
      id: 'item-1',
      filePath: 'items/item-1.xml',
      dependencies: ['passage-photosynthesis']
    },
    {
      id: 'item-2',
      filePath: 'items/item-2.xml',
      dependencies: ['passage-photosynthesis']
    },
    {
      id: 'item-3',
      filePath: 'items/item-3.xml'
      // No passage dependency
    }
  ],
  [
    {
      id: 'passage-photosynthesis',
      filePath: 'passages/passage-photosynthesis.xml'
    }
  ],
  {
    packageId: 'biology-unit-1-package',
    metadata: {
      title: 'Biology Unit 1 Assessment',
      description: 'End of unit test covering photosynthesis'
    }
  }
);
```

The generated manifest will include:

1. Passage resources first (dependencies)
2. Item resources in the middle (reference passages)
3. Assessment resource last (references all items)

The assessment resource uses `type="imsqti_assessment_xmlv2p2"` to indicate it's a QTI assessmentTest.

### Using BaseId for Stable Identifiers

```typescript
// PIE item with baseId
const pieItem = {
  id: 'internal-uuid-123',
  baseId: 'public-stable-id',  // Stable identifier
  passage: 'passage-science-1',
  config: { /* ... */ }
};

// Plugin automatically uses baseId in manifest
const plugin = new PieToQti2Plugin({
  generatePackage: true,
  passageStrategy: 'external',
  passageResolver: async (id) => ({
    id,
    baseId: `passage-${id}`, // Stable passage ID
    content: '<p>Content</p>'
  })
});

const result = await plugin.transform({ content: pieItem }, context);

// Generated manifest uses baseId values:
// <manifest identifier="pkg-public-stable-id">
//   <resource identifier="public-stable-id" href="items/public-stable-id.xml">
//     <dependency identifierref="passage-science-1"/>
//   </resource>
// </manifest>
```

## IMS CP Compliance

The manifest generator follows these IMS CP v1.1 specifications:

1. **Namespace Declarations**: Proper xmlns declarations for IMS CP, MD, and QTI
2. **Schema Locations**: Valid xsi:schemaLocation references
3. **Resource Types**:
   - `imsqti_item_xmlv2p2` for QTI 2.2 items and passages
   - `imsqti_assessment_xmlv2p2` for QTI 2.2 assessments (assessmentTest)
4. **Empty Organizations**: Includes `<organizations/>` (not used for QTI items)
5. **Resource Files**: Declares all files within each resource
6. **Dependencies**: Uses `<dependency identifierref="..."/>` for resource dependencies
7. **Resource Ordering**: Declares resources in dependency order (passages → items → assessments)

## Integration with Transform Pipeline

When `generatePackage: true` is set:

1. Plugin detects external passage references in PIE items
2. Resolves passages via `passageResolver` callback
3. Generates separate passage XML files
4. Creates item XML with `<object>` references to passages
5. Generates manifest declaring all resources and dependencies
6. Returns manifest XML in `result.manifest`
7. Returns passage files in `result.passageFiles`

## File Organization

Recommended directory structure for IMS CP packages:

```
package-root/
├── imsmanifest.xml     # Generated manifest
├── assessments/
│   └── test-1.xml      # QTI assessmentTest files
├── items/
│   ├── item-1.xml      # QTI assessmentItem files
│   └── item-2.xml
└── passages/
    ├── passage-a.xml   # QTI passage items
    └── passage-b.xml
```

## Limitations and Future Enhancements

**Current Limitations:**

- Single item per transform (batch support planned)
- Basic metadata only (title, description)
- No support for organizations (navigation structure)

**Planned Features:**

- Batch transformation with deduplication across items
- Full IMS MD metadata support
- Organization structures for navigation
- Package validation and structure verification

## Testing

See `tests/unit/manifest-generator.test.ts` for unit tests and `tests/integration/manifest-integration.test.ts` for integration tests demonstrating:

- Single item manifests
- Multiple item manifests
- Assessment manifests with item dependencies
- Multiple assessments in one package
- Shared passage handling
- BaseId support
- Additional file declarations
- XML escaping
- Resource ordering (passages → items → assessments)

All tests verify compliance with IMS CP and QTI 2.2 specifications.

## Related Documentation

- [External Passages](./EXTERNAL-PASSAGES.md) - Passage resolution and generation
- [BaseId Support](./BASEID.md) - Stable identifier handling
- [Plugin API](../README.md#api) - Plugin configuration options

## Standards References

- [IMS Content Packaging v1.1.4](https://www.imsglobal.org/content/packaging/)
- [QTI 2.2 Specification](https://www.imsglobal.org/question/)
- [IMS CP Integration with QTI](https://www.imsglobal.org/question/qtiv2p2/imsqti_intgv1p0.html)
