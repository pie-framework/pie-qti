/**
 * Type definitions for pie-to-qti2 package
 */

/**
 * PIE Extension Metadata embedded in QTI XML
 */
export interface PieExtensionMetadata {
  /** Generator information */
  generator?: {
    package: string;
    version: string;
  };
  /** PIE element type */
  elementType?: string;
  /** Generation timestamp */
  timestamp?: Date;
  /** Additional metadata */
  [key: string]: any;
}

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
  mapping?: Array<{ mapKey: string; mappedValue: number }>;
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
}

/**
 * PIE Namespace constants
 */
export const PIE_NAMESPACE = 'https://github.com/pie-framework/pie-elements';
export const PIE_PREFIX = 'pie';

/**
 * QTI Namespace constants
 */
export const QTI_NAMESPACE = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
export const QTI_PREFIX = 'qti';

/**
 * Manifest types
 */
export * from './manifest.js';
