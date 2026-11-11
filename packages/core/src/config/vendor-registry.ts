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
import { loadConfiguredModule } from './module-loader.js';

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
	return loadConfiguredModule<T>(config, 'vendor extension');
}

/**
 * Load and register one kind of vendor extension. A kind without configured
 * modules, or whose hook the plugin does not implement, is skipped.
 */
async function registerExtensionKind<T>(
	moduleConfigs: VendorExtensionModuleConfig[] | undefined,
	register: ((instance: T) => void) | undefined,
	label: string,
): Promise<void> {
	if (!moduleConfigs || !register) {
		return;
	}

	for (const moduleConfig of moduleConfigs) {
		try {
			register(await loadVendorModule<T>(moduleConfig));
		} catch (error) {
			console.warn(`Failed to load ${label} ${moduleConfig.module}:`, error);
		}
	}
}

/**
 * Register vendor extensions on a plugin from configuration
 */
export async function registerExtensions(
	plugin: VendorExtensionPlugin,
	config: VendorExtensionConfig,
): Promise<void> {
	// One thunk per extension kind; each binds its concrete register hook so the
	// loaded module is type-checked against that hook's parameter type.
	const kinds: Array<() => Promise<void>> = [
		() =>
			registerExtensionKind(
				config.detectors,
				plugin.registerVendorDetector?.bind(plugin),
				'vendor detector',
			),
		() =>
			registerExtensionKind(
				config.transformers,
				plugin.registerVendorTransformer?.bind(plugin),
				'vendor transformer',
			),
		() =>
			registerExtensionKind(
				config.assetResolvers,
				plugin.registerAssetResolver?.bind(plugin),
				'asset resolver',
			),
		() =>
			registerExtensionKind(
				config.cssClassExtractors,
				plugin.registerCssClassExtractor?.bind(plugin),
				'CSS class extractor',
			),
		() =>
			registerExtensionKind(
				config.metadataExtractors,
				plugin.registerMetadataExtractor?.bind(plugin),
				'metadata extractor',
			),
	];

	for (const registerKind of kinds) {
		await registerKind();
	}
}
