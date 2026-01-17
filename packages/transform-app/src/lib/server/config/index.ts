/**
 * Transform App Configuration
 * Loads configuration from environment variables and config files
 */

import type { StorageBackend } from '@pie-qti/storage';
import { FilesystemBackend } from '@pie-qti/storage';
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
 */
export async function createStorageBackend(
	config?: TransformConfig,
): Promise<StorageBackend> {
	const cfg = config || (await loadConfig());

	const storageConfig = cfg.storage || {
		backend: 'filesystem',
		options: {},
	};

	switch (storageConfig.backend) {
		case 'filesystem': {
			const rootDir =
				(storageConfig.options?.rootDir as string) ||
				process.env.PIE_QTI_STORAGE_ROOT_DIR ||
				'./uploads';
			return new FilesystemBackend({ rootDir });
		}

		case 's3':
			throw new Error(
				'S3 storage backend not yet implemented in transform-app. Use filesystem backend.',
			);

		case 'database':
			throw new Error(
				'Database storage backend not yet implemented in transform-app. Use filesystem backend.',
			);

		case 'custom':
			throw new Error(
				'Custom storage backend requires implementation. Use filesystem backend.',
			);

		default:
			throw new Error(
				`Unknown storage backend: ${storageConfig.backend}. Use filesystem.`,
			);
	}
}

/**
 * Clear cached configuration (for testing)
 */
export function clearConfigCache(): void {
	cachedConfig = null;
}
