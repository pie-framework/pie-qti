# @pie-qti/test-utils

Shared test utilities for PIE-QTI packages. Provides mock implementations, QTI XML builders, and transform assertions used by the repo's own test suites.

## Installation

```bash
# In your package
bun add -D @pie-qti/test-utils
```

## Quick Start

```typescript
import {
  MockStorageBackend,
  MockTransformPlugin,
  createMockPlugin,
  expectSuccessfulTransform,
} from '@pie-qti/test-utils';

test('mock plugin transforms into mock storage', async () => {
  const storage = new MockStorageBackend({
    'input.xml': '<assessmentItem>...</assessmentItem>',
  });

  const plugin = new MockTransformPlugin('test', 'qti22', 'pie', {
    mockItems: [{ id: 'item-1', element: 'extended-text' }],
  });

  const result = await plugin.transform({
    content: await storage.readText('input.xml'),
    format: 'qti22',
  });

  expectSuccessfulTransform(result, 1);
});
```

## API Reference

### MockStorageBackend

In-memory storage backend for testing. Implements the full `StorageBackend` interface (`@pie-qti/transform-types`).

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

**Test helpers:**
- `getFile(path)` - Get file Buffer directly
- `hasFile(path)` - Check if file exists (synchronous)
- `listAllFiles()` - Get all file paths
- `clear()` - Remove all files
- `getFileCount()` - Count files
- `isInitialized()` - Check initialization status

### MockTransformPlugin

Configurable mock implementation of the `TransformPlugin` contract (`@pie-qti/transform-types`) for testing plugin registries, engines, and orchestration.

```typescript
import { MockTransformPlugin, createMockPlugin } from '@pie-qti/test-utils';

// Simple mock (options object optional)
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

**Factory:** `createMockPlugin(id, sourceFormat, targetFormat, priority?)` builds a `MockTransformPlugin` with default behavior (`canHandle` returns true, `transform` returns an empty item list).

### SilentLogger

Re-exported from `@pie-qti/logger/server`. A `ServerLogger` whose methods are no-ops — useful as the default logger in tests that must produce no output.

```typescript
import { SilentLogger } from '@pie-qti/test-utils';

const logger = new SilentLogger();
logger.info('never printed anywhere');
```

### QTI XML Builders

Utilities for constructing QTI assessmentItem XML strings in tests.

```typescript
import {
  createQtiWrapper,
  createResponseDeclaration,
  createChoiceInteraction,
} from '@pie-qti/test-utils';

const qti = createQtiWrapper(`
  ${createResponseDeclaration('RESPONSE', 'single', ['A'])}
  ${createChoiceInteraction('RESPONSE', [
    { id: 'A', text: 'Correct answer' },
    { id: 'B', text: 'Wrong answer' },
  ])}
`, 'test-001', 'Test Item');
```

**Available functions:**
- `createQtiWrapper(content, id?, title?)` - Wrap content in an `assessmentItem` element (QTI 2.2 namespace)
- `createResponseDeclaration(id, cardinality, correctValues, baseType?)` - Create a response declaration
- `createChoiceInteraction(responseId, choices, shuffle?)` - Create a choice interaction

### Assertion Helpers

Common assertions for transform outputs and PIE models.

```typescript
import { expectValidPieModel, expectSuccessfulTransform } from '@pie-qti/test-utils';

// Validate PIE model structure
expectValidPieModel(pieModel);

// Validate transform output (metadata present, items array populated)
expectSuccessfulTransform(result, 3); // Expect exactly 3 items
```

**Available assertions:**
- `expectValidPieModel(model)` - Validate PIE model structure (`id`, `element`, optional flags)
- `expectSuccessfulTransform(result, count?)` - Validate a `TransformOutput` (items array, `metadata.sourceFormat`/`targetFormat`/`pluginId`/`timestamp`)

## Common Patterns

### Testing a Plugin Against Mock Storage

```typescript
import { MockStorageBackend } from '@pie-qti/test-utils';
import { MyVendorPlugin } from '../src/plugin';

test('vendor plugin writes output to storage', async () => {
  const storage = new MockStorageBackend({
    'input.xml': '<assessmentItem>...</assessmentItem>',
  });

  const plugin = new MyVendorPlugin(storage);

  await plugin.run('input.xml');

  expect(storage.hasFile('output.json')).toBe(true);
  const output = await storage.readText('output.json');
  const data = JSON.parse(output);
  expect(data.items).toHaveLength(1);
});
```

### Testing Plugin Selection by Priority

```typescript
import { createMockPlugin } from '@pie-qti/test-utils';
import { PluginRegistry } from '@pie-qti/transform-core';

test('higher priority plugin is selected', () => {
  const lowPriority = createMockPlugin('low', 'qti22', 'pie', 100);
  const highPriority = createMockPlugin('high', 'qti22', 'pie', 500);

  const registry = new PluginRegistry();
  registry.register(lowPriority);
  registry.register(highPriority);

  const selected = registry.findPlugin('qti22', 'pie');
  expect(selected?.id).toBe('high');
});
```

## Contributing

When adding new test utilities:

1. Add the implementation to the appropriate directory:
   - `src/mocks/` - Mock implementations of interfaces
   - `src/helpers/` - Helper functions and assertions

2. Export it from `src/index.ts`

3. Add tests in `tests/`

4. Update this README with examples

Keep the exported surface minimal: an export without a consumer in the workspace gets removed (see the repo's no-legacy policy).

## License

See project root LICENSE file.
