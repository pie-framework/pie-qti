/**
 * Tests for mock implementations
 */

import { describe, expect, test, beforeEach, spyOn } from 'bun:test';
import {
	MockStorageBackend,
	MockTransformPlugin,
	createMockPlugin,
	SilentLogger,
} from '../src/index.js';

describe('MockStorageBackend', () => {
	let storage: MockStorageBackend;

	beforeEach(() => {
		storage = new MockStorageBackend({
			'file.txt': 'test content',
			'data.json': '{"foo":"bar"}',
		});
	});

	test('initializes with files', () => {
		expect(storage.hasFile('file.txt')).toBe(true);
		expect(storage.hasFile('data.json')).toBe(true);
		expect(storage.getFileCount()).toBe(2);
	});

	test('reads text files', async () => {
		const content = await storage.readText('file.txt');
		expect(content).toBe('test content');
	});

	test('writes text files', async () => {
		await storage.writeText('new.txt', 'new content');
		expect(storage.hasFile('new.txt')).toBe(true);
		const content = await storage.readText('new.txt');
		expect(content).toBe('new content');
	});

	test('reads buffer files', async () => {
		const buffer = await storage.readBuffer('file.txt');
		expect(buffer).toBeInstanceOf(Buffer);
		expect(buffer.toString('utf-8')).toBe('test content');
	});

	test('writes buffer files', async () => {
		const buffer = Buffer.from('binary content');
		await storage.writeBuffer('binary.bin', buffer);
		const read = await storage.readBuffer('binary.bin');
		expect(read).toEqual(buffer);
	});

	test('checks file existence', async () => {
		expect(await storage.exists('file.txt')).toBe(true);
		expect(await storage.exists('missing.txt')).toBe(false);
	});

	test('lists files in directory', async () => {
		await storage.writeText('dir/file1.txt', 'content1');
		await storage.writeText('dir/file2.txt', 'content2');
		await storage.writeText('dir/subdir/file3.txt', 'content3');

		const files = await storage.listFiles('dir');
		expect(files).toContain('file1.txt');
		expect(files).toContain('file2.txt');
		expect(files).not.toContain('file3.txt'); // In subdirectory
	});

	test('deletes files', async () => {
		await storage.delete('file.txt');
		expect(storage.hasFile('file.txt')).toBe(false);
	});

	test('copies files', async () => {
		await storage.copy('file.txt', 'copy.txt');
		expect(storage.hasFile('copy.txt')).toBe(true);
		const content = await storage.readText('copy.txt');
		expect(content).toBe('test content');
	});

	test('gets file size', async () => {
		const size = await storage.getSize('file.txt');
		expect(size).toBe('test content'.length);
	});

	test('lists all files', () => {
		const files = storage.listAllFiles();
		expect(files).toContain('file.txt');
		expect(files).toContain('data.json');
		expect(files.length).toBe(2);
	});

	test('clears all files', () => {
		storage.clear();
		expect(storage.getFileCount()).toBe(0);
	});

	test('throws when reading non-existent file', async () => {
		expect(storage.readText('missing.txt')).rejects.toThrow('File not found');
	});
});

describe('MockTransformPlugin', () => {
	test('creates simple mock plugin', () => {
		const plugin = createMockPlugin('test', 'qti22', 'pie', 500);

		expect(plugin.id).toBe('test');
		expect(plugin.sourceFormat).toBe('qti22');
		expect(plugin.targetFormat).toBe('pie');
		expect(plugin.priority).toBe(500);
		expect(plugin.version).toBe('1.0.0');
	});

	test('canHandle returns true by default', async () => {
		const plugin = createMockPlugin('test', 'qti22', 'pie');
		const result = await plugin.canHandle({ content: 'test' });
		expect(result).toBe(true);
	});

	test('transform returns mock output', async () => {
		const plugin = createMockPlugin('test', 'qti22', 'pie');
		const result = await plugin.transform({ content: 'test' });

		expect(result.items).toEqual([]);
		expect(result.format).toBe('pie');
		expect(result.metadata.pluginId).toBe('test');
		expect(result.metadata.sourceFormat).toBe('qti22');
		expect(result.metadata.targetFormat).toBe('pie');
	});

	test('custom canHandle implementation', async () => {
		const plugin = new MockTransformPlugin('test', 'qti22', 'pie', {
			canHandle: async (input) => input.content.includes('vendor'),
		});

		expect(await plugin.canHandle({ content: 'vendor-specific' })).toBe(true);
		expect(await plugin.canHandle({ content: 'standard' })).toBe(false);
	});

	test('custom transform implementation', async () => {
		const plugin = new MockTransformPlugin('test', 'qti22', 'pie', {
			mockItems: [{ id: 'item-1', element: 'test' }],
		});

		const result = await plugin.transform({ content: 'test' });
		expect(result.items).toHaveLength(1);
		expect(result.items[0].id).toBe('item-1');
	});

	test('tracks call counts', async () => {
		const plugin = createMockPlugin('test', 'qti22', 'pie');

		await plugin.canHandle({ content: 'test' });
		await plugin.canHandle({ content: 'test' });
		await plugin.transform({ content: 'test' });

		expect(plugin.getCanHandleCallCount()).toBe(2);
		expect(plugin.getTransformCallCount()).toBe(1);
	});

	test('tracks last input', async () => {
		const plugin = createMockPlugin('test', 'qti22', 'pie');
		const input = { content: 'test content' };

		await plugin.transform(input);

		expect(plugin.getLastInput()).toEqual(input);
	});

	test('resets counters', async () => {
		const plugin = createMockPlugin('test', 'qti22', 'pie');

		await plugin.canHandle({ content: 'test' });
		await plugin.transform({ content: 'test' });

		plugin.resetCounters();

		expect(plugin.getCanHandleCallCount()).toBe(0);
		expect(plugin.getTransformCallCount()).toBe(0);
		expect(plugin.getLastInput()).toBeUndefined();
	});
});

describe('SilentLogger', () => {
	test('writes nothing to the console', () => {
		const spies = [
			spyOn(console, 'info'),
			spyOn(console, 'warn'),
			spyOn(console, 'error'),
			spyOn(console, 'debug'),
		];

		try {
			const logger = new SilentLogger();
			logger.info('test');
			logger.warn('test');
			logger.error('test');
			logger.debug('test');

			for (const spy of spies) {
				expect(spy).not.toHaveBeenCalled();
			}
		} finally {
			for (const spy of spies) {
				spy.mockRestore();
			}
		}
	});
});
