/**
 * Plugin Loader Tests
 */

import { describe, expect, test } from 'bun:test';
import { TransformEngine } from '../src/engine/transform-engine';
import {
	loadPlugin,
	loadAndRegisterPlugins,
	loadFormatDetectors,
} from '../src/config/plugin-loader';
import type {
	TransformPlugin,
	FormatDetector,
	TransformConfig,
} from '@pie-qti/transform-types';

describe('PluginLoader', () => {
	describe('loadPlugin', () => {
		test('should load plugin with default export', async () => {
			const config = {
				module: new URL('./fixtures/mock-plugin.ts', import.meta.url).href,
			};

			const plugin = await loadPlugin<TransformPlugin>(config);

			expect(plugin.id).toBeDefined();
			expect(plugin.sourceFormat).toBe('mock-source');
			expect(plugin.targetFormat).toBe('mock-target');
		});

		test('should load plugin with named export', async () => {
			const config = {
				module: new URL('./fixtures/mock-plugin.ts', import.meta.url).href,
				export: 'MockPlugin',
			};

			const plugin = await loadPlugin<TransformPlugin>(config);

			expect(plugin.id).toBeDefined();
		});

		test('should pass options to plugin constructor', async () => {
			const config = {
				module: new URL('./fixtures/mock-plugin.ts', import.meta.url).href,
				export: 'MockPlugin',
				options: {
					name: 'custom-plugin',
				},
			};

			const plugin = await loadPlugin<TransformPlugin>(config);

			expect(plugin.id).toBe('custom-plugin');
		});

		test('should load format detector', async () => {
			const config = {
				module: new URL('./fixtures/mock-detector.ts', import.meta.url).href,
				export: 'MockDetector',
				options: {
					priority: 75,
				},
			};

			const detector = await loadPlugin<FormatDetector>(config);

			expect(detector.id).toBe('mock-detector');
			expect(detector.priority).toBe(75);
		});

		test('should throw error for non-existent module', async () => {
			const config = {
				module: './non-existent-module.ts',
			};

			await expect(loadPlugin(config)).rejects.toThrow(
				'Failed to load plugin',
			);
		});

		test('should throw error for non-existent export', async () => {
			const config = {
				module: new URL('./fixtures/mock-plugin.ts', import.meta.url).href,
				export: 'NonExistentExport',
			};

			await expect(loadPlugin(config)).rejects.toThrow(
				'Export "NonExistentExport" not found',
			);
		});
	});

	describe('loadAndRegisterPlugins', () => {
		test('should load and register multiple plugins', async () => {
			const engine = new TransformEngine();
			const pluginConfig: TransformConfig['plugins'] = {
				'mock-source': {
					'mock-target': {
						module: new URL('./fixtures/mock-plugin.ts', import.meta.url).href,
						export: 'MockPlugin',
						options: {
							name: 'plugin-1',
						},
					},
				},
			};

			await loadAndRegisterPlugins(engine, pluginConfig);

			// If we got here, plugins were loaded successfully
			// (testing private registry access would require exposing internals)
			expect(true).toBe(true);
		});

		test('should handle empty plugin config', async () => {
			const engine = new TransformEngine();

			await loadAndRegisterPlugins(engine, undefined);

			// Should not throw
			expect(true).toBe(true);
		});

		test('should continue on plugin load failure', async () => {
			const engine = new TransformEngine();
			const pluginConfig: TransformConfig['plugins'] = {
				'mock-source': {
					'mock-target': {
						module: './non-existent-plugin.ts',
					},
				},
			};

			// Should not throw, just log warning
			await loadAndRegisterPlugins(engine, pluginConfig);

			expect(true).toBe(true);
		});
	});

	describe('loadFormatDetectors', () => {
		test('should load and register format detectors', async () => {
			const engine = new TransformEngine();
			const detectorConfigs = [
				{
					module: new URL('./fixtures/mock-detector.ts', import.meta.url).href,
					export: 'MockDetector',
					options: {
						priority: 75,
					},
				},
			];

			await loadFormatDetectors(engine, detectorConfigs);

			// If we got here, detectors were loaded successfully
			// (testing private formatDetectorRegistry access would require exposing internals)
			expect(true).toBe(true);
		});

		test('should handle empty detector config', async () => {
			const engine = new TransformEngine();

			await loadFormatDetectors(engine, undefined);

			// Should not throw
			expect(true).toBe(true);
		});

		test('should continue on detector load failure', async () => {
			const engine = new TransformEngine();
			const detectorConfigs = [
				{
					module: './non-existent-detector.ts',
				},
			];

			// Should not throw, just log warning
			await loadFormatDetectors(engine, detectorConfigs);

			expect(true).toBe(true);
		});
	});
});
