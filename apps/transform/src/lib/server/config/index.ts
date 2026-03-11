/**
 * Transform App Configuration
 * Loads configuration from environment variables and config files
 */

import type { StorageBackend } from '@pie-qti/storage';
import { storageBackendRegistry } from '@pie-qti/storage';
import {
	loadFromEnv,
	loadFromFile,
	merge,
} from '@pie-qti/transform-core/config/config-loader.js';
import type { TransformConfig } from '@pie-qti/transform-types';

let cachedConfig: TransformConfig | null = null;

/**
 * Load configuration from environment variables and optional config file
 */
export async function loadConfig(): Promise<TransformConfig> {
	if (cachedConfig) {
		return cachedConfig;
	}

	// Start with environment variables
	let config = loadFromEnv();

	// Load from file if specified
	const configPath = process.env.PIE_QTI_CONFIG;
	if (configPath) {
		try {
			const fileConfig = await loadFromFile(configPath);
			config = merge(config, fileConfig);
		} catch (error) {
			console.warn(`Failed to load config from ${configPath}:`, error);
		}
	}

	cachedConfig = config;
	return config;
}

/**
 * Get cached configuration (must call loadConfig first)
 */
export function getConfig(): TransformConfig {
	if (!cachedConfig) {
		throw new Error('Configuration not loaded. Call loadConfig() first.');
	}
	return cachedConfig;
}

/**
 * Create storage backend from configuration
 * Uses the storage backend registry to create backends by name
 */
export async function createStorageBackend(
	config?: TransformConfig,
): Promise<StorageBackend> {
	const cfg = config || (await loadConfig());

	const storageConfig = cfg.storage || {
		backend: 'filesystem',
		options: {},
	};

	try {
		return storageBackendRegistry.create(
			storageConfig.backend,
			storageConfig.options,
		);
	} catch (error) {
		const available = storageBackendRegistry.getRegisteredNames().join(', ');
		throw new Error(
			`Failed to create storage backend '${storageConfig.backend}': ${(error as Error).message}. Available backends: ${available || 'none'}`,
		);
	}
}

/**
 * Clear cached configuration (for testing)
 */
export function clearConfigCache(): void {
	cachedConfig = null;
}
