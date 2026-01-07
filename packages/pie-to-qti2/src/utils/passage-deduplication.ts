/**
 * Passage Deduplication Utilities
 *
 * Handles deduplication of passages across multiple items in batch transformations
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { GeneratedPassageFile } from '../types/passages.js';

/**
 * Registry for tracking generated passages across batch transformations
 */
export class PassageRegistry {
  private passages = new Map<string, GeneratedPassageFile>();

  /**
   * Register a passage file
   * @param passage - The generated passage file
   * @returns true if passage was added, false if it already existed
   */
  register(passage: GeneratedPassageFile): boolean {
    if (this.passages.has(passage.id)) {
      return false; // Already registered
    }

    this.passages.set(passage.id, passage);
    return true;
  }

  /**
   * Check if a passage has been registered
   */
  has(passageId: string): boolean {
    return this.passages.has(passageId);
  }

  /**
   * Get a registered passage
   */
  get(passageId: string): GeneratedPassageFile | undefined {
    return this.passages.get(passageId);
  }

  /**
   * Get all registered passages
   */
  getAll(): GeneratedPassageFile[] {
    return Array.from(this.passages.values());
  }

  /**
   * Get all passage IDs
   */
  getAllIds(): string[] {
    return Array.from(this.passages.keys());
  }

  /**
   * Clear the registry
   */
  clear(): void {
    this.passages.clear();
  }

  /**
   * Get the number of registered passages
   */
  get size(): number {
    return this.passages.size;
  }
}

/**
 * Extract passage dependencies from PIE items
 *
 * Returns a list of unique passage IDs referenced by the items
 */
export function extractPassageDependencies(items: PieItem[]): string[] {
  const passageIds = new Set<string>();

  for (const item of items) {
    // External passage reference (string property)
    if (typeof item.passage === 'string') {
      passageIds.add(item.passage);
    }

    // Passage object reference
    if (item.passage && typeof item.passage === 'object' && 'id' in item.passage) {
      passageIds.add(item.passage.id);
    }
  }

  return Array.from(passageIds);
}

/**
 * Find shared passages across multiple items
 *
 * Returns a map of passage ID to the items that reference it
 */
export function findSharedPassages(items: PieItem[]): Map<string, PieItem[]> {
  const passageToItems = new Map<string, PieItem[]>();

  for (const item of items) {
    const passageId = getItemPassageId(item);
    if (!passageId) continue;

    if (!passageToItems.has(passageId)) {
      passageToItems.set(passageId, []);
    }

    passageToItems.get(passageId)!.push(item);
  }

  // Filter to only shared passages (referenced by 2+ items)
  const sharedPassages = new Map<string, PieItem[]>();
  for (const [passageId, itemList] of passageToItems.entries()) {
    if (itemList.length > 1) {
      sharedPassages.set(passageId, itemList);
    }
  }

  return sharedPassages;
}

/**
 * Get passage ID from a PIE item
 */
function getItemPassageId(item: PieItem): string | null {
  if (typeof item.passage === 'string') {
    return item.passage;
  }

  if (item.passage && typeof item.passage === 'object' && 'id' in item.passage) {
    return item.passage.id;
  }

  return null;
}

/**
 * Deduplicate passage files from multiple transformation results
 *
 * When transforming multiple items that may share passages, this function
 * ensures each unique passage is only included once.
 *
 * @param passageFileLists - Arrays of passage files from multiple transforms
 * @returns Deduplicated array of passage files
 */
export function deduplicatePassageFiles(
  passageFileLists: GeneratedPassageFile[][]
): GeneratedPassageFile[] {
  const registry = new PassageRegistry();

  for (const passageFiles of passageFileLists) {
    for (const passage of passageFiles) {
      registry.register(passage);
    }
  }

  return registry.getAll();
}

/**
 * Statistics about passage deduplication
 */
export interface DeduplicationStats {
  totalPassages: number;
  uniquePassages: number;
  duplicatesRemoved: number;
  sharedPassages: Map<string, number>; // passageId -> reference count
}

/**
 * Analyze passage usage across items and compute deduplication statistics
 */
export function analyzePassageUsage(items: PieItem[]): DeduplicationStats {
  const passageCounts = new Map<string, number>();

  for (const item of items) {
    const passageId = getItemPassageId(item);
    if (!passageId) continue;

    passageCounts.set(passageId, (passageCounts.get(passageId) || 0) + 1);
  }

  const totalPassages = Array.from(passageCounts.values()).reduce((sum, count) => sum + count, 0);
  const uniquePassages = passageCounts.size;
  const duplicatesRemoved = totalPassages - uniquePassages;

  // Passages referenced by multiple items
  const sharedPassages = new Map<string, number>();
  for (const [passageId, count] of passageCounts.entries()) {
    if (count > 1) {
      sharedPassages.set(passageId, count);
    }
  }

  return {
    totalPassages,
    uniquePassages,
    duplicatesRemoved,
    sharedPassages,
  };
}
