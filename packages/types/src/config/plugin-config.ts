/**
 * Plugin configuration types
 * Enables dynamic loading and registration of transform plugins
 */

import type { VendorExtensionConfig } from './vendor-config.js';

/**
 * Configuration for loading a plugin module
 */
export interface PluginConfig {
	/** NPM package or file path to the plugin module */
	module: string;

	/** Named export from the module (default: 'default') */
	export?: string;

	/** Constructor options to pass to the plugin */
	options?: Record<string, unknown>;
}

/**
 * Storage backend configuration
 */
export interface StorageConfig {
	/** Type of storage backend */
	backend: 'filesystem' | 's3' | 'database' | 'custom';

	/** Backend-specific configuration options */
	options?: Record<string, unknown>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
	/** Log level */
	level?: 'debug' | 'info' | 'warn' | 'error';

	/** Log output format */
	format?: 'json' | 'text';
}

/**
 * Complete transformation configuration
 * Loaded from config file or environment variables
 */
export interface TransformConfig {
	/** Storage backend configuration */
	storage?: StorageConfig;

	/**
	 * Plugin registration by format pair
	 * Maps sourceFormat -> targetFormat -> PluginConfig
	 * Example: { "qti22": { "pie": { module: "@pie-qti/qti2-to-pie" } } }
	 */
	plugins?: {
		[sourceFormat: string]: {
			[targetFormat: string]: PluginConfig;
		};
	};

	/** Custom format detectors to register */
	formatDetectors?: PluginConfig[];

	/** Vendor extension configuration */
	vendorExtensions?: VendorExtensionConfig;

	/** Logger configuration */
	logger?: LoggerConfig;
}
