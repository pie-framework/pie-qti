/**
 * Vendor extension configuration types
 * Enables registration of vendor-specific transformers, detectors, and resolvers
 */

/**
 * Base configuration for loading a vendor extension from a module
 */
export interface VendorExtensionModuleConfig {
	/** NPM package or file path to the module */
	module: string;

	/** Named export from the module (if not default export) */
	export?: string;

	/** Constructor options to pass to the extension */
	options?: Record<string, unknown>;
}

/**
 * Configuration for a vendor detector
 * Detects vendor-specific QTI patterns and features
 */
export type VendorDetectorConfig = VendorExtensionModuleConfig;

/**
 * Configuration for a vendor transformer
 * Transforms vendor-specific QTI elements to PIE
 */
export type VendorTransformerConfig = VendorExtensionModuleConfig;

/**
 * Configuration for an asset resolver
 * Resolves external assets (images, videos, etc.)
 */
export type AssetResolverConfig = VendorExtensionModuleConfig;

/**
 * Configuration for a CSS class extractor
 * Extracts and transforms vendor-specific CSS classes
 */
export type CssClassExtractorConfig = VendorExtensionModuleConfig;

/**
 * Configuration for a metadata extractor
 * Extracts vendor-specific metadata from QTI
 */
export type MetadataExtractorConfig = VendorExtensionModuleConfig;

/**
 * Complete vendor extension configuration
 * Contains all vendor-specific extensions to register
 */
export interface VendorExtensionConfig {
	/** Vendor detectors to register */
	detectors?: VendorDetectorConfig[];

	/** Vendor transformers to register */
	transformers?: VendorTransformerConfig[];

	/** Asset resolvers to register */
	assetResolvers?: AssetResolverConfig[];

	/** CSS class extractors to register */
	cssClassExtractors?: CssClassExtractorConfig[];

	/** Metadata extractors to register */
	metadataExtractors?: MetadataExtractorConfig[];
}
