/**
 * Configuration Loader
 * Loads transform configuration from files and environment variables
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { TransformConfig } from '@pie-qti/transform-types';

/**
 * Load configuration from a JSON file
 */
export async function loadFromFile(
	configPath: string,
): Promise<TransformConfig> {
	try {
		const absolutePath = path.resolve(configPath);
		const content = await fs.readFile(absolutePath, 'utf-8');
		const config = JSON.parse(content) as TransformConfig;
		return config;
	} catch (error) {
		throw new Error(
			`Failed to load config from ${configPath}: ${(error as Error).message}`,
		);
	}
}

/**
 * Load configuration from environment variables
 *
 * Supported environment variables:
 * - PIE_QTI_STORAGE_BACKEND: Storage backend type (name-based, e.g., 'filesystem', 's3', 'database', or any custom name)
 * - PIE_QTI_STORAGE_ROOT_DIR: Root directory for filesystem storage
 * - PIE_QTI_LOG_LEVEL: Logging level (debug, info, warn, error)
 * - PIE_QTI_CONFIG: Path to config file (takes precedence)
 */
export function loadFromEnv(): TransformConfig {
	const config: TransformConfig = {};

	// Load from config file if specified
	if (process.env.PIE_QTI_CONFIG) {
		// Don't load synchronously here - caller should use loadFromFile
		// Just return the path reference
		return config;
	}

	// Storage configuration
	if (process.env.PIE_QTI_STORAGE_BACKEND) {
		config.storage = {
			backend: process.env.PIE_QTI_STORAGE_BACKEND,
			options: {},
		};

		// Filesystem-specific options
		if (
			config.storage &&
			process.env.PIE_QTI_STORAGE_BACKEND === 'filesystem' &&
			process.env.PIE_QTI_STORAGE_ROOT_DIR
		) {
			config.storage.options = {
				rootDir: process.env.PIE_QTI_STORAGE_ROOT_DIR,
			};
		}

		// Backend-specific options are loaded by the backend implementation
	}

	// Logger configuration
	if (process.env.PIE_QTI_LOG_LEVEL) {
		config.logger = {
			level: process.env.PIE_QTI_LOG_LEVEL as
				| 'debug'
				| 'info'
				| 'warn'
				| 'error',
		};
	}

	return config;
}

/**
 * Merge multiple configuration objects
 * Later configs override earlier ones
 */
export function merge(...configs: TransformConfig[]): TransformConfig {
	const merged: TransformConfig = {};

	for (const config of configs) {
		// Merge storage config
		if (config.storage) {
			// If backend changes, replace options completely
			if (
				merged.storage &&
				config.storage.backend !== merged.storage.backend
			) {
				merged.storage = {
					...config.storage,
				};
			} else {
				// Same backend or no previous storage, merge options
				merged.storage = {
					...merged.storage,
					...config.storage,
					options: {
						...merged.storage?.options,
						...config.storage.options,
					},
				};
			}
		}

		// Merge plugins
		if (config.plugins) {
			merged.plugins = merged.plugins || {};
			for (const [sourceFormat, targets] of Object.entries(config.plugins)) {
				merged.plugins[sourceFormat] = {
					...merged.plugins[sourceFormat],
					...targets,
				};
			}
		}

		// Merge format detectors
		if (config.formatDetectors) {
			merged.formatDetectors = [
				...(merged.formatDetectors || []),
				...config.formatDetectors,
			];
		}

		// Merge vendor extensions
		if (config.vendorExtensions) {
			merged.vendorExtensions = {
				detectors: [
					...(merged.vendorExtensions?.detectors || []),
					...(config.vendorExtensions.detectors || []),
				],
				transformers: [
					...(merged.vendorExtensions?.transformers || []),
					...(config.vendorExtensions.transformers || []),
				],
				assetResolvers: [
					...(merged.vendorExtensions?.assetResolvers || []),
					...(config.vendorExtensions.assetResolvers || []),
				],
				cssClassExtractors: [
					...(merged.vendorExtensions?.cssClassExtractors || []),
					...(config.vendorExtensions.cssClassExtractors || []),
				],
				metadataExtractors: [
					...(merged.vendorExtensions?.metadataExtractors || []),
					...(config.vendorExtensions.metadataExtractors || []),
				],
			};
		}

		// Merge logger config
		if (config.logger) {
			merged.logger = {
				...merged.logger,
				...config.logger,
			};
		}
	}

	return merged;
}
