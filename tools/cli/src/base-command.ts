/**
 * Base Command with Config Loading Support
 * All commands extend this to get config file support
 */

import { Command, Flags } from '@oclif/core';
import { TransformEngine } from '@pie-qti/transform-core';
import {
	loadFromEnv,
	loadFromFile,
	merge,
} from '@pie-qti/transform-core/config/config-loader.js';
import {
	loadAndRegisterPlugins,
	loadFormatDetectors,
} from '@pie-qti/transform-core/config/plugin-loader.js';
import type { TransformConfig } from '@pie-qti/transform-types';

/**
 * Base command with config loading capabilities
 */
export abstract class BaseCommand extends Command {
	/**
	 * Global flags available to all commands
	 */
	static baseFlags = {
		config: Flags.string({
			char: 'c',
			description: 'Path to configuration file (JSON)',
			required: false,
		}),
	};

	protected transformConfig?: TransformConfig;

	/**
	 * Load configuration from file and environment
	 */
	protected async loadConfig(configPath?: string): Promise<TransformConfig> {
		if (this.transformConfig) {
			return this.transformConfig;
		}

		// Start with environment variables
		let config = loadFromEnv();

		// Load from explicit config file if provided
		if (configPath) {
			try {
				const fileConfig = await loadFromFile(configPath);
				config = merge(config, fileConfig);
				this.log(`✓ Loaded configuration from ${configPath}`);
			} catch (error) {
				this.warn(`Failed to load config from ${configPath}: ${(error as Error).message}`);
			}
		}
		// Or check PIE_QTI_CONFIG environment variable
		else if (process.env.PIE_QTI_CONFIG) {
			try {
				const fileConfig = await loadFromFile(process.env.PIE_QTI_CONFIG);
				config = merge(config, fileConfig);
				this.log(`✓ Loaded configuration from ${process.env.PIE_QTI_CONFIG}`);
			} catch (error) {
				this.warn(
					`Failed to load config from ${process.env.PIE_QTI_CONFIG}: ${(error as Error).message}`,
				);
			}
		}

		this.transformConfig = config;
		return config;
	}

	/**
	 * Create and configure transform engine from config
	 */
	protected async createEngine(configPath?: string): Promise<TransformEngine> {
		const config = await this.loadConfig(configPath);
		const engine = new TransformEngine();

		// Load and register plugins from configuration
		if (config.plugins) {
			await loadAndRegisterPlugins(engine, config.plugins);
			const pluginCount = Object.keys(config.plugins).reduce(
				(count, source) => count + Object.keys(config.plugins![source]).length,
				0,
			);
			if (pluginCount > 0) {
				this.log(`✓ Loaded ${pluginCount} plugin(s) from configuration`);
			}
		}

		// Load and register format detectors
		if (config.formatDetectors) {
			await loadFormatDetectors(engine, config.formatDetectors);
			this.log(`✓ Loaded ${config.formatDetectors.length} format detector(s)`);
		}

		return engine;
	}

	/**
	 * Get config value for display
	 */
	protected getTransformConfig(): TransformConfig | undefined {
		return this.transformConfig;
	}
}
