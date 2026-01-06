/**
 * External Passage Resolution Types
 *
 * Types for resolving external passage references during PIE → QTI transformation
 */

import type { PiePassageStimulus } from '@pie-framework/transform-types';

/**
 * Passage resolution result
 */
export interface ResolvedPassage {
  /** Passage ID */
  id: string;
  /** Base/stable identifier for QTI (preferred for QTI identifier attribute) */
  baseId?: string;
  /** External system identifier */
  externalId?: string;
  /** Passage title */
  title?: string;
  /** Passage HTML content */
  content: string;
  /** Optional metadata */
  metadata?: Record<string, any>;
  /** Original PIE passage stimulus (if available) */
  piePassage?: PiePassageStimulus;
}

/**
 * Callback interface for resolving external passage references
 *
 * Implementers should:
 * 1. Accept a passage ID (string reference)
 * 2. Load passage data from external source (database, filesystem, API, etc.)
 * 3. Return resolved passage with content
 *
 * @example
 * ```typescript
 * const resolver: PassageResolver = async (passageId) => {
 *   const passage = await database.passages.findById(passageId);
 *   return {
 *     id: passage.id,
 *     title: passage.title,
 *     content: passage.htmlContent,
 *     metadata: passage.searchMetaData
 *   };
 * };
 * ```
 */
export type PassageResolver = (passageId: string) => Promise<ResolvedPassage>;

/**
 * Passage output strategy
 */
export type PassageStrategy = 'inline' | 'external';

/**
 * Passage generation options
 */
export interface PassageGenerationOptions {
  /** Strategy for passage output (inline or external files) */
  strategy: PassageStrategy;
  /** Optional passage resolver for external references */
  resolver?: PassageResolver;
  /** Optional base path for external passage files */
  passageBasePath?: string;
}

/**
 * Generated passage file information
 */
export interface GeneratedPassageFile {
  /** Passage ID */
  id: string;
  /** File path (package-relative) */
  filePath: string;
  /** QTI XML content */
  xml: string;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Passage reference in QTI item
 */
export interface PassageReference {
  /** Passage ID being referenced */
  id: string;
  /** Reference type */
  type: 'inline' | 'object';
  /** For object references: the href attribute */
  href?: string;
}
