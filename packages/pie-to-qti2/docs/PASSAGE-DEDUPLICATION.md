# Passage Deduplication

This document describes the passage deduplication utilities for batch transformations in pie-to-qti2.

## Overview

When transforming multiple PIE items that share the same passage, deduplication ensures each passage is generated only once. This reduces file size, improves consistency, and follows IMS Content Package best practices.

## The Problem

Consider a reading comprehension assessment with 5 questions based on the same passage:

```typescript
const items = [
  { id: 'item-1', passage: 'passage-science-1', ... },
  { id: 'item-2', passage: 'passage-science-1', ... },
  { id: 'item-3', passage: 'passage-science-1', ... },
  { id: 'item-4', passage: 'passage-science-1', ... },
  { id: 'item-5', passage: 'passage-science-1', ... },
];
```

**Without deduplication**: Each item transformation generates the same passage file 5 times
**With deduplication**: The passage is generated once, and all items reference it

## Usage

### PassageRegistry

The `PassageRegistry` class tracks generated passages to prevent duplicates:

```typescript
import { PassageRegistry } from '@pie-qti/pie-to-qti2';

const registry = new PassageRegistry();

// Register passages as they're generated
for (const item of items) {
  const passageFile = await generatePassageForItem(item);

  if (registry.register(passageFile)) {
    // New passage - save to disk
    await writeFile(passageFile.filePath, passageFile.xml);
  } else {
    // Duplicate - already saved
    console.log(`Skipping duplicate passage: ${passageFile.id}`);
  }
}

// Get all unique passages
const allPassages = registry.getAll();
console.log(`Generated ${allPassages.length} unique passages`);
```

### Extract Dependencies

Analyze items to find what passages they need:

```typescript
import { extractPassageDependencies } from '@pie-qti/pie-to-qti2';

const items = [
  { id: 'item-1', passage: 'passage-a', ... },
  { id: 'item-2', passage: 'passage-b', ... },
  { id: 'item-3', passage: 'passage-a', ... }, // Shared
];

const passageIds = extractPassageDependencies(items);
// ['passage-a', 'passage-b'] - deduplicated list
```

### Find Shared Passages

Identify which passages are shared across multiple items:

```typescript
import { findSharedPassages } from '@pie-qti/pie-to-qti2';

const sharedPassages = findSharedPassages(items);

for (const [passageId, referencingItems] of sharedPassages.entries()) {
  console.log(`Passage ${passageId} is shared by ${referencingItems.length} items:`);
  for (const item of referencingItems) {
    console.log(`  - ${item.id}`);
  }
}
```

### Deduplicate Passage Files

Combine passage files from multiple transformations:

```typescript
import { deduplicatePassageFiles } from '@pie-qti/pie-to-qti2';

// Transform items individually
const result1 = await plugin.transform({ content: item1 }, context);
const result2 = await plugin.transform({ content: item2 }, context);
const result3 = await plugin.transform({ content: item3 }, context);

// Collect passage files
const passageLists = [
  result1.passageFiles || [],
  result2.passageFiles || [],
  result3.passageFiles || [],
];

// Deduplicate
const uniquePassages = deduplicatePassageFiles(passageLists);
console.log(`${uniquePassages.length} unique passages from 3 items`);
```

### Analyze Usage

Compute statistics about passage sharing and deduplication savings:

```typescript
import { analyzePassageUsage } from '@pie-qti/pie-to-qti2';

const stats = analyzePassageUsage(items);

console.log(`Total passage references: ${stats.totalPassages}`);
console.log(`Unique passages: ${stats.uniquePassages}`);
console.log(`Duplicates avoided: ${stats.duplicatesRemoved}`);
console.log(`Savings: ${(stats.duplicatesRemoved / stats.totalPassages * 100).toFixed(1)}%`);

if (stats.sharedPassages.size > 0) {
  console.log('\nShared passages:');
  for (const [passageId, count] of stats.sharedPassages.entries()) {
    console.log(`  ${passageId}: referenced by ${count} items`);
  }
}
```

## Complete Batch Example

Here's a complete example of transforming multiple items with deduplication:

```typescript
import { PieToQti2Plugin, PassageRegistry, analyzePassageUsage } from '@pie-qti/pie-to-qti2';

async function transformBatch(items: PieItem[]) {
  // Analyze passage usage
  const stats = analyzePassageUsage(items);
  console.log(`Processing ${items.length} items with ${stats.uniquePassages} unique passages`);

  // Create registry for deduplication
  const passageRegistry = new PassageRegistry();

  // Configure plugin
  const plugin = new PieToQti2Plugin({
    passageStrategy: 'external',
    passageResolver: async (passageId) => {
      // Load passage content
      const passage = await database.passages.findById(passageId);
      return {
        id: passage.id,
        content: passage.htmlContent,
        title: passage.title
      };
    }
  });

  // Transform all items
  const itemResults = [];
  for (const item of items) {
    const result = await plugin.transform({ content: item }, context);
    itemResults.push(result);

    // Register passages
    const passageFiles = result.passageFiles || [];
    for (const passage of passageFiles) {
      if (passageRegistry.register(passage)) {
        console.log(`Generated new passage: ${passage.id}`);
      } else {
        console.log(`Reusing existing passage: ${passage.id}`);
      }
    }
  }

  // Save all unique passages
  const uniquePassages = passageRegistry.getAll();
  for (const passage of uniquePassages) {
    await writeFile(`output/${passage.filePath}`, passage.xml);
  }

  // Save all items
  for (let i = 0; i < itemResults.length; i++) {
    const itemXml = itemResults[i].items[0].content;
    await writeFile(`output/items/item-${i + 1}.xml`, itemXml);
  }

  console.log(`\nSaved ${items.length} items and ${uniquePassages.length} passages`);
  console.log(`Avoided ${stats.duplicatesRemoved} duplicate passages`);
}
```

## Manifest Integration

When generating IMS Content Package manifests for batches, deduplication ensures each passage resource is declared once:

```typescript
import { generateManifest, deduplicatePassageFiles } from '@pie-qti/pie-to-qti2';

// Transform items and collect passage files
const passageLists = [];
const itemMetadata = [];

for (const item of items) {
  const result = await plugin.transform({ content: item }, context);
  passageLists.push(result.passageFiles || []);

  itemMetadata.push({
    id: item.id,
    filePath: `items/${item.id}.xml`,
    dependencies: (result.passageFiles || []).map(p => p.id),
  });
}

// Deduplicate passages
const uniquePassages = deduplicatePassageFiles(passageLists);

// Generate manifest with deduplicated passages
const manifestXml = generateManifest({
  items: itemMetadata,
  passages: uniquePassages.map(p => ({
    id: p.id,
    filePath: p.filePath,
  })),
  options: {
    packageId: 'batch-assessment-package',
  },
});
```

The manifest will declare each passage resource once, with multiple items referencing it via `<dependency>` elements.

## Benefits

### File Size Reduction

For a typical assessment with 10 questions sharing 2 passages (1500 words each):

- **Without deduplication**: 10 items × 2 passages × ~10KB = ~200KB of duplicate content
- **With deduplication**: 2 passages × ~10KB = ~20KB
- **Savings**: ~180KB (90% reduction in passage data)

### Consistency

Deduplication ensures all items use the exact same passage content. If a passage is updated, it only needs to be regenerated once.

### IMS CP Compliance

IMS Content Package specification recommends declaring shared resources once and using `<dependency>` references. Deduplication follows this best practice.

### Performance

Generating and writing fewer files improves transformation performance, especially for large assessments.

## API Reference

### `PassageRegistry`

Tracks generated passages to prevent duplicates.

**Methods:**
- `register(passage: GeneratedPassageFile): boolean` - Register passage, returns false if duplicate
- `has(passageId: string): boolean` - Check if passage is registered
- `get(passageId: string): GeneratedPassageFile | undefined` - Get passage by ID
- `getAll(): GeneratedPassageFile[]` - Get all registered passages
- `getAllIds(): string[]` - Get all passage IDs
- `clear(): void` - Clear registry
- `size: number` - Number of registered passages

### `extractPassageDependencies(items: PieItem[]): string[]`

Extract unique passage IDs from items.

**Returns:** Deduplicated array of passage IDs

### `findSharedPassages(items: PieItem[]): Map<string, PieItem[]>`

Find passages referenced by multiple items.

**Returns:** Map of passage ID to items that reference it (only passages shared by 2+ items)

### `deduplicatePassageFiles(passageFileLists: GeneratedPassageFile[][]): GeneratedPassageFile[]`

Deduplicate passage files from multiple transform results.

**Returns:** Unique passages (first occurrence of each ID is kept)

### `analyzePassageUsage(items: PieItem[]): DeduplicationStats`

Compute statistics about passage sharing.

**Returns:**
```typescript
{
  totalPassages: number;        // Total passage references
  uniquePassages: number;       // Unique passage IDs
  duplicatesRemoved: number;    // Savings from deduplication
  sharedPassages: Map<string, number>; // Passage ID → reference count (for passages used 2+ times)
}
```

## Implementation Notes

### First-Occurrence Preservation

When duplicates are detected, the first registered passage is preserved. This ensures consistent behavior across batch transformations.

### Performance Characteristics

- `PassageRegistry.register()`: O(1) - Hash map lookup
- `extractPassageDependencies()`: O(n) - Single pass over items
- `findSharedPassages()`: O(n) - Single pass over items
- `deduplicatePassageFiles()`: O(n) - Single pass over all passages
- `analyzePassageUsage()`: O(n) - Single pass over items

All operations are efficient for typical assessment sizes (1-1000 items).

### Memory Usage

The `PassageRegistry` stores full passage content in memory. For very large batches (1000+ items with large passages), consider processing in chunks and writing passages to disk as they're generated.

## Related Documentation

- [External Passages](./EXTERNAL-PASSAGES.md) - External passage resolution and generation
- [Manifest Generation](./MANIFEST-GENERATION.md) - IMS Content Package manifests
- [Plugin API](../README.md#api) - Plugin configuration options

## Testing

See `tests/unit/passage-deduplication.test.ts` for comprehensive tests covering:

- PassageRegistry operations
- Dependency extraction
- Shared passage detection
- File deduplication
- Usage analysis and statistics

All tests verify correct behavior with various combinations of shared, unique, and missing passages.
