/**
 * Plugin Loader
 * Dynamically loads and registers plugins and format detectors
 */

import type {
	TransformPlugin,
	TransformConfig,
	PluginConfig,
} from '@pie-qti/transform-types';
import type { TransformEngine } from '../engine/transform-engine.js';
import type { FormatDetector } from '../registry/format-detector-registry.js';
import { loadConfiguredModule } from './module-loader.js';

/**
 * Load a plugin or format detector from a module config
 */
export async function loadPlugin<T = unknown>(
	config: PluginConfig,
): Promise<T> {
	return loadConfiguredModule<T>(config, 'plugin');
}

/**
 * Load and register all plugins from configuration
 */
export async function loadAndRegisterPlugins(
	engine: TransformEngine,
	pluginConfig?: TransformConfig['plugins'],
): Promise<void> {
	if (!pluginConfig) {
		return;
	}

	for (const [sourceFormat, targets] of Object.entries(pluginConfig)) {
		for (const [targetFormat, config] of Object.entries(targets)) {
			try {
				const plugin = await loadPlugin<TransformPlugin>(config);
				engine.use(plugin);
			} catch (error) {
				console.warn(
					`Failed to load plugin ${sourceFormat}→${targetFormat}:`,
					error,
				);
			}
		}
	}
}

/**
 * Load and register format detectors from configuration
 */
export async function loadFormatDetectors(
	engine: TransformEngine,
	detectorConfigs?: PluginConfig[],
): Promise<void> {
	if (!detectorConfigs) {
		return;
	}

	for (const config of detectorConfigs) {
		try {
			const detector = await loadPlugin<FormatDetector>(config);
			engine.registerFormatDetector(detector);
		} catch (error) {
			console.warn(`Failed to load format detector ${config.module}:`, error);
		}
	}
}
