# @pie-qti/test-utils

Shared test utilities for PIE-QTI packages. Provides mocks, helpers, fixtures, and assertions to make testing transformations, plugins, and storage implementations easier.

## Installation

```bash
# In your package
bun add -D @pie-qti/test-utils
```

## Quick Start

```typescript
import {
  MockStorageBackend,
  createMockPlugin,
  createTestEngine,
  expectSuccessfulTransform,
} from '@pie-qti/test-utils';

test('vendor plugin transforms correctly', async () => {
  // Create mock storage with fixtures
  const storage = new MockStorageBackend({
    'input.xml': '<assessmentItem>...</assessmentItem>',
  });

  // Create test engine with plugins
  const engine = createTestEngine({
    plugins: [createMockPlugin('test', 'qti22', 'pie')],
    storage,
  });

  // Run transformation
  const handle = await engine.transform('input content', {
    sourceFormat: 'qti22',
    targetFormat: 'pie',
  });
  const result = await handle.result();

  // Assert results
  expectSuccessfulTransform(result);
});
```

## API Reference

### Mock Implementations

#### MockStorageBackend

In-memory storage backend for testing. Implements the full `StorageBackend` interface.

```typescript
import { MockStorageBackend } from '@pie-qti/test-utils';

// Create with initial files
const storage = new MockStorageBackend({
  'file.txt': 'content',
  'data.json': JSON.stringify({ foo: 'bar' }),
  'binary.bin': Buffer.from([0x01, 0x02]),
});

// Use like a real storage backend
await storage.writeText('output.txt', 'result');
const content = await storage.readText('output.txt');

// Test-specific helpers
expect(storage.hasFile('output.txt')).toBe(true);
expect(storage.getFileCount()).toBe(4);
const allFiles = storage.listAllFiles();
storage.clear();
```

**Test Helpers:**
- `getFile(path)` - Get file Buffer directly
- `hasFile(path)` - Check if file exists (synchronous)
- `listAllFiles()` - Get all file paths
- `clear()` - Remove all files
- `getFileCount()` - Count files
- `isInitialized()` - Check initialization status

#### MockTransformPlugin

Configurable mock plugin for testing plugin registry, engine, and orchestration.

```typescript
import { MockTransformPlugin, createMockPlugin } from '@pie-qti/test-utils';

// Simple mock
const plugin = createMockPlugin('my-plugin', 'qti22', 'pie', 500); // priority 500

// Custom behavior
const customPlugin = new MockTransformPlugin('custom', 'qti22', 'pie', {
  priority: 500,
  canHandle: async (input) => input.content.includes('vendor-specific'),
  transform: async (input) => ({
    items: [{ id: 'test', element: 'custom-element' }],
    format: 'pie',
    metadata: {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
      pluginId: 'custom',
      timestamp: new Date(),
      itemCount: 1,
      processingTime: 0,
    },
  }),
});

// Test-specific helpers
expect(plugin.getTransformCallCount()).toBe(1);
expect(plugin.getCanHandleCallCount()).toBe(2);
expect(plugin.getLastInput()).toMatchObject({ ... });
plugin.resetCounters();
```

**Factory Functions:**
- `createMockPlugin(id, source, target, priority?)` - Simple mock
- `createRejectingPlugin(id, source, target)` - Always rejects canHandle
- `createFailingPlugin(id, source, target, message?)` - Throws error on transform

#### Mock Loggers

```typescript
import { CaptureLogger, SilentLogger, ConsoleLogger } from '@pie-qti/test-utils';

// Capture logs for assertions
const logger = new CaptureLogger();
logger.info('test message', 'item-123');
expect(logger.hasMessage('test message')).toBe(true);
expect(logger.getLogsByLevel('info').length).toBe(1);

// Silent logger (default for tests)
const silent = new SilentLogger();

// Console logger (for debugging)
const console = new ConsoleLogger('[MY-TEST]');
```

### Test Helpers

#### createTestEngine

Factory for creating pre-configured TransformEngine instances.

```typescript
import { createTestEngine, MockStorageBackend } from '@pie-qti/test-utils';

const engine = createTestEngine({
  plugins: [myPlugin, otherPlugin],
  storage: new MockStorageBackend(),
  logger: new SilentLogger(),
});
```

#### Fixture Loading

Load test fixtures from packages or shared locations.

```typescript
import { loadFixture, loadSharedFixture } from '@pie-qti/test-utils';

// Load from specific package
const qti = loadFixture('qti2-to-pie', 'multiple-choice/basic.xml');

// Load from shared test-utils fixtures
const vendorQti = loadSharedFixture('vendors/pearson/hotspot-001.xml');

// Load binary files
import { loadFixtureBuffer, loadSharedFixtureBuffer } from '@pie-qti/test-utils';
const imageBuffer = loadSharedFixtureBuffer('assets/test-image.png');
```

**Shared Fixture Structure:**
```
packages/test-utils/fixtures/
├── qti/                     # Standard QTI samples
│   ├── multiple-choice/
│   ├── hotspot/
│   └── extended-text/
├── vendors/                 # Vendor-specific samples
│   ├── aa/
│   ├── bb/
│   └── cc/
└── pie/                     # PIE model samples
    ├── multiple-choice/
    └── hotspot/
```

#### QTI Helpers

Utilities for creating and parsing QTI XML in tests.

```typescript
import {
  parseQtiItem,
  createQtiWrapper,
  createResponseDeclaration,
  createChoiceInteraction,
} from '@pie-qti/test-utils';

// Create QTI XML
const qti = createQtiWrapper(`
  ${createResponseDeclaration('RESPONSE', 'single', ['A'])}
  ${createChoiceInteraction('RESPONSE', [
    { id: 'A', text: 'Correct answer' },
    { id: 'B', text: 'Wrong answer' },
  ])}
`, 'test-001', 'Test Item');

// Parse QTI
const element = parseQtiItem(qti);
expect(element.getAttribute('identifier')).toBe('test-001');
```

**Available Functions:**
- `parseQtiItem(xml)` - Parse and return assessmentItem element
- `createQtiWrapper(content, id?, title?)` - Wrap content in assessmentItem
- `createResponseDeclaration(id, cardinality, correctValues, baseType?)` - Create response declaration
- `createOutcomeDeclaration(id, baseType, defaultValue?)` - Create outcome declaration
- `createChoiceInteraction(responseId, choices, shuffle?)` - Create choice interaction
- `parseElement(xml)` - Parse any XML element

### Assertion Helpers

Common assertions for testing transforms and PIE models.

```typescript
import {
  expectValidPieModel,
  expectSuccessfulTransform,
  expectLosslessRoundTrip,
  expectValidChoiceInteraction,
} from '@pie-qti/test-utils';

// Validate PIE model structure
expectValidPieModel(pieModel);

// Validate transform output
expectSuccessfulTransform(result, 3); // Expect 3 items

// Test round-trip transformation
await expectLosslessRoundTrip(originalQti, engine);

// Validate choice interaction
expectValidChoiceInteraction(model, 4); // Expect 4 choices
```

**Available Assertions:**
- `expectValidPieModel(model)` - Validate PIE model structure
- `expectSuccessfulTransform(result, count?)` - Validate transform output
- `expectLosslessRoundTrip(qti, engine, normalizeWs?)` - Test QTI → PIE → QTI
- `expectValidChoiceInteraction(interaction, count?)` - Validate choice interaction
- `expectTransformError(result, message?)` - Validate error result
- `expectMetadata(metadata, fields)` - Validate metadata fields
- `expectArrayContains(array, property, values)` - Check array contains values

## Common Patterns

### Testing a Vendor Plugin

```typescript
import {
  MockStorageBackend,
  createTestEngine,
  loadSharedFixture,
  expectSuccessfulTransform,
} from '@pie-qti/test-utils';
import { MyVendorPlugin } from '../src/plugin';

test('vendor plugin transforms correctly', async () => {
  const storage = new MockStorageBackend({
    'input.xml': loadSharedFixture('vendors/myvendor/example-001.xml'),
  });

  const engine = createTestEngine({
    plugins: [new MyVendorPlugin()],
    storage,
  });

  const handle = await engine.transform(
    await storage.readText('input.xml'),
    { sourceFormat: 'qti22', targetFormat: 'pie' }
  );
  const result = await handle.result();

  expectSuccessfulTransform(result);
  expect(result.items[0].element).toBe('my-vendor-element');
});
```

### Testing Plugin Priority

```typescript
import { createMockPlugin, createTestEngine } from '@pie-qti/test-utils';

test('higher priority plugin is selected', () => {
  const lowPriority = createMockPlugin('low', 'qti22', 'pie', 100);
  const highPriority = createMockPlugin('high', 'qti22', 'pie', 500);

  const engine = createTestEngine({
    plugins: [lowPriority, highPriority],
  });

  // Verify high priority plugin would be selected
  const registry = (engine as any).registry;
  const selected = registry.findPlugin('qti22', 'pie');
  expect(selected?.id).toBe('high');
});
```

### Testing Storage Operations

```typescript
import { MockStorageBackend } from '@pie-qti/test-utils';

test('plugin writes output to storage', async () => {
  const storage = new MockStorageBackend({
    'input.xml': '<assessmentItem>...</assessmentItem>',
  });

  await myPlugin.transform(input, { storage });

  expect(storage.hasFile('output.json')).toBe(true);
  const output = await storage.readText('output.json');
  const data = JSON.parse(output);
  expect(data.items).toHaveLength(1);
});
```

### Testing with Captured Logs

```typescript
import { CaptureLogger, createTestEngine } from '@pie-qti/test-utils';

test('plugin logs transformation steps', async () => {
  const logger = new CaptureLogger();
  const engine = createTestEngine({
    plugins: [myPlugin],
    logger,
  });

  await engine.transform(input, {
    sourceFormat: 'qti22',
    targetFormat: 'pie',
  });

  expect(logger.hasMessage('Starting transformation')).toBe(true);
  expect(logger.getLogsByLevel('error').length).toBe(0);
});
```

### Round-Trip Testing

```typescript
import {
  loadSharedFixture,
  createTestEngine,
  expectLosslessRoundTrip,
} from '@pie-qti/test-utils';

test('QTI round-trip is lossless', async () => {
  const qti = loadSharedFixture('qti/multiple-choice/basic.xml');
  const engine = createTestEngine({
    plugins: [qti22ToPiePlugin, pieToQti22Plugin],
  });

  await expectLosslessRoundTrip(qti, engine);
});
```

## Benefits for Vendor Extensions

Before test-utils (typical vendor plugin test):
```typescript
// ~140 lines of boilerplate
class TestStorage implements StorageBackend { /* 50+ lines */ }
function createMockPlugin(...) { /* 30+ lines */ }
function loadFixture(...) { /* 20+ lines */ }
// ... plus QTI helpers, assertions, etc.
```

After test-utils (same test):
```typescript
import {
  MockStorageBackend,
  createMockPlugin,
  createTestEngine,
  loadSharedFixture,
  expectSuccessfulTransform,
} from '@pie-qti/test-utils';

// ~10-20 lines of actual test code
```

**Result**: Vendor plugin tests are **5-10x shorter** and more maintainable.

## Contributing

When adding new test utilities:

1. Add implementation to appropriate directory:
   - `src/mocks/` - Mock implementations of interfaces
   - `src/helpers/` - Helper functions and factories
   - `fixtures/` - Shared test fixtures

2. Export from `src/index.ts`

3. Add tests in `tests/`

4. Update this README with examples

5. Consider adding to `TEST-UTILITIES-OVERVIEW.md` if it's a major feature

## License

See project root LICENSE file.
