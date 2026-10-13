/**
 * Type definitions for pie-to-qti2 package
 */

/**
 * Response declaration configuration
 */
export interface ResponseDeclarationOptions {
  /** Response identifier */
  identifier: string;
  /** Cardinality (single, multiple, ordered, record) */
  cardinality: 'single' | 'multiple' | 'ordered' | 'record';
  /** Base type */
  baseType: 'identifier' | 'string' | 'integer' | 'float' | 'point' | 'pair' | 'directedPair';
  /** Correct response values */
  correctResponse?: string[];
  /** Mapping for partial credit scoring */
  mapping?: Array<{ mapKey: string; mappedValue: number; caseSensitive?: boolean }>;
  /** Value for keys outside the mapping, and the bounds on the mapped sum */
  mappingBounds?: { defaultValue?: number; lowerBound?: number; upperBound?: number };
}

/**
 * QTI Assessment Item options
 */
export interface AssessmentItemOptions {
  /** Item title */
  title?: string;
  /** Item label */
  label?: string;
  /** PIE element type (for comments) */
  pieElement?: string;
  /** Adaptive mode */
  adaptive?: boolean;
  /** Time dependent */
  timeDependent?: boolean;
  /** Outcome declarations, emitted after the response declarations */
  outcomeDeclarations?: string[];
  /** Response processing, emitted after the item body */
  responseProcessing?: string;
}

/**
 * QTI Namespace constants
 */
export const QTI_NAMESPACE = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
export const QTI_PREFIX = 'qti';

/**
 * Manifest types
 */
export * from './manifest.js';
