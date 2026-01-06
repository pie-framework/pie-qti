# External Passage Support

This document describes the external passage resolution feature for PIE → QTI 2.2 transformation.

## Overview

PIE items can reference passages in two ways:

1. **Inline Passages**: Passages embedded in `config.models[]` as `@pie-element/passage` models
2. **External Passages**: Passages referenced via the `passage` property (string ID or full object)

The `pie-to-qti2` plugin supports both approaches and can generate separate QTI passage files with appropriate references.

## Passage Strategies

### Inline Strategy (Phase 1)

**Used when:**
- PIE item has passages in `config.models[]`
- No external `passage` property

**Behavior:**
- Passages embedded directly in QTI `<itemBody>` as `<div class="stimulus">`
- All content in single XML file

**Example:**
```typescript
const pieItem = {
  config: {
    models: [
      {
        id: 'passage-1',
        element: '@pie-element/passage',
        passages: [{ title: 'Title', text: '<p>Content</p>' }]
      },
      { id: 'mc-1', element: '@pie-element/multiple-choice', ... }
    ]
  }
};

// Result: Single QTI item with embedded passage
```

### External Strategy (Phase 2)

**Used when:**
- PIE item has `passage` property (string reference or full object)

**Behavior:**
- Separate QTI passage file generated
- Item references passage via `<object data="passages/passage-id.xml">`
- Enables passage reuse across multiple items

**Example:**
```typescript
const pieItem = {
  passage: 'passage-abc', // External reference
  config: {
    models: [
      { id: 'mc-1', element: '@pie-element/multiple-choice', ... }
    ]
  }
};

// Result:
// 1. passages/passage-abc.xml (standalone passage file)
// 2. item.xml (with <object> reference to passage)
```

## Usage

### Basic External Passage Resolution

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import type { PassageResolver } from '@pie-qti/pie-to-qti2';

// Define passage resolver
const resolver: PassageResolver = async (passageId: string) => {
  // Load passage from your data source
  const passage = await database.passages.findById(passageId);

  return {
    id: passage.id,
    title: passage.title,
    content: passage.htmlContent,
    metadata: passage.searchMetaData
  };
};

// Create plugin with resolver
const plugin = new PieToQti2Plugin({
  passageResolver: resolver
});

// Transform PIE item with external passage reference
const result = await plugin.transform(input, context);

// Access generated passage files
const passageFiles = result.passageFiles;
// [{ id: 'passage-abc', filePath: 'passages/passage-abc.xml', xml: '...', metadata: {...} }]
```

### Provided Passage Objects

If the PIE item includes the full passage object (not just a string reference), no resolver is needed:

```typescript
const pieItem = {
  passage: {
    id: 'passage-def',
    externalId: 'passage-def-ext',
    config: {
      models: [
        {
          id: 'p1',
          element: '@pie-element/passage',
          passages: [{ title: 'Title', text: '<p>Content</p>' }]
        }
      ]
    },
    searchMetaData: { subject: 'Science' }
  },
  config: { ... }
};

// No resolver needed - passage content is already provided
const plugin = new PieToQti2Plugin();
const result = await plugin.transform(input, context);
```

### Forcing Strategy

You can override the automatic strategy detection:

```typescript
const plugin = new PieToQti2Plugin({
  passageResolver: resolver,
  passageStrategy: 'inline' // Force inline even if external passage exists
});
```

## Generated Output

### Transform Result Structure

```typescript
interface TransformOutput {
  items: Array<{ content: string; format: 'qti22' }>;
  format: 'qti22';
  passageFiles?: GeneratedPassageFile[]; // Present when external strategy used
  metadata: {
    passageStrategy: 'inline' | 'external';
    externalPassageCount: number;
    hasPassages: boolean;
    // ... other metadata
  };
}

interface GeneratedPassageFile {
  id: string;
  filePath: string; // e.g., 'passages/passage-abc.xml'
  xml: string;
  metadata?: Record<string, any>;
}
```

### Passage XML Format

Generated passage files follow QTI 2.2 standard:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="passage-abc"
                title="The Water Cycle"
                adaptive="false"
                timeDependent="false">
  <!-- Standalone passage/stimulus item -->
  <itemBody>
    <div class="stimulus">
      <h2>The Water Cycle</h2>
      <p>Water cycles through evaporation, condensation, and precipitation.</p>
    </div>
  </itemBody>
</assessmentItem>
```

### Item with Object Reference

```xml
<assessmentItem identifier="item-1" ...>
  <itemBody>
    <object data="passages/passage-abc.xml"
            type="text/html"
            data-pie-passage-id="passage-abc">
      <p>Passage content not available</p>
    </object>

    <choiceInteraction>
      <!-- Question content -->
    </choiceInteraction>
  </itemBody>
</assessmentItem>
```

## Passage Detection

The plugin automatically detects passage configuration:

```typescript
import { detectPassages } from '@pie-qti/pie-to-qti2';

const detection = detectPassages(pieItem);

// {
//   hasPassages: true,
//   inlinePassages: [...],  // Models from config.models[]
//   externalPassage: {      // From passage property
//     id: 'passage-abc',
//     stimulus?: {...}
//   },
//   recommendedStrategy: 'inline' | 'external'
// }
```

## Validation

The plugin validates passage configurations:

```typescript
import { validatePassageConfiguration } from '@pie-qti/pie-to-qti2';

const validation = validatePassageConfiguration(pieItem);

if (!validation.valid) {
  console.error(validation.errors);
  // ["Item has both inline passages (in config.models[]) and external
  //   passage reference (passage property). Use either inline OR external, not both."]
}
```

## Error Handling

### Missing Resolver

If a PIE item has a string passage reference but no resolver is provided:

```typescript
// ❌ This will throw
const plugin = new PieToQti2Plugin(); // No resolver
const pieItem = { passage: 'passage-abc', ... };

await plugin.transform(input, context);
// Error: Item "item-1" has external passage reference "passage-abc"
//        but no passageResolver was provided.
```

### Resolution Failure

If the resolver throws or returns invalid data, the error propagates:

```typescript
const resolver: PassageResolver = async (passageId) => {
  const passage = await database.passages.findById(passageId);
  if (!passage) {
    throw new Error(`Passage not found: ${passageId}`);
  }
  return { ... };
};
```

## Best Practices

### 1. Passage Deduplication (Future)

When transforming multiple items that reference the same passage:

```typescript
// Phase 3 will support:
// - Detect duplicate passage IDs across items
// - Generate each passage file only once
// - Update all item references accordingly
```

### 2. IMS Content Package Generation (Future)

```typescript
const plugin = new PieToQti2Plugin({
  passageResolver: resolver,
  generatePackage: true // Phase 2: Generate IMS CP manifest
});

// Result will include imsmanifest.xml with:
// - Resource entries for each item
// - Resource entries for each passage
// - File dependencies
```

### 3. Metadata Preservation

Passage metadata from PIE is preserved in generated files:

```typescript
const resolver: PassageResolver = async (passageId) => {
  return {
    id: passageId,
    title: 'Title',
    content: '<p>Content</p>',
    metadata: {
      subject: 'Science',
      gradeLevel: ['8', '9'],
      readingLevel: 'Lexile 950L'
    }
  };
};

// Metadata available in GeneratedPassageFile.metadata
```

## API Reference

### Types

```typescript
// Passage resolution callback
type PassageResolver = (passageId: string) => Promise<ResolvedPassage>;

interface ResolvedPassage {
  id: string;
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  piePassage?: PiePassageStimulus;
}

// Passage strategies
type PassageStrategy = 'inline' | 'external';

// Generated passage file
interface GeneratedPassageFile {
  id: string;
  filePath: string;
  xml: string;
  metadata?: Record<string, any>;
}
```

### Plugin Options

```typescript
interface PieToQti2PluginOptions {
  registry?: GeneratorRegistry;

  // External passage support (Phase 2)
  passageResolver?: PassageResolver;
  passageStrategy?: PassageStrategy;
  generatePackage?: boolean;
}
```

### Utility Functions

```typescript
// Detect passages in PIE item
function detectPassages(pieItem: PieItem): PassageDetectionResult;

// Check if item needs external resolution
function needsPassageResolution(pieItem: PieItem): boolean;

// Validate passage configuration
function validatePassageConfiguration(pieItem: PieItem): {
  valid: boolean;
  errors: string[];
};

// Extract passage IDs
function extractPassageIds(pieItem: PieItem): string[];

// Extract passage references from QTI XML
function extractPassageReferencesFromQti(qtiXml: string): PassageReference[];
```

## Testing

See [tests/integration/external-passages.test.ts](../tests/integration/external-passages.test.ts) for comprehensive examples:

- External passage resolution from string references
- Using provided passage objects
- Error handling for missing resolvers
- Strategy override
- Inline fallback behavior

## Future Enhancements

### Phase 2 (In Progress)
- ✅ External passage resolution with PassageResolver callback
- ✅ Separate passage file generation
- ✅ QTI object reference insertion
- ⏳ IMS manifest generation
- ⏳ Passage deduplication

### Phase 3 (Planned)
- Batch transformation with shared passages
- Custom passage file naming strategies
- Passage template support
- Advanced metadata mapping
