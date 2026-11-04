/**
 * Vendor Extension Registry
 * Dynamically loads and registers vendor extensions from configuration
 */

import type {
	AssetResolver,
	CssClassExtractor,
	MetadataExtractor,
	VendorDetector,
	VendorExtensionConfig,
	VendorExtensionModuleConfig,
	VendorTransformer,
} from '@pie-qti/transform-types';

/**
 * Plugin interface with vendor extension registration methods. The hook
 * contracts live in @pie-qti/transform-types so that config-driven vendor
 * modules are type-checked here, at the framework boundary.
 */
export interface VendorExtensionPlugin {
	registerVendorDetector?: (detector: VendorDetector) => void;
	registerVendorTransformer?: (transformer: VendorTransformer) => void;
	registerAssetResolver?: (resolver: AssetResolver) => void;
	registerCssClassExtractor?: (extractor: CssClassExtractor) => void;
	registerMetadataExtractor?: (extractor: MetadataExtractor) => void;
}

/**
 * Load a vendor extension module
 */
async function loadVendorModule<T = unknown>(
	config: VendorExtensionModuleConfig,
): Promise<T> {
	try {
		// Dynamic import of the module (Vite cannot statically analyze this)
		const module = await import(/* @vite-ignore */ config.module);

		// Get the export (default or named)
		const exportName = config.export || 'default';
		const ExtensionClass = module[exportName];

		if (!ExtensionClass) {
			throw new Error(
				`Export "${exportName}" not found in module ${config.module}`,
			);
		}

		// Instantiate with options
		const instance = new ExtensionClass(config.options || {});
		return instance as T;
	} catch (error) {
		throw new Error(
			`Failed to load vendor extension from ${config.module}: ${(error as Error).message}`,
		);
	}
}

/**
 * Register vendor extensions on a plugin from configuration
 */
export async function registerExtensions(
	plugin: VendorExtensionPlugin,
	config: VendorExtensionConfig,
): Promise<void> {
	// Register vendor detectors
	if (config.detectors && plugin.registerVendorDetector) {
		for (const detectorConfig of config.detectors) {
			try {
				const detector = await loadVendorModule<VendorDetector>(detectorConfig);
				plugin.registerVendorDetector(detector);
			} catch (error) {
				console.warn(
					`Failed to load vendor detector ${detectorConfig.module}:`,
					error,
				);
			}
		}
	}

	// Register vendor transformers
	if (config.transformers && plugin.registerVendorTransformer) {
		for (const transformerConfig of config.transformers) {
			try {
				const transformer = await loadVendorModule<VendorTransformer>(transformerConfig);
				plugin.registerVendorTransformer(transformer);
			} catch (error) {
				console.warn(
					`Failed to load vendor transformer ${transformerConfig.module}:`,
					error,
				);
			}
		}
	}

	// Register asset resolvers
	if (config.assetResolvers && plugin.registerAssetResolver) {
		for (const resolverConfig of config.assetResolvers) {
			try {
				const resolver = await loadVendorModule<AssetResolver>(resolverConfig);
				plugin.registerAssetResolver(resolver);
			} catch (error) {
				console.warn(
					`Failed to load asset resolver ${resolverConfig.module}:`,
					error,
				);
			}
		}
	}

	// Register CSS class extractors
	if (config.cssClassExtractors && plugin.registerCssClassExtractor) {
		for (const extractorConfig of config.cssClassExtractors) {
			try {
				const extractor = await loadVendorModule<CssClassExtractor>(extractorConfig);
				plugin.registerCssClassExtractor(extractor);
			} catch (error) {
				console.warn(
					`Failed to load CSS class extractor ${extractorConfig.module}:`,
					error,
				);
			}
		}
	}

	// Register metadata extractors
	if (config.metadataExtractors && plugin.registerMetadataExtractor) {
		for (const extractorConfig of config.metadataExtractors) {
			try {
				const extractor = await loadVendorModule<MetadataExtractor>(extractorConfig);
				plugin.registerMetadataExtractor(extractor);
			} catch (error) {
				console.warn(
					`Failed to load metadata extractor ${extractorConfig.module}:`,
					error,
				);
			}
		}
	}
}
