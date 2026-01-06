/**
 * Passage Deduplication Tests
 *
 * Tests passage deduplication utilities for batch transformations
 */

import { beforeEach, describe, expect, test } from 'bun:test';
import type { PieItem } from '@pie-framework/transform-types';
import type { GeneratedPassageFile } from '../../src/types/passages.js';
import {
  analyzePassageUsage,
  deduplicatePassageFiles,
  extractPassageDependencies,
  findSharedPassages,
  PassageRegistry,
} from '../../src/utils/passage-deduplication.js';

describe('PassageRegistry', () => {
  let registry: PassageRegistry;

  beforeEach(() => {
    registry = new PassageRegistry();
  });

  test('should register new passages', () => {
    const passage: GeneratedPassageFile = {
      id: 'passage-1',
      filePath: 'passages/passage-1.xml',
      xml: '<assessmentItem>...</assessmentItem>',
      metadata: {},
    };

    const added = registry.register(passage);

    expect(added).toBe(true);
    expect(registry.has('passage-1')).toBe(true);
    expect(registry.size).toBe(1);
  });

  test('should not register duplicate passages', () => {
    const passage1: GeneratedPassageFile = {
      id: 'passage-shared',
      filePath: 'passages/passage-shared.xml',
      xml: '<assessmentItem>...</assessmentItem>',
      metadata: {},
    };

    const passage2: GeneratedPassageFile = {
      id: 'passage-shared', // Same ID
      filePath: 'passages/passage-shared.xml',
      xml: '<assessmentItem>...different content...</assessmentItem>',
      metadata: {},
    };

    const added1 = registry.register(passage1);
    const added2 = registry.register(passage2);

    expect(added1).toBe(true);
    expect(added2).toBe(false); // Duplicate not added
    expect(registry.size).toBe(1);

    // First registered passage is kept
    const retrieved = registry.get('passage-shared');
    expect(retrieved?.xml).toBe(passage1.xml);
  });

  test('should retrieve registered passages', () => {
    const passage: GeneratedPassageFile = {
      id: 'passage-abc',
      filePath: 'passages/passage-abc.xml',
      xml: '<assessmentItem>...</assessmentItem>',
      metadata: { title: 'Test Passage' },
    };

    registry.register(passage);

    const retrieved = registry.get('passage-abc');
    expect(retrieved).toEqual(passage);
  });

  test('should return undefined for non-existent passages', () => {
    const retrieved = registry.get('non-existent');
    expect(retrieved).toBeUndefined();
  });

  test('should get all registered passages', () => {
    const passages: GeneratedPassageFile[] = [
      {
        id: 'passage-1',
        filePath: 'passages/passage-1.xml',
        xml: '<assessmentItem>1</assessmentItem>',
        metadata: {},
      },
      {
        id: 'passage-2',
        filePath: 'passages/passage-2.xml',
        xml: '<assessmentItem>2</assessmentItem>',
        metadata: {},
      },
      {
        id: 'passage-3',
        filePath: 'passages/passage-3.xml',
        xml: '<assessmentItem>3</assessmentItem>',
        metadata: {},
      },
    ];

    for (const passage of passages) {
      registry.register(passage);
    }

    const all = registry.getAll();
    expect(all.length).toBe(3);
    expect(all).toEqual(passages);
  });

  test('should get all passage IDs', () => {
    registry.register({
      id: 'p1',
      filePath: 'passages/p1.xml',
      xml: '<assessmentItem>1</assessmentItem>',
      metadata: {},
    });
    registry.register({
      id: 'p2',
      filePath: 'passages/p2.xml',
      xml: '<assessmentItem>2</assessmentItem>',
      metadata: {},
    });

    const ids = registry.getAllIds();
    expect(ids).toEqual(['p1', 'p2']);
  });

  test('should clear registry', () => {
    registry.register({
      id: 'passage-1',
      filePath: 'passages/passage-1.xml',
      xml: '<assessmentItem>1</assessmentItem>',
      metadata: {},
    });

    expect(registry.size).toBe(1);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.has('passage-1')).toBe(false);
  });
});

describe('extractPassageDependencies', () => {
  test('should extract passage IDs from items with string references', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: 'passage-abc', // String reference
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        passage: 'passage-xyz', // String reference
        config: { id: 'uuid-2', models: [] },
      },
    ];

    const dependencies = extractPassageDependencies(items);

    expect(dependencies).toEqual(['passage-abc', 'passage-xyz']);
  });

  test('should extract passage IDs from items with object references', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: { id: 'passage-obj-1', content: '<p>Content</p>' } as any,
        config: { id: 'uuid-1', models: [] },
      },
    ];

    const dependencies = extractPassageDependencies(items);

    expect(dependencies).toEqual(['passage-obj-1']);
  });

  test('should deduplicate shared passages', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: 'passage-shared',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        passage: 'passage-shared', // Same passage
        config: { id: 'uuid-2', models: [] },
      },
      {
        id: 'item-3',
        uuid: 'uuid-3',
        passage: 'passage-shared', // Same passage
        config: { id: 'uuid-3', models: [] },
      },
    ];

    const dependencies = extractPassageDependencies(items);

    expect(dependencies).toEqual(['passage-shared']); // Only once
  });

  test('should handle items without passages', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        passage: 'passage-abc',
        config: { id: 'uuid-2', models: [] },
      },
    ];

    const dependencies = extractPassageDependencies(items);

    expect(dependencies).toEqual(['passage-abc']);
  });

  test('should return empty array when no items have passages', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        config: { id: 'uuid-2', models: [] },
      },
    ];

    const dependencies = extractPassageDependencies(items);

    expect(dependencies).toEqual([]);
  });
});

describe('findSharedPassages', () => {
  test('should identify passages shared by multiple items', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: 'passage-shared',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        passage: 'passage-shared',
        config: { id: 'uuid-2', models: [] },
      },
      {
        id: 'item-3',
        uuid: 'uuid-3',
        passage: 'passage-unique',
        config: { id: 'uuid-3', models: [] },
      },
    ];

    const shared = findSharedPassages(items);

    expect(shared.size).toBe(1);
    expect(shared.has('passage-shared')).toBe(true);
    expect(shared.get('passage-shared')?.length).toBe(2);
    expect(shared.has('passage-unique')).toBe(false); // Not shared
  });

  test('should return empty map when no passages are shared', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: 'passage-1',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        passage: 'passage-2',
        config: { id: 'uuid-2', models: [] },
      },
    ];

    const shared = findSharedPassages(items);

    expect(shared.size).toBe(0);
  });

  test('should handle items without passages', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: 'passage-shared',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        config: { id: 'uuid-2', models: [] }, // No passage
      },
      {
        id: 'item-3',
        uuid: 'uuid-3',
        passage: 'passage-shared',
        config: { id: 'uuid-3', models: [] },
      },
    ];

    const shared = findSharedPassages(items);

    expect(shared.size).toBe(1);
    expect(shared.get('passage-shared')?.length).toBe(2);
  });

  test('should track all items that reference a shared passage', () => {
    const item1: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      passage: 'passage-science',
      config: { id: 'uuid-1', models: [] },
    };
    const item2: PieItem = {
      id: 'item-2',
      uuid: 'uuid-2',
      passage: 'passage-science',
      config: { id: 'uuid-2', models: [] },
    };
    const item3: PieItem = {
      id: 'item-3',
      uuid: 'uuid-3',
      passage: 'passage-science',
      config: { id: 'uuid-3', models: [] },
    };

    const items: PieItem[] = [item1, item2, item3];
    const shared = findSharedPassages(items);

    const referencingItems = shared.get('passage-science');
    expect(referencingItems).toEqual([item1, item2, item3]);
  });
});

describe('deduplicatePassageFiles', () => {
  test('should deduplicate passage files from multiple transforms', () => {
    const passageList1: GeneratedPassageFile[] = [
      {
        id: 'passage-shared',
        filePath: 'passages/passage-shared.xml',
        xml: '<assessmentItem>shared</assessmentItem>',
        metadata: {},
      },
      {
        id: 'passage-1',
        filePath: 'passages/passage-1.xml',
        xml: '<assessmentItem>1</assessmentItem>',
        metadata: {},
      },
    ];

    const passageList2: GeneratedPassageFile[] = [
      {
        id: 'passage-shared', // Duplicate
        filePath: 'passages/passage-shared.xml',
        xml: '<assessmentItem>shared</assessmentItem>',
        metadata: {},
      },
      {
        id: 'passage-2',
        filePath: 'passages/passage-2.xml',
        xml: '<assessmentItem>2</assessmentItem>',
        metadata: {},
      },
    ];

    const deduplicated = deduplicatePassageFiles([passageList1, passageList2]);

    expect(deduplicated.length).toBe(3); // passage-shared, passage-1, passage-2
    expect(deduplicated.map(p => p.id).sort()).toEqual(['passage-1', 'passage-2', 'passage-shared']);
  });

  test('should handle empty passage lists', () => {
    const deduplicated = deduplicatePassageFiles([[], []]);

    expect(deduplicated.length).toBe(0);
  });

  test('should handle single passage list', () => {
    const passageList: GeneratedPassageFile[] = [
      {
        id: 'passage-1',
        filePath: 'passages/passage-1.xml',
        xml: '<assessmentItem>1</assessmentItem>',
        metadata: {},
      },
    ];

    const deduplicated = deduplicatePassageFiles([passageList]);

    expect(deduplicated).toEqual(passageList);
  });

  test('should preserve first occurrence of duplicate passages', () => {
    const passage1: GeneratedPassageFile = {
      id: 'passage-dup',
      filePath: 'passages/passage-dup.xml',
      xml: '<assessmentItem>first</assessmentItem>',
      metadata: { version: 1 },
    };

    const passage2: GeneratedPassageFile = {
      id: 'passage-dup',
      filePath: 'passages/passage-dup.xml',
      xml: '<assessmentItem>second</assessmentItem>',
      metadata: { version: 2 },
    };

    const deduplicated = deduplicatePassageFiles([[passage1], [passage2]]);

    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0]).toEqual(passage1); // First one preserved
  });
});

describe('analyzePassageUsage', () => {
  test('should compute basic usage statistics', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: 'passage-a',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        passage: 'passage-b',
        config: { id: 'uuid-2', models: [] },
      },
      {
        id: 'item-3',
        uuid: 'uuid-3',
        passage: 'passage-c',
        config: { id: 'uuid-3', models: [] },
      },
    ];

    const stats = analyzePassageUsage(items);

    expect(stats.totalPassages).toBe(3);
    expect(stats.uniquePassages).toBe(3);
    expect(stats.duplicatesRemoved).toBe(0);
    expect(stats.sharedPassages.size).toBe(0);
  });

  test('should identify shared passages and compute savings', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        passage: 'passage-shared',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        passage: 'passage-shared',
        config: { id: 'uuid-2', models: [] },
      },
      {
        id: 'item-3',
        uuid: 'uuid-3',
        passage: 'passage-shared',
        config: { id: 'uuid-3', models: [] },
      },
      {
        id: 'item-4',
        uuid: 'uuid-4',
        passage: 'passage-unique',
        config: { id: 'uuid-4', models: [] },
      },
    ];

    const stats = analyzePassageUsage(items);

    expect(stats.totalPassages).toBe(4);
    expect(stats.uniquePassages).toBe(2); // passage-shared and passage-unique
    expect(stats.duplicatesRemoved).toBe(2); // 3 occurrences - 1 unique = 2 saved
    expect(stats.sharedPassages.size).toBe(1);
    expect(stats.sharedPassages.get('passage-shared')).toBe(3); // Referenced 3 times
  });

  test('should handle items without passages', () => {
    const items: PieItem[] = [
      {
        id: 'item-1',
        uuid: 'uuid-1',
        config: { id: 'uuid-1', models: [] },
      },
      {
        id: 'item-2',
        uuid: 'uuid-2',
        config: { id: 'uuid-2', models: [] },
      },
    ];

    const stats = analyzePassageUsage(items);

    expect(stats.totalPassages).toBe(0);
    expect(stats.uniquePassages).toBe(0);
    expect(stats.duplicatesRemoved).toBe(0);
    expect(stats.sharedPassages.size).toBe(0);
  });

  test('should compute complex deduplication scenario', () => {
    const items: PieItem[] = [
      { id: 'i1', uuid: 'u1', passage: 'p-shared-1', config: { id: 'u1', models: [] } },
      { id: 'i2', uuid: 'u2', passage: 'p-shared-1', config: { id: 'u2', models: [] } },
      { id: 'i3', uuid: 'u3', passage: 'p-shared-1', config: { id: 'u3', models: [] } },
      { id: 'i4', uuid: 'u4', passage: 'p-shared-2', config: { id: 'u4', models: [] } },
      { id: 'i5', uuid: 'u5', passage: 'p-shared-2', config: { id: 'u5', models: [] } },
      { id: 'i6', uuid: 'u6', passage: 'p-unique-1', config: { id: 'u6', models: [] } },
      { id: 'i7', uuid: 'u7', passage: 'p-unique-2', config: { id: 'u7', models: [] } },
    ];

    const stats = analyzePassageUsage(items);

    expect(stats.totalPassages).toBe(7);
    expect(stats.uniquePassages).toBe(4); // p-shared-1, p-shared-2, p-unique-1, p-unique-2
    expect(stats.duplicatesRemoved).toBe(3); // (3-1) + (2-1) = 3 duplicates removed
    expect(stats.sharedPassages.size).toBe(2); // p-shared-1 and p-shared-2
    expect(stats.sharedPassages.get('p-shared-1')).toBe(3);
    expect(stats.sharedPassages.get('p-shared-2')).toBe(2);
  });
});
