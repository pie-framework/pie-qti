# QTI Test Fixtures

This directory contains reusable QTI XML fixtures for transformer tests.

## Usage

Load fixtures using the `loadFixture()` helper from test-utils:

```typescript
import { loadFixture, parseQtiItem } from '../test-utils.js';
import { transformMultipleChoice } from '../../src/transformers/multiple-choice.js';

test('should transform multiple choice item', async () => {
  const qtiXml = loadFixture('multiple-choice'); // Loads fixtures/multiple-choice.xml
  const itemElement = parseQtiItem(qtiXml);

  const result = await transformMultipleChoice(itemElement, 'mc-001');

  expect(result.config.models[0].element).toBe('@pie-element/multiple-choice');
});
```

## Available Fixtures

### `multiple-choice.xml`
Basic single-select multiple choice question with 4 options.

**Question**: What is 2 + 2?
**Correct Answer**: 4
**Type**: Single-select (radio)

### `match.xml`
Basic matching interaction pairing stems with options.

**Question**: Match each animal to its category
**Correct Matches**: Dog→Mammal, Salmon→Fish
**Type**: Directed pair matching

### `hotspot.xml`
Basic hotspot interaction with image and clickable regions.

**Question**: Click on the correct region
**Correct Region**: hotspot1 (rectangle at 50,50,150,150)
**Type**: Graphic hotspot

### `extended-response.xml`

Essay question with extended text entry.

**Question**: Explain the significance of the American Revolution
**Expected Lines**: 10
**Type**: Extended text entry / Essay

### `ebsr.xml`

Evidence-Based Selected Response (two-part question).

**Part A**: What is the main idea? (Water moves in a continuous cycle)
**Part B**: Which evidence supports your answer?
**Type**: EBSR (Two choice interactions)

### `drag-in-the-blank.xml`

Gap match interaction with draggable choices.

**Question**: Drag the correct animal type into each blank
**Correct Answers**: cat→mammal, salmon→fish
**Type**: Gap match (drag-in-the-blank)

### `explicit-constructed-response.xml`

Text entry interaction with multiple blanks.

**Question**: Geography fill-in (Paris, London)
**Correct Answers**: Paris (capital of France), London (capital of UK)
**Type**: Text entry (explicit constructed response)

### `select-text.xml`

Hot text interaction for selecting words in a passage.

**Question**: Select all the verbs
**Correct Answers**: sat
**Type**: Hot text selection

## Creating New Fixtures

When adding new fixtures:

1. **Use descriptive filenames**: `interaction-type-variant.xml`
   - Good: `hotspot-polygon.xml`, `match-asymmetric.xml`
   - Bad: `test1.xml`, `example.xml`

2. **Include complete QTI XML**: Full `<assessmentItem>` with namespaces

3. **Add documentation**: Update this README with:
   - Fixture name and description
   - Key characteristics (question, correct answer, special features)
   - Interaction type

4. **Keep it simple**: Fixtures should be minimal examples, not exhaustive

5. **Use standard identifiers**:
   - Item ID: `{type}-{variant}-001`
   - Response ID: `RESPONSE` (or `RESPONSE_A`, `RESPONSE_B` for EBSR)
   - Choice IDs: Descriptive (e.g., `choiceA`, `hotspot1`, `A C`)

## Example Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="interaction-type-001"
                title="Descriptive Title"
                adaptive="false"
                timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="..." baseType="...">
    <correctResponse>
      <value>...</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <!-- Interaction content here -->
  </itemBody>
</assessmentItem>
```

## Benefits of Using Fixtures

- **Consistency**: Reuse the same test data across multiple tests
- **Maintainability**: Update fixture once, all tests benefit
- **Readability**: Tests focus on behavior, not XML structure
- **Real-world data**: Can use actual QTI exports as fixtures
- **Separation of concerns**: Test logic separate from test data

## Guidelines

- **Don't over-fixture**: Only extract to fixtures if reused across multiple tests
- **Inline is ok**: Simple, one-off test XML can stay inline using `createQtiWrapper()`
- **Variants welcome**: Create variants like `match-asymmetric.xml` for edge cases
- **Keep minimal**: Remove unnecessary attributes and content
