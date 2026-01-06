/**
 * Vendor Extension Types
 *
 * Types and interfaces for vendor-specific QTI transformation extensions.
 * These enable vendor packages to customize transformation without modifying
 * the core framework.
 */

import type { TransformContext, TransformOutput } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';

/**
 * Vendor information detected from QTI content
 */
export interface VendorInfo {
  /** Vendor identifier (e.g., 'amplify-ckla', 'examview-mcgrawhill') */
  vendor: string;

  /** Confidence score (0.0-1.0) */
  confidence: number;

  /** QTI version detected (e.g., '2.1', '2.2') */
  version?: string;

  /** Vendor-specific metadata */
  metadata?: Record<string, any>;
}

/**
 * Vendor detector interface
 *
 * Implementations identify vendor-specific QTI content patterns
 */
export interface VendorDetector {
  /** Unique name for this detector */
  name: string;

  /**
   * Detect if QTI content matches vendor patterns
   *
   * @param qtiXml - Raw QTI XML string
   * @param parsedDoc - Parsed HTML document (root element)
   * @returns VendorInfo if detected, null otherwise
   */
  detect(qtiXml: string, parsedDoc: HTMLElement): VendorInfo | null;
}

/**
 * Vendor-specific transformer interface
 *
 * Implementations provide custom transformation logic for vendor QTI
 */
export interface VendorTransformer {
  /** Vendor identifier this transformer handles */
  vendor: string;

  /**
   * Check if this transformer can handle the QTI content
   *
   * @param qtiXml - Raw QTI XML string
   * @param vendorInfo - Detected vendor information
   * @param parsedDoc - Parsed HTML document (root element)
   * @returns true if transformer can handle this content
   */
  canHandle(qtiXml: string, vendorInfo: VendorInfo, parsedDoc: HTMLElement): boolean;

  /**
   * Transform vendor-specific QTI to PIE
   *
   * @param qtiXml - Raw QTI XML string
   * @param vendorInfo - Detected vendor information
   * @param context - Transformation context
   * @param parsedDoc - Parsed HTML document (root element)
   * @returns Transformation output
   */
  transform(
    qtiXml: string,
    vendorInfo: VendorInfo,
    context: TransformContext,
    parsedDoc: HTMLElement
  ): Promise<TransformOutput>;
}

/**
 * Resolved asset information
 */
export interface ResolvedAsset {
  /** Original asset URL/path */
  url: string;

  /** Asset content (for text files like CSS, HTML) */
  content?: string;

  /** Asset content (for binary files like images, audio) */
  buffer?: Buffer;

  /** MIME type */
  mimeType: string;

  /** Resolved file path (if local) */
  filePath?: string;
}

/**
 * Asset resolver interface
 *
 * Implementations load external assets referenced in QTI content
 */
export interface AssetResolver {
  /** Unique name for this resolver */
  name: string;

  /**
   * Check if this resolver can handle the asset
   *
   * @param assetType - Type of asset ('stylesheet', 'html', 'audio', 'image', etc.)
   * @param assetUrl - Asset URL or path
   * @returns true if resolver can handle this asset
   */
  canResolve(assetType: string, assetUrl: string): boolean;

  /**
   * Resolve and load asset
   *
   * @param assetType - Type of asset
   * @param assetUrl - Asset URL or path
   * @param baseDir - Base directory for resolving relative paths
   * @returns Resolved asset with content
   */
  resolve(
    assetType: 'stylesheet' | 'html' | 'audio' | 'image' | 'video' | string,
    assetUrl: string,
    baseDir: string
  ): Promise<ResolvedAsset>;
}

/**
 * Categorized CSS classes
 */
export interface VendorClasses {
  /** Classes that affect behavior (e.g., 'labels-none', 'input-medium') */
  behavioral: string[];

  /** Classes for presentation/styling */
  styling: string[];

  /** Classes with semantic meaning */
  semantic: string[];

  /** Unrecognized or uncategorized classes */
  unknown: string[];
}

/**
 * CSS class extractor interface
 *
 * Implementations parse and categorize vendor-specific CSS classes
 */
export interface CssClassExtractor {
  /** Vendor identifier this extractor handles */
  vendor: string;

  /**
   * Extract and categorize CSS classes from element
   *
   * @param element - HTML element to extract classes from
   * @returns Categorized CSS classes
   */
  extract(element: HTMLElement): VendorClasses;
}

/**
 * Metadata extractor interface
 *
 * Implementations extract vendor-specific metadata from QTI content
 */
export interface MetadataExtractor {
  /** Vendor identifier this extractor handles */
  vendor: string;

  /**
   * Extract vendor-specific metadata
   *
   * @param qtiXml - Raw QTI XML string
   * @param parsedDoc - Parsed HTML document (root element)
   * @param vendorInfo - Detected vendor information
   * @returns Vendor-specific metadata
   */
  extract(
    qtiXml: string,
    parsedDoc: HTMLElement,
    vendorInfo: VendorInfo
  ): Record<string, any>;
}

/**
 * Custom attribute extraction result
 */
export interface CustomAttributes {
  /** Standard attributes that were extracted */
  standard: Record<string, string>;

  /** Vendor-specific attributes */
  vendor: Record<string, any>;

  /** Data attributes (data-*) */
  data: Record<string, any>;
}

/**
 * Utility type for vendor extension hooks
 */
export interface VendorExtensionHooks {
  /** Registered vendor detectors */
  detectors: VendorDetector[];

  /** Registered vendor transformers */
  transformers: VendorTransformer[];

  /** Registered asset resolvers */
  assetResolvers: AssetResolver[];

  /** Registered CSS class extractors */
  cssClassExtractors: CssClassExtractor[];

  /** Registered metadata extractors */
  metadataExtractors: MetadataExtractor[];
}
