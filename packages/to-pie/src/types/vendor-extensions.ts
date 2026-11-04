/**
 * Vendor Extension Types
 *
 * Re-exported from @pie-qti/transform-types, where the vendor extension
 * contracts now live so that config-driven vendor modules are type-checked at
 * the transform-core registry boundary. This shim preserves the historical
 * import path for to-pie consumers.
 */

export type {
	VendorInfo,
	VendorDetector,
	VendorTransformer,
	ResolvedAsset,
	AssetResolver,
	VendorClasses,
	CssClassExtractor,
	MetadataExtractor,
	CustomAttributes,
	VendorExtensionHooks,
} from '@pie-qti/transform-types';
