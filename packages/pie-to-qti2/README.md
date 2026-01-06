# @pie-qti/pie-to-qti2

Bidirectional transformation plugin that converts PIE (Platform for Interactive Education) items to QTI 2.2 format with lossless round-trip support.

## Overview

This package provides PIE → QTI transformation capabilities, completing the bidirectional transformation system when used alongside `@pie-qti/qti2-to-pie`. Together, they enable lossless round-trips:

- **PIE → QTI → PIE**: Preserves all PIE data through embedded `<pie:sourceModel>` extensions
- **QTI → PIE → QTI**: Preserves all QTI data through embedded `qtiSource` metadata

## Features

- **17+ PIE Elements**: Complete coverage of all major PIE element types including interactions, passages, rubrics, and assessments
- **Multi-Model Support**: Handles PIE items with multiple models (passages, interactions, rubrics) in a single QTI item
- **searchMetaData Preservation**: Maintains Renaissance metadata (subject, gradeLevel, DOK, standards, difficulty) through QTI extensions
- **External Passage Support**: Generates separate passage files with `<object>` references for reusable stimulus content
- **IMS Content Packages**: Automatic manifest generation for distributable QTI packages with proper resource declarations
- **BaseId Support**: Stable/public identifier handling for consistent resource references across systems
- **Inline Passages**: Embeds passage content within QTI itemBody using standard HTML (backward compatible)
- **Lossless Round-Trips**: Embeds source format to enable perfect reconstruction via `<pie:sourceModel>`
- **QTI 2.2.2 Compliance**: Generates valid QTI with minimal, well-documented vendor extensions
- **Human-Readable Output**: Pretty-printed XML with consistent formatting
- **Data Preservation**: Uses `data-pie-*` attributes for PIE-specific features
- **Custom Interactions**: Supports non-standard PIE elements via QTI `<customInteraction>`

## Installation

```bash
bun add @pie-qti/pie-to-qti2
```

## Usage

### Basic Transformation

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { TransformEngine } from '@pie-framework/transform-core';

const engine = new TransformEngine();
engine.registerPlugin(new PieToQti2Plugin());

const result = await engine.transform({
  content: pieItem,
  format: 'pie'
});

const qtiXml = result.items[0].content;
```

### Round-Trip Example

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { TransformEngine } from '@pie-framework/transform-core';

const engine = new TransformEngine();
engine.registerPlugin(new PieToQti2Plugin());
engine.registerPlugin(new Qti22ToPiePlugin());

// PIE → QTI
const qtiResult = await engine.transform({ content: originalPie, format: 'pie' });
const qtiXml = qtiResult.items[0].content;

// QTI → PIE (reconstructs original perfectly)
const pieResult = await engine.transform({ content: qtiXml, format: 'qti22' });
const reconstructedPie = pieResult.items[0];
```

### Assessment Transformation Example

Transform multi-item assessments (tests) to QTI assessmentTest format:

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';

const pieAssessment = {
  id: 'final-exam',
  title: 'Final Exam',
  metadata: {
    navigationMode: 'linear',
    submissionMode: 'simultaneous'
  },
  sections: [
    {
      id: 'section-1',
      identifier: 'section-1',
      title: 'Section 1',
      visible: true,
      fixed: false,
      shuffle: false,
      itemRefs: [
        {
          identifier: 'item-1',
          href: 'items/item-1.xml',
          required: true,
          weight: 2.0
        }
      ]
    }
  ],
  outcomeProcessingXml: `<outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE"/>
      </sum>
    </setOutcomeValue>
  </outcomeProcessing>`,
  timeLimits: {
    maxTime: 3600,
    allowLateSubmission: false
  }
};

const plugin = new PieToQti2Plugin();
const result = await plugin.transform({ content: pieAssessment }, { logger: console });
const qtiAssessmentTest = result.items[0].content;

// Output: QTI assessmentTest XML with complete scoring and navigation logic
```

See [Assessment Transformations](./docs/ASSESSMENT-TRANSFORMATIONS.md) for complete documentation.

### External Passage Support

For PIE items that reference external passages (via `passage` property), the plugin can resolve and generate separate passage files:

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';

// Define passage resolver
const resolver = async (passageId: string) => {
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

// Access main item
const itemXml = result.items[0].content;

// Access generated passage files
const passageFiles = result.passageFiles;
// [{ id: 'passage-abc', filePath: 'passages/passage-abc.xml', xml: '...', metadata: {...} }]
```

See [docs/EXTERNAL-PASSAGES.md](./docs/EXTERNAL-PASSAGES.md) for complete documentation.

### IMS Content Package Generation

Generate IMS Content Package manifests for distributable QTI packages:

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';

const plugin = new PieToQti2Plugin({
  generatePackage: true,  // Enable manifest generation
  passageStrategy: 'external',
  passageResolver: async (passageId) => {
    // Load passage content
    return {
      id: passageId,
      content: '<p>Passage text...</p>',
      title: 'Passage Title'
    };
  }
});

const result = await plugin.transform({ content: pieItem }, context);

// Access IMS manifest XML
const manifestXml = result.manifest;

// Access item and passage files
const itemXml = result.items[0].content;
const passageFiles = result.passageFiles;

// Save as IMS Content Package:
// package-root/
//   imsmanifest.xml         <- manifestXml
//   items/
//     item-1.xml            <- itemXml
//   passages/
//     passage-abc.xml       <- passageFiles[0].xml
```

The manifest declares all resources and their dependencies following IMS CP v1.1 and QTI 2.2 specifications.

See [docs/MANIFEST-GENERATION.md](./docs/MANIFEST-GENERATION.md) for complete documentation.

## Supported PIE Elements

### Interaction Types (12)

- **multiple-choice** → `<choiceInteraction>`
- **extended-response** / **extended-text-entry** → `<extendedTextInteraction>`
- **explicit-constructed-response** → `<textEntryInteraction>`
- **drag-in-the-blank** → `<gapMatchInteraction>`
- **inline-dropdown** → `<inlineChoiceInteraction>`
- **match** → `<matchInteraction>`
- **match-list** → `<matchInteraction>` (two simpleMatchSet)
- **hotspot** → `<hotspotInteraction>`
- **select-text** → `<hottextInteraction>`
- **placement-ordering** → `<orderInteraction>`
- **image-cloze-association** → `<graphicGapMatchInteraction>`
- **ebsr** → Two `<choiceInteraction>` elements (Part A and Part B)

### Other PIE Elements (4)

- **categorize** → `<associateInteraction>` (grouping into categories)
- **passage** → `<assessmentItem>` with stimulus content (informational text)
- **rubric** / **complex-rubric** → `<assessmentItem>` with `<rubricBlock>`
- **PIE Assessment** → `<assessmentTest>` with testPart and sections

### Custom Interactions (Fallback)

Non-standard PIE elements use `<customInteraction>`:

- **Any unsupported element** → `<customInteraction>` with embedded PIE model

## Architecture

### Extension Mechanism

PIE models are embedded in QTI XML using a custom namespace:

```xml
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:pie="https://github.com/pie-framework/pie-elements"
                identifier="item-1">
  <!-- Standard QTI content -->
  <responseDeclaration .../>
  <itemBody>
    <choiceInteraction .../>
  </itemBody>

  <!-- Embedded PIE source for lossless round-trip -->
  <pie:sourceModel><![CDATA[
    {
      "element": "@pie-element/multiple-choice",
      "config": { ... },
      "models": [ ... ]
    }
  ]]></pie:sourceModel>
</assessmentItem>
```

### Multi-Model Support

PIE items with multiple models (passages, interactions, rubrics) are combined into a single QTI item:

```typescript
const pieItem: PieItem = {
  id: 'multi-model-item',
  searchMetaData: {
    subject: 'Science',
    gradeLevel: ['8', '9'],
    DOK: 'DOK3'
  },
  config: {
    models: [
      {
        element: '@pie-element/passage',
        passages: [{ title: 'Photosynthesis', text: '<p>...</p>' }]
      },
      {
        element: '@pie-element/multiple-choice',
        prompt: 'What do plants produce?',
        choices: [...]
      }
    ]
  }
};

// Transforms to:
// <assessmentItem>
//   <qti-metadata>
//     <qti-metadata-field name="subject" value="Science"/>
//     <qti-metadata-field name="gradeLevel" value="8,9" data-type="array"/>
//   </qti-metadata>
//   <itemBody>
//     <div class="stimulus">...</div>  <!-- Inline passage -->
//     <choiceInteraction>...</choiceInteraction>
//   </itemBody>
// </assessmentItem>
```

### Data Preservation

PIE-specific features that don't map directly to QTI are preserved using `data-pie-*` attributes:

```xml
<choiceInteraction responseIdentifier="RESPONSE"
                   shuffle="true"
                   maxChoices="2"
                   data-pie-feedback='{"correct":"Great job!","incorrect":"Try again"}'
                   data-pie-ui-settings='{"fontSizeFactor":1.2}'>
  <!-- ... -->
</choiceInteraction>
```

## API Reference

### PieToQti2Plugin

Main plugin class implementing the `TransformPlugin` interface.

```typescript
class PieToQti2Plugin implements TransformPlugin {
  readonly id = 'pie-to-qti2';
  readonly version = '1.0.0';
  readonly name = 'PIE to QTI 2.2';
  readonly sourceFormat = 'pie';
  readonly targetFormat = 'qti22';

  canHandle(input: TransformInput): Promise<boolean>;
  transform(input: TransformInput, context: TransformContext): Promise<TransformOutput>;
}
```

## Testing

```bash
# Run unit tests
bun test

# Run integration tests (round-trip validation)
bun test tests/integration

# Type checking
bun run typecheck
```

## Documentation

- **[Assessment Transformations](./docs/ASSESSMENT-TRANSFORMATIONS.md)** - Complete guide to assessment-level transformations with outcome processing, branch rules, and adaptive navigation
- **[QTI 2.2.2 Compliance](./docs/QTI-COMPLIANCE.md)** - Detailed explanation of QTI compliance and extension strategy
- **[Custom Generators](./CUSTOM-GENERATORS.md)** - Guide for creating custom PIE → QTI generators
- **[External Passages](./docs/EXTERNAL-PASSAGES.md)** - External passage support and resolution
- **[Passage Deduplication](./docs/PASSAGE-DEDUPLICATION.md)** - Batch transformation with passage deduplication
- **[Manifest Generation](./docs/MANIFEST-GENERATION.md)** - IMS Content Package generation

## License

ISC
