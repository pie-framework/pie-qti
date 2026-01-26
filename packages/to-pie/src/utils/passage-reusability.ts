/**
 * Passage reusability detection and stable ID management
 *
 * QTI provides several mechanisms for reusable content:
 * 1. Manifest <dependency> elements - explicit reusability declaration
 * 2. Object <object data="..."> references - shared file paths
 * 3. assessmentStimulus/assessmentPassage identifiers - stable IDs
 *
 * This module provides stable ID generation and reusability detection.
 */

import { createHash } from 'crypto';

/**
 * Generate stable ID for passage content
 *
 * Strategy (in priority order):
 * 1. Use QTI identifier directly - QTI identifiers are designed to be globally unique
 *    across vendors and packages (e.g., "urn:example.com:passage:12345")
 * 2. Use file path for object references - stable within a package
 * 3. Use content hash for inline stimulus - ensures same content = same ID
 *
 * @param options Options for ID generation
 * @returns Stable passage ID
 */
export function generateStablePassageId(options: {
  /** QTI identifier from assessmentStimulus or assessmentPassage - USE DIRECTLY */
  qtiIdentifier?: string;
  /** File path from object data attribute */
  filePath?: string;
  /** Content hash for inline stimulus */
  content?: string;
  /** Prefix for generated IDs (only used for hashed IDs) */
  prefix?: string;
}): string {
  const prefix = options.prefix || 'passage';

  // Priority 1: Use QTI identifier DIRECTLY (no prefix)
  // QTI identifiers are designed to be globally unique across vendors
  // Examples: "urn:example.com:passage:12345", "stim-industrial-revolution"
  if (options.qtiIdentifier) {
    return options.qtiIdentifier;
  }

  // Priority 2: Use file path for object references
  // Normalize path (remove leading ./ and ../) and use as-is with prefix
  if (options.filePath) {
    const normalizedPath = options.filePath
      .replace(/^\.\//, '')
      .replace(/\.\.\//g, '')
      .replace(/\//g, '-')
      .replace(/\.(xml|html|txt)$/, '');
    return `${prefix}-${normalizedPath}`;
  }

  // Priority 3: Use content hash for inline stimulus (stable for same content)
  if (options.content) {
    const contentHash = createHash('sha256')
      .update(options.content.trim())
      .digest('hex')
      .substring(0, 12);
    return `${prefix}-content-${contentHash}`;
  }

  throw new Error('Must provide at least one of: qtiIdentifier, filePath, or content');
}

/**
 * Passage reference information
 */
export interface PassageReference {
  /** Stable passage ID */
  id: string;
  /** Source of the passage */
  source: 'inline' | 'file' | 'manifest' | 'qti-element';
  /** Original QTI identifier if available */
  qtiIdentifier?: string;
  /** File path if from object reference */
  filePath?: string;
  /** Whether this passage is referenced by multiple items */
  isReusable: boolean;
}

/**
 * Track passage references across a package
 * Used during batch transformation to detect reusable passages
 */
export class PassageRegistry {
  private passages = new Map<string, {
    reference: PassageReference;
    referencedBy: Set<string>;
    content?: string;
  }>();

  /**
   * Register a passage reference
   * @param itemId ID of the item referencing this passage
   * @param reference Passage reference information
   */
  registerReference(itemId: string, reference: PassageReference): void {
    const existing = this.passages.get(reference.id);

    if (existing) {
      // Passage already registered, add this item as a reference
      existing.referencedBy.add(itemId);
      existing.reference.isReusable = existing.referencedBy.size > 1;
    } else {
      // First reference to this passage
      this.passages.set(reference.id, {
        reference: { ...reference, isReusable: false },
        referencedBy: new Set([itemId]),
      });
    }
  }

  /**
   * Store passage content for deduplication
   * @param passageId Passage ID
   * @param content Passage content
   */
  storeContent(passageId: string, content: string): void {
    const entry = this.passages.get(passageId);
    if (entry) {
      entry.content = content;
    }
  }

  /**
   * Get passage reference by ID
   * @param passageId Passage ID
   * @returns Passage reference with updated reusability flag
   */
  getReference(passageId: string): PassageReference | undefined {
    return this.passages.get(passageId)?.reference;
  }

  /**
   * Get all items that reference a passage
   * @param passageId Passage ID
   * @returns Set of item IDs
   */
  getReferencingItems(passageId: string): Set<string> {
    return this.passages.get(passageId)?.referencedBy || new Set();
  }

  /**
   * Get all registered passages
   * @returns Array of passage references
   */
  getAllPassages(): PassageReference[] {
    return Array.from(this.passages.values()).map(entry => entry.reference);
  }

  /**
   * Get reusable passages (referenced by multiple items)
   * @returns Array of reusable passage references
   */
  getReusablePassages(): PassageReference[] {
    return this.getAllPassages().filter(ref => ref.isReusable);
  }

  /**
   * Detect duplicate content and merge passages
   * This handles cases where same content appears with different IDs
   */
  detectAndMergeDuplicates(): Map<string, string> {
    const contentMap = new Map<string, string>(); // content hash -> primary ID
    const mergeMap = new Map<string, string>(); // old ID -> new ID

    for (const [id, entry] of this.passages.entries()) {
      if (!entry.content) continue;

      const contentHash = createHash('sha256')
        .update(entry.content.trim())
        .digest('hex');

      const existingId = contentMap.get(contentHash);
      if (existingId && existingId !== id) {
        // Duplicate content found - merge into existing
        mergeMap.set(id, existingId);

        const existingEntry = this.passages.get(existingId)!;
        for (const itemId of entry.referencedBy) {
          existingEntry.referencedBy.add(itemId);
        }
        existingEntry.reference.isReusable = existingEntry.referencedBy.size > 1;

        this.passages.delete(id);
      } else {
        contentMap.set(contentHash, id);
      }
    }

    return mergeMap;
  }
}

/**
 * Parse object tag to extract passage reference
 * @param objectElement Object element from QTI
 * @returns Passage reference or null
 */
export function parseObjectReference(objectElement: any): PassageReference | null {
  const dataAttr = objectElement.getAttribute?.('data');
  const typeAttr = objectElement.getAttribute?.('type');

  // Check if it's a passage reference (text/html, text/plain, or no type)
  const isPassageType = !typeAttr ||
                        typeAttr === 'text/html' ||
                        typeAttr === 'text/plain' ||
                        typeAttr.startsWith('text/');

  if (!dataAttr || !isPassageType) {
    return null;
  }

  // Generate stable ID from file path
  const id = generateStablePassageId({ filePath: dataAttr });

  return {
    id,
    source: 'file',
    filePath: dataAttr,
    isReusable: false, // Will be updated by registry
  };
}
