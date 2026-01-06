# PIE ↔ QTI Transformation Guide

Complete guide to bidirectional transformation between PIE (Platform for Interactive Education) and QTI 2.2 formats.

## Overview

The `pie-qti` ecosystem provides lossless bidirectional transformation between PIE and QTI 2.2 formats:

```
PIE Item/Assessment ←→ QTI 2.2 Item/AssessmentTest
```

### Key Features

- **Lossless Round-Trips**: Transform PIE → QTI → PIE with perfect preservation
- **Item-Level Support**: Transform individual questions/interactions
- **Assessment-Level Support**: Transform multi-item tests with scoring logic
- **17+ Interaction Types**: Complete coverage of PIE elements
- **Adaptive Navigation**: Branch rules and conditional display
- **External Resources**: Passages, images, and multimedia
- **IMS Content Packages**: Generate distributable QTI packages

## Packages

### @pie-qti/pie-to-qti2

Transforms PIE content to QTI 2.2 format.

```bash
bun add @pie-qti/pie-to-qti2
```

**Use Cases:**
- Export PIE content to standards-compliant QTI
- Distribute content to LMS platforms
- Archive content in interoperable format
- Enable content sharing across systems

### @pie-qti/qti2-to-pie

Transforms QTI 2.2 content to PIE format.

```bash
bun add @pie-qti/qti2-to-pie
```

**Use Cases:**
- Import QTI content from external sources
- Migrate existing QTI content to PIE
- Enable editing of QTI content in PIE authoring tools
- Validate QTI content by rendering in PIE player

## Quick Start

### 1. Transform Single Item

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';

// PIE item
const pieItem = {
  id: 'mc-1',
  config: {
    models: [
      {
        element: '@pie-element/multiple-choice',
        prompt: 'What is 2 + 2?',
        choices: [
          { value: '3', label: 'Three' },
          { value: '4', label: 'Four', correct: true },
          { value: '5', label: 'Five' }
        ],
        choiceMode: 'radio'
      }
    ]
  }
};

// PIE → QTI
const pieToQti = new PieToQti2Plugin();
const qtiResult = await pieToQti.transform(
  { content: pieItem },
  { logger: console }
);
const qtiXml = qtiResult.items[0].content;

// QTI → PIE (lossless round-trip)
const qtiToPie = new Qti22ToPiePlugin();
const pieResult = await qtiToPie.transform(
  { content: qtiXml },
  { logger: console }
);
const reconstructed = pieResult.items[0].content;

// `reconstructed` is identical to `pieItem`
```

### 2. Transform Assessment

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';

// PIE assessment
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

// Transform to QTI assessmentTest
const plugin = new PieToQti2Plugin();
const result = await plugin.transform({ content: pieAssessment });
const qtiAssessmentTest = result.items[0].content;

// Save as QTI file
await fs.writeFile('final-exam.xml', qtiAssessmentTest);
```

## Item-Level Transformations

### Supported PIE Elements

| PIE Element | QTI Interaction | Status |
|-------------|-----------------|--------|
| multiple-choice | choiceInteraction | ✅ |
| extended-response | extendedTextInteraction | ✅ |
| explicit-constructed-response | textEntryInteraction | ✅ |
| drag-in-the-blank | gapMatchInteraction | ✅ |
| inline-dropdown | inlineChoiceInteraction | ✅ |
| match | matchInteraction | ✅ |
| match-list | matchInteraction (two sets) | ✅ |
| hotspot | hotspotInteraction | ✅ |
| select-text | hottextInteraction | ✅ |
| placement-ordering | orderInteraction | ✅ |
| image-cloze-association | graphicGapMatchInteraction | ✅ |
| ebsr | Two choiceInteractions | ✅ |
| categorize | associateInteraction | ✅ |
| passage | assessmentItem (stimulus) | ✅ |
| rubric | assessmentItem (rubricBlock) | ✅ |
| custom elements | customInteraction | ✅ |

### Multiple Models

PIE items can contain multiple models (passages, interactions, rubrics):

```typescript
const pieItem = {
  id: 'multi-model-1',
  config: {
    models: [
      {
        element: '@pie-element/passage',
        passages: [{ title: 'Reading', text: '<p>Lorem ipsum...</p>' }]
      },
      {
        element: '@pie-element/multiple-choice',
        prompt: 'What is the main idea?',
        choices: [...]
      },
      {
        element: '@pie-element/rubric',
        rubric: '<table>...</table>'
      }
    ]
  }
};

// Transforms to single QTI item with:
// - Passage as stimulus in itemBody
// - Multiple choice as choiceInteraction
// - Rubric as rubricBlock
```

### External Passages

Reference external passage files:

```typescript
const plugin = new PieToQti2Plugin({
  passageStrategy: 'external',
  passageResolver: async (passageId) => {
    const passage = await database.getPassage(passageId);
    return {
      id: passage.id,
      title: passage.title,
      content: passage.html
    };
  }
});

const result = await plugin.transform({ content: pieItem });

// Access generated passage files
result.passageFiles.forEach(passage => {
  console.log(`${passage.filePath}: ${passage.xml}`);
});
```

## Assessment-Level Transformations

Transform multi-item assessments (tests) to QTI assessmentTest format with complete preservation of:

- **Outcome Processing**: Scoring logic (sum, weighted, custom rules)
- **Branch Rules**: Adaptive navigation (exit test, skip sections)
- **Pre-Conditions**: Conditional display (show items based on prior responses)
- **Selection Rules**: Item banking (random selection from pools)
- **Time Limits**: Test-level and section-level constraints
- **Item Session Controls**: Attempt limits, feedback policies

### Simple Assessment Example

```typescript
const assessment = {
  id: 'test-1',
  title: 'Mathematics Test',
  metadata: {
    navigationMode: 'nonlinear',
    submissionMode: 'simultaneous'
  },
  sections: [
    {
      identifier: 'algebra',
      title: 'Algebra',
      visible: true,
      fixed: false,
      shuffle: true,
      itemRefs: [
        {
          identifier: 'q1',
          href: 'items/algebra-1.xml',
          required: true,
          weight: 2.0,
          category: ['algebra', 'equations']
        }
      ]
    }
  ],
  outcomeProcessingXml: `<outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE" weightIdentifier="SCORE"/>
      </sum>
    </setOutcomeValue>
  </outcomeProcessing>`
};
```

### Adaptive Assessment Example

```typescript
const adaptiveAssessment = {
  id: 'adaptive-test',
  title: 'Adaptive Test',
  sections: [
    {
      identifier: 'screening',
      title: 'Screening',
      itemRefs: [
        {
          identifier: 'screener',
          href: 'items/screener.xml',
          // Exit test if score too low
          branchRule: [
            {
              xml: `<branchRule target="EXIT_TEST">
  <lt>
    <variable identifier="SCORE"/>
    <baseValue baseType="float">0.5</baseValue>
  </lt>
</branchRule>`
            }
          ]
        }
      ]
    }
  ]
};
```

### Item Banking Example

```typescript
const itemBankAssessment = {
  id: 'randomized-test',
  title: 'Test with Item Banking',
  sections: [
    {
      identifier: 'pool',
      title: 'Question Pool',
      // Select 3 items randomly from 10
      selection: {
        select: 3,
        withReplacement: false
      },
      shuffle: true,
      itemRefs: [
        { identifier: 'q1', href: 'items/q1.xml', required: false },
        { identifier: 'q2', href: 'items/q2.xml', required: false },
        // ... 8 more items
      ]
    }
  ]
};
```

## IMS Content Package Generation

Generate complete IMS CP packages for distribution:

```typescript
const plugin = new PieToQti2Plugin({
  generatePackage: true,
  passageStrategy: 'external',
  passageResolver: async (passageId) => {
    // Load passage content
  }
});

const result = await plugin.transform({ content: pieItem });

// Generate package structure:
// package/
//   imsmanifest.xml      <- result.manifest
//   items/
//     item-1.xml         <- result.items[0].content
//   passages/
//     passage-1.xml      <- result.passageFiles[0].xml
```

## Best Practices

### 1. Use Stable Identifiers

Always use stable, descriptive identifiers:

```typescript
// ✅ Good
const item = {
  id: 'algebra-quadratic-1',
  baseId: 'item-stable-123'
};

// ❌ Bad
const item = {
  id: 'uuid-abc-def-ghi'
};
```

### 2. Preserve QTI Logic as XML

For assessments, store complex logic as QTI XML strings:

```typescript
// ✅ Good: Store as XML
const assessment = {
  outcomeProcessingXml: `<outcomeProcessing>...</outcomeProcessing>`,
  sections: [
    {
      itemRefs: [
        {
          branchRule: [{ xml: '<branchRule>...</branchRule>' }]
        }
      ]
    }
  ]
};

// ❌ Bad: Try to model QTI as objects
const assessment = {
  scoring: { type: 'sum' }  // Doesn't preserve QTI semantics
};
```

### 3. Test Round-Trips

Always verify lossless transformation:

```typescript
// Original
const original = createPieItem();

// PIE → QTI → PIE
const qtiResult = await pieToQti.transform({ content: original });
const qtiXml = qtiResult.items[0].content;

const pieResult = await qtiToPie.transform({ content: qtiXml });
const reconstructed = pieResult.items[0].content;

// Verify
assert.deepEqual(reconstructed, original);
```

### 4. Handle Metadata Properly

Use `searchMetaData` for content metadata:

```typescript
const pieItem = {
  id: 'item-1',
  searchMetaData: {
    subject: 'Mathematics',
    gradeLevel: ['8', '9'],
    DOK: 'DOK3',
    bloomsTaxonomy: 'Apply',
    difficulty: 'medium'
  },
  config: { models: [...] }
};

// Preserved in QTI as custom metadata fields
// Round-trips perfectly back to PIE
```

## Common Patterns

### Pattern 1: Bulk Content Export

```typescript
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';
import * as fs from 'fs/promises';
import * as path from 'path';

async function exportPieItems(pieItems: any[], outputDir: string) {
  const plugin = new PieToQti2Plugin({
    generatePackage: true,
    passageStrategy: 'external'
  });

  for (const pieItem of pieItems) {
    const result = await plugin.transform({ content: pieItem });

    // Save item
    const itemPath = path.join(outputDir, 'items', `${pieItem.id}.xml`);
    await fs.writeFile(itemPath, result.items[0].content);

    // Save passages
    for (const passage of result.passageFiles || []) {
      const passagePath = path.join(outputDir, passage.filePath);
      await fs.writeFile(passagePath, passage.xml);
    }

    // Save manifest
    if (result.manifest) {
      await fs.writeFile(
        path.join(outputDir, 'imsmanifest.xml'),
        result.manifest
      );
    }
  }
}
```

### Pattern 2: Content Migration

```typescript
import { Qti22ToPiePlugin } from '@pie-qti/qti2-to-pie';
import { PieToQti2Plugin } from '@pie-qti/pie-to-qti2';

async function migrateQtiToPie(qtiXml: string): Promise<any> {
  const qtiToPie = new Qti22ToPiePlugin();

  // Import QTI
  const result = await qtiToPie.transform({ content: qtiXml });
  const pieItem = result.items[0].content;

  // Now you can:
  // - Store in PIE database
  // - Render in PIE player
  // - Edit in PIE authoring tool

  return pieItem;
}
```

### Pattern 3: Round-Trip Validation

```typescript
async function validateRoundTrip(pieItem: any): Promise<boolean> {
  const pieToQti = new PieToQti2Plugin();
  const qtiToPie = new Qti22ToPiePlugin();

  try {
    // PIE → QTI
    const qtiResult = await pieToQti.transform({ content: pieItem });
    const qtiXml = qtiResult.items[0].content;

    // QTI → PIE
    const pieResult = await qtiToPie.transform({ content: qtiXml });
    const reconstructed = pieResult.items[0].content;

    // Compare (deep equality)
    return JSON.stringify(pieItem) === JSON.stringify(reconstructed);
  } catch (error) {
    console.error('Round-trip failed:', error);
    return false;
  }
}
```

## Examples

### Run Comprehensive Examples

```bash
# Item transformation examples
bun test packages/pie-to-qti2/tests/integration

# Assessment transformation examples
bun run packages/pie-to-qti2/examples/assessment-transformation.ts

# Round-trip validation
bun test packages/qti2-to-pie/tests/integration/passage-roundtrip.test.ts
```

## Documentation

### Package-Specific Guides

- **[@pie-qti/pie-to-qti2 README](../packages/pie-to-qti2/README.md)** - PIE to QTI transformation
- **[@pie-qti/qti2-to-pie README](../packages/qti2-to-pie/README.md)** - QTI to PIE transformation

### Feature Guides

- **[Assessment Transformations](../packages/pie-to-qti2/docs/ASSESSMENT-TRANSFORMATIONS.md)** - Complete assessment guide
- **[External Passages](../packages/pie-to-qti2/docs/EXTERNAL-PASSAGES.md)** - External passage support
- **[Manifest Generation](../packages/pie-to-qti2/docs/MANIFEST-GENERATION.md)** - IMS CP generation
- **[QTI 2.2.2 Compliance](../packages/pie-to-qti2/docs/QTI-COMPLIANCE.md)** - Standards compliance

### Technical Guides

- **[Vendor Customization](../packages/qti2-to-pie/docs/VENDOR_CUSTOMIZATION_GUIDE.md)** - Vendor extensions

## Troubleshooting

### Issue: "PIE item has no models"

**Cause:** Item structure is incorrect

**Solution:** Ensure PIE items have `config.models` array:

```typescript
const pieItem = {
  id: 'item-1',
  config: {
    models: [/* ... */]  // Required!
  }
};
```

### Issue: Outcome Processing Not Preserved

**Cause:** Missing `outcomeProcessingXml` property

**Solution:** Add outcomeProcessing as XML string:

```typescript
const assessment = {
  sections: [/* ... */],
  outcomeProcessingXml: `<outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum><testVariables variableIdentifier="SCORE"/></sum>
    </setOutcomeValue>
  </outcomeProcessing>`
};
```

### Issue: Round-Trip Doesn't Preserve Data

**Cause:** Using non-standard PIE properties

**Solution:** Use documented PIE schema and `searchMetaData` for custom metadata:

```typescript
const pieItem = {
  id: 'item-1',
  searchMetaData: {
    customField: 'value'  // Custom metadata goes here
  },
  config: {
    models: [/* ... */]
  }
};
```

## Support

For issues or questions:

1. Check package READMEs and documentation
2. Review examples and test files
3. Open an issue on GitHub with:
   - PIE/QTI content structure
   - Transformation code
   - Error messages
   - Expected vs. actual output

## License

ISC
