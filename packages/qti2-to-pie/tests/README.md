# QTI 2.2 to PIE Transformation Tests

This directory contains tests for QTI 2.2 to PIE transformation logic.

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/transformers/multiple-choice.test.ts

# Run in watch mode
bun test --watch

# Run only integration tests
bun test tests/integration/
```

## Test Organization

```
tests/
├── test-utils.ts              # Shared test utilities
├── plugin.test.ts             # Plugin integration tests
├── utils/
│   └── qti-validator.test.ts  # QTI validation tests
├── transformers/              # Individual transformer tests
│   ├── drag-in-the-blank.test.ts
│   ├── ebsr.test.ts
│   ├── explicit-constructed-response.test.ts
│   ├── extended-response.test.ts
│   ├── hotspot.test.ts
│   ├── image-cloze-association.test.ts
│   ├── inline-dropdown.test.ts
│   ├── match-list.test.ts
│   ├── match.test.ts
│   ├── multiple-choice.test.ts
│   ├── passage.test.ts
│   ├── placement-ordering.test.ts
│   └── select-text.test.ts
└── integration/               # Integration tests with real QTI samples
    ├── real-world.test.ts
    ├── check-output.js
    └── fixtures/              # Real-world QTI samples
        ├── README.md
        └── *.xml
```

## Test Types

### Transformer Tests

Each transformer test file (`tests/transformers/*.test.ts`) tests the transformation of a specific QTI interaction type to PIE format.

**Structure:**
```typescript
describe('transformMultipleChoice', () => {
  test('should transform basic single-select QTI', () => {
    const qtiXml = createQtiWrapper(`
      <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
        <correctResponse><value>A</value></correctResponse>
      </responseDeclaration>
      <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <simpleChoice identifier="A">Choice A</simpleChoice>
          <simpleChoice identifier="B">Choice B</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = transformMultipleChoice(itemElement);

    expect(result.id).toBeDefined();
    expect(result.config.models[0].choiceMode).toBe('radio');
    expect(result.config.models[0].choices).toHaveLength(2);
  });
});
```

**Coverage:**
- Basic transformations
- Advanced features (HTML content, shuffling, orientations)
- Edge cases (missing correct responses, empty choices)
- Error handling

### Integration Tests

Integration tests (`tests/integration/real-world.test.ts`) use real-world QTI samples from the `fixtures/` directory to ensure transformations work with actual assessment content.

**Features tested:**
- Complete QTI assessmentItem transformation
- Multiple interaction types in single item
- Complex HTML content
- Image references and resources
- Performance benchmarks

### Validation Tests

Tests for QTI XML validation utilities (`tests/utils/qti-validator.test.ts`).

## Test Utilities

### parseQtiItem(qtiXml: string)

Parses QTI XML and returns the assessmentItem element.

```typescript
import { parseQtiItem } from './test-utils.js';

const itemElement = parseQtiItem(qtiXml);
```

### createQtiWrapper(content: string, identifier?: string, title?: string)

Creates a complete QTI assessmentItem wrapper with standard attributes.

```typescript
import { createQtiWrapper } from './test-utils.js';

const qtiXml = createQtiWrapper(`
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <!-- interaction content -->
  </itemBody>
`, 'my-item-id', 'My Item Title');
```

### createResponseDeclaration(identifier, cardinality, correctValues, baseType?)

Creates a responseDeclaration XML element.

```typescript
import { createResponseDeclaration } from './test-utils.js';

const responseXml = createResponseDeclaration(
  'RESPONSE',
  'single',
  ['choiceA'],
  'identifier'
);
```

### TestLogger / SilentTestLogger

Loggers for test output control.

```typescript
import { TestLogger, SilentTestLogger } from './test-utils.js';

// For debugging - outputs to console
const logger = new TestLogger();

// For clean test output - no logging
const logger = new SilentTestLogger();
```

## Writing New Transformer Tests

When adding a new transformer, create a test file following this pattern:

```typescript
// tests/transformers/new-interaction.test.ts
import { describe, test, expect } from 'bun:test';
import { parseQtiItem, createQtiWrapper } from '../test-utils.js';
import { transformNewInteraction } from '../../src/transformers/new-interaction.js';

describe('transformNewInteraction', () => {
  test('should transform basic interaction', () => {
    const qtiXml = createQtiWrapper(`
      <!-- QTI content -->
    `);

    const itemElement = parseQtiItem(qtiXml);
    const result = transformNewInteraction(itemElement);

    // Assertions
    expect(result).toBeDefined();
  });

  test('should handle advanced features', () => {
    // Test advanced scenarios
  });

  test('should handle edge cases', () => {
    // Test edge cases
  });
});
```

## Best Practices

1. **Use Test Utilities**: Always use `parseQtiItem()` and `createQtiWrapper()` instead of repeating parsing logic

2. **Clear Test Names**: Test names should describe what is being tested
   - ✅ `should transform single-select to radio mode`
   - ❌ `test 1`

3. **Specific Assertions**: Assert on specific properties, not entire objects
   - ✅ `expect(result.config.models[0].choiceMode).toBe('radio')`
   - ❌ `expect(result).toMatchSnapshot()`

4. **Test Edge Cases**: Include tests for:
   - Missing required attributes
   - Empty collections
   - Invalid values
   - HTML content with special characters

5. **Avoid Hard-coding**: Use variables for repeated values
   ```typescript
   const responseId = 'RESPONSE';
   const choiceId = 'choiceA';
   // Use responseId and choiceId throughout test
   ```

## Test Statistics

- **Total tests**: 223
- **Total assertions**: 746
- **All passing**: ✅

### Breakdown by Type
- Transformer tests: 13 files, ~200 tests
- Integration tests: 1 file, ~20 tests
- Validation tests: 1 file, ~3 tests

## Performance Benchmarks

Integration tests include performance benchmarks:

- **Single item transformation**: < 100ms (typical)
- **Batch transformation (5 items)**: < 500ms (typical)

These thresholds can be configured via environment variables:
```bash
TEST_PERF_SINGLE=150 TEST_PERF_BATCH=750 bun test
```

## Fixtures

Integration tests use QTI samples that live in this repository under `packages/transform-app/static/samples/`
(plus a few minimal inline XML snippets) to validate transformations without pulling in third-party fixtures/licenses.

## Troubleshooting

### Import Errors

If you see `Cannot find module` errors, verify:
1. Import paths use `../../src/` from tests directory
2. File extensions include `.js` (ESM requirement)
3. TypeScript paths are configured in tsconfig.json

### Parser Errors

If QTI parsing fails:
1. Verify XML is well-formed
2. Check namespace declarations
3. Ensure assessmentItem is the root element

### Transform Errors

If transformations fail:
1. Verify required QTI elements are present
2. Check console output for warnings
3. Use TestLogger to see transformation details

## Contributing

When adding new tests:
1. Follow existing test structure
2. Use shared test utilities
3. Add edge case tests
4. Update this README if adding new patterns
5. Run all tests before committing
