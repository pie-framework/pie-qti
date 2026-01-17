/**
 * Configuration Loader Tests
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadFromFile, loadFromEnv, merge } from '../src/config/config-loader';
import type { TransformConfig } from '@pie-qti/transform-types';

describe('ConfigLoader', () => {
	describe('loadFromFile', () => {
		let tempDir: string;

		beforeEach(async () => {
			tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
		});

		afterEach(async () => {
			await fs.rm(tempDir, { recursive: true, force: true });
		});

		test('should load valid config from JSON file', async () => {
			const configPath = path.join(tempDir, 'config.json');
			const config: TransformConfig = {
				storage: {
					backend: 'filesystem',
					options: {
						rootDir: '/data/storage',
					},
				},
				logger: {
					level: 'debug',
				},
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			const loaded = await loadFromFile(configPath);

			expect(loaded).toEqual(config);
		});

		test('should handle relative paths', async () => {
			const configPath = path.join(tempDir, 'config.json');
			const config: TransformConfig = {
				logger: {
					level: 'info',
				},
			};

			await fs.writeFile(configPath, JSON.stringify(config));

			// Use relative path
			const originalCwd = process.cwd();
			try {
				process.chdir(tempDir);
				const loaded = await loadFromFile('./config.json');
				expect(loaded).toEqual(config);
			} finally {
				process.chdir(originalCwd);
			}
		});

		test('should throw error for non-existent file', async () => {
			await expect(
				loadFromFile(path.join(tempDir, 'nonexistent.json')),
			).rejects.toThrow('Failed to load config');
		});

		test('should throw error for invalid JSON', async () => {
			const configPath = path.join(tempDir, 'invalid.json');
			await fs.writeFile(configPath, 'not valid json{');

			await expect(loadFromFile(configPath)).rejects.toThrow(
				'Failed to load config',
			);
		});
	});

	describe('loadFromEnv', () => {
		const originalEnv = { ...process.env };

		afterEach(() => {
			// Restore original env
			process.env = { ...originalEnv };
		});

		test('should return empty config when no env vars set', () => {
			// Clear relevant env vars
			delete process.env.PIE_QTI_STORAGE_BACKEND;
			delete process.env.PIE_QTI_LOG_LEVEL;

			const config = loadFromEnv();

			expect(config).toEqual({});
		});

		test('should load filesystem storage config from env', () => {
			process.env.PIE_QTI_STORAGE_BACKEND = 'filesystem';
			process.env.PIE_QTI_STORAGE_ROOT_DIR = '/data/storage';

			const config = loadFromEnv();

			expect(config.storage).toEqual({
				backend: 'filesystem',
				options: {
					rootDir: '/data/storage',
				},
			});
		});

		test('should load S3 storage config from env', () => {
			process.env.PIE_QTI_STORAGE_BACKEND = 's3';
			process.env.PIE_QTI_S3_BUCKET = 'my-bucket';
			process.env.PIE_QTI_S3_REGION = 'us-west-2';
			process.env.PIE_QTI_S3_PREFIX = 'pie-qti/';
			process.env.PIE_QTI_S3_ENDPOINT = 'https://s3.example.com';

			const config = loadFromEnv();

			expect(config.storage).toEqual({
				backend: 's3',
				options: {
					bucket: 'my-bucket',
					region: 'us-west-2',
					prefix: 'pie-qti/',
					endpoint: 'https://s3.example.com',
				},
			});
		});

		test('should load database storage config from env', () => {
			process.env.PIE_QTI_STORAGE_BACKEND = 'database';
			process.env.PIE_QTI_DATABASE_URL = 'postgresql://localhost/pieqti';

			const config = loadFromEnv();

			expect(config.storage).toEqual({
				backend: 'database',
				options: {
					connectionString: 'postgresql://localhost/pieqti',
				},
			});
		});

		test('should load logger config from env', () => {
			process.env.PIE_QTI_LOG_LEVEL = 'warn';

			const config = loadFromEnv();

			expect(config.logger).toEqual({
				level: 'warn',
			});
		});

		test('should combine multiple env vars', () => {
			process.env.PIE_QTI_STORAGE_BACKEND = 'filesystem';
			process.env.PIE_QTI_STORAGE_ROOT_DIR = '/data/storage';
			process.env.PIE_QTI_LOG_LEVEL = 'debug';

			const config = loadFromEnv();

			expect(config.storage?.backend).toBe('filesystem');
			expect(config.logger?.level).toBe('debug');
		});
	});

	describe('merge', () => {
		test('should merge two configs', () => {
			const config1: TransformConfig = {
				storage: {
					backend: 'filesystem',
					options: {
						rootDir: '/data/storage',
					},
				},
			};

			const config2: TransformConfig = {
				logger: {
					level: 'debug',
				},
			};

			const merged = merge(config1, config2);

			expect(merged.storage?.backend).toBe('filesystem');
			expect(merged.logger?.level).toBe('debug');
		});

		test('should override earlier configs with later ones', () => {
			const config1: TransformConfig = {
				storage: {
					backend: 'filesystem',
					options: {
						rootDir: '/data/storage',
					},
				},
			};

			const config2: TransformConfig = {
				storage: {
					backend: 's3',
					options: {
						bucket: 'my-bucket',
					},
				},
			};

			const merged = merge(config1, config2);

			expect(merged.storage?.backend).toBe('s3');
			expect(merged.storage?.options).toEqual({
				bucket: 'my-bucket',
			});
		});

		test('should merge plugin configs', () => {
			const config1: TransformConfig = {
				plugins: {
					qti22: {
						pie: {
							module: '@pie-qti/qti2-to-pie',
						},
					},
				},
			};

			const config2: TransformConfig = {
				plugins: {
					qti22: {
						learnosity: {
							module: '@acme/qti-to-learnosity',
						},
					},
				},
			};

			const merged = merge(config1, config2);

			expect(merged.plugins?.qti22?.pie).toBeDefined();
			expect(merged.plugins?.qti22?.learnosity).toBeDefined();
		});

		test('should merge vendor extensions', () => {
			const config1: TransformConfig = {
				vendorExtensions: {
					detectors: [
						{
							module: '@pie-qti/vendor-a',
							export: 'DetectorA',
						},
					],
				},
			};

			const config2: TransformConfig = {
				vendorExtensions: {
					detectors: [
						{
							module: '@pie-qti/vendor-b',
							export: 'DetectorB',
						},
					],
					transformers: [
						{
							module: '@pie-qti/vendor-b',
							export: 'TransformerB',
						},
					],
				},
			};

			const merged = merge(config1, config2);

			expect(merged.vendorExtensions?.detectors).toHaveLength(2);
			expect(merged.vendorExtensions?.transformers).toHaveLength(1);
		});

		test('should handle empty configs', () => {
			const merged = merge({}, {}, {});

			expect(merged).toEqual({});
		});

		test('should merge multiple configs in order', () => {
			const config1: TransformConfig = {
				logger: { level: 'error' },
			};
			const config2: TransformConfig = {
				logger: { level: 'warn' },
			};
			const config3: TransformConfig = {
				logger: { level: 'debug' },
			};

			const merged = merge(config1, config2, config3);

			expect(merged.logger?.level).toBe('debug');
		});
	});
});
