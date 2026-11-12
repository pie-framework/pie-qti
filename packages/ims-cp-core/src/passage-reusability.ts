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

import { sha256 } from './utils/hash.js';

/**
 * Options for stable passage ID generation.
 */
export interface StablePassageIdOptions {
  /** QTI identifier from assessmentStimulus or assessmentPassage - USE DIRECTLY */
  qtiIdentifier?: string;
  /** File path from object data attribute */
  filePath?: string;
  /** Content hash for inline stimulus */
  content?: string;
  /** Prefix for generated IDs (only used for hashed IDs) */
  prefix?: string;
}

/**
 * Strategy that hashes passage content into a hex digest. Inject one to
 * generate stable IDs synchronously (see {@link createStablePassageIdGenerator}).
 */
export type PassageContentHash = (content: string) => string;

/**
 * Shared pieces of the ID strategy. The identifier and file-path strategies
 * need no hashing; only the content strategy does, which is why callers can
 * pick a sync or async hashing strategy without changing the semantics.
 */
function passageIdPrefix(options: StablePassageIdOptions): string {
  return options.prefix || 'passage';
}

function filePathPassageId(filePath: string, prefix: string): string {
  // Normalize path (remove leading ./ and ../) and use as-is with prefix
  const normalizedPath = filePath
    .replace(/^\.\//, '')
    .replace(/\.\.\//g, '')
    .replace(/\//g, '-')
    .replace(/\.(xml|html|txt)$/, '');
  return `${prefix}-${normalizedPath}`;
}

function contentPassageId(contentHash: string, prefix: string): string {
  return `${prefix}-content-${contentHash.substring(0, 12)}`;
}

const MISSING_SOURCE_ERROR =
  'Must provide at least one of: qtiIdentifier, filePath, or content';

/**
 * Create a synchronous stable-ID generator from a content-hash strategy.
 *
 * Strategy (in priority order):
 * 1. Use QTI identifier directly - QTI identifiers are designed to be globally unique
 *    across vendors and packages (e.g., "urn:example.com:passage:12345")
 * 2. Use file path for object references - stable within a package
 * 3. Use content hash for inline stimulus - ensures same content = same ID
 *
 * @param hashContent Strategy hashing passage content into a hex digest
 *   (e.g. `createHash('sha256')` in Node.js).
 * @returns A synchronous generator with the same semantics as
 *   {@link generateStablePassageId}.
 */
export function createStablePassageIdGenerator(
  hashContent: PassageContentHash
): (options: StablePassageIdOptions) => string {
  return (options: StablePassageIdOptions): string => {
    const prefix = passageIdPrefix(options);

    // Priority 1: Use QTI identifier DIRECTLY (no prefix)
    if (options.qtiIdentifier) {
      return options.qtiIdentifier;
    }

    // Priority 2: Use file path for object references
    if (options.filePath) {
      return filePathPassageId(options.filePath, prefix);
    }

    // Priority 3: Use content hash for inline stimulus (stable for same content)
    if (options.content) {
      return contentPassageId(hashContent(options.content.trim()), prefix);
    }

    throw new Error(MISSING_SOURCE_ERROR);
  };
}

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
 * @returns Stable passage ID (async for content hashing)
 */
export async function generateStablePassageId(
  options: StablePassageIdOptions
): Promise<string> {
  const prefix = passageIdPrefix(options);

  // Priority 1: Use QTI identifier DIRECTLY (no prefix)
  if (options.qtiIdentifier) {
    return options.qtiIdentifier;
  }

  // Priority 2: Use file path for object references
  if (options.filePath) {
    return filePathPassageId(options.filePath, prefix);
  }

  // Priority 3: Use content hash for inline stimulus (stable for same content)
  if (options.content) {
    const contentHash = await sha256(options.content.trim());
    return contentPassageId(contentHash, prefix);
  }

  throw new Error(MISSING_SOURCE_ERROR);
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
  async detectAndMergeDuplicates(): Promise<Map<string, string>> {
    const contentMap = new Map<string, string>(); // content hash -> primary ID
    const mergeMap = new Map<string, string>(); // old ID -> new ID

    for (const [id, entry] of this.passages.entries()) {
      if (!entry.content) continue;

      const contentHash = await sha256(entry.content.trim());

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

  // A text type names a passage; an untyped object is a passage only when the
  // data file looks like a markup document - untyped objects embed figures too.
  const isPassageType = typeAttr
    ? typeAttr.startsWith('text/')
    : /\.(?:html?|xhtml|xml)(?:[?#]|$)/i.test(dataAttr ?? '');

  if (!dataAttr || !isPassageType) {
    return null;
  }

  // Generate stable ID from file path
  const id = filePathPassageId(dataAttr, passageIdPrefix({}));

  return {
    id,
    source: 'file',
    filePath: dataAttr,
    isReusable: false, // Will be updated by registry
  };
}
