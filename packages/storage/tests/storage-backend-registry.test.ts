/**
 * Storage Backend Registry Tests
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import {
	StorageBackendRegistry,
	storageBackendRegistry,
} from '../src/registry/storage-backend-registry.js';
// Import storage package to trigger backend registration
import '@pie-qti/storage';
import type { StorageBackend } from '@pie-qti/transform-types';

// Mock storage backend for testing
class MockBackend implements StorageBackend {
	readonly name: string;
	private options?: Record<string, unknown>;

	constructor(name: string, options?: Record<string, unknown>) {
		this.name = name;
		this.options = options;
	}

	async initialize(): Promise<void> {
		// Mock implementation
	}

	async readText(_path: string): Promise<string> {
		return '';
	}

	async writeText(_path: string, _content: string): Promise<void> {
		// Mock implementation
	}

	async readBuffer(_path: string): Promise<Buffer> {
		return Buffer.from('');
	}

	async writeBuffer(_path: string, _content: Buffer): Promise<void> {
		// Mock implementation
	}

	async exists(_path: string): Promise<boolean> {
		return false;
	}

	async list(_pattern: string): Promise<any[]> {
		return [];
	}

	async delete(_path: string): Promise<void> {
		// Mock implementation
	}

	async write(_path: string, _content: string | Buffer): Promise<void> {
		// Mock implementation
	}

	async createReadStream(_path: string): Promise<any> {
		throw new Error('Not implemented');
	}

	async createWriteStream(_path: string): Promise<any> {
		throw new Error('Not implemented');
	}
}

describe('StorageBackendRegistry', () => {
	let registry: StorageBackendRegistry;

	beforeEach(() => {
		registry = new StorageBackendRegistry();
	});

	describe('register', () => {
		test('should register a backend factory', () => {
			registry.register('test-backend', (options) => {
				return new MockBackend('test-backend', options);
			});

			expect(registry.has('test-backend')).toBe(true);
			expect(registry.size).toBe(1);
		});

		test('should throw error when registering duplicate name', () => {
			registry.register('test-backend', () => new MockBackend('test-backend'));

			expect(() => {
				registry.register('test-backend', () => new MockBackend('test-backend'));
			}).toThrow("Storage backend 'test-backend' is already registered");
		});
	});

	describe('create', () => {
		test('should create backend instance from registered factory', () => {
			registry.register('test-backend', (options) => {
				return new MockBackend('test-backend', options);
			});

			const backend = registry.create('test-backend', { key: 'value' });
			expect(backend).toBeInstanceOf(MockBackend);
			expect(backend.name).toBe('test-backend');
		});

		test('should pass options to factory', () => {
			let receivedOptions: Record<string, unknown> | undefined;
			registry.register('test-backend', (options) => {
				receivedOptions = options;
				return new MockBackend('test-backend', options);
			});

			const testOptions = { rootDir: '/test', enabled: true };
			registry.create('test-backend', testOptions);

			expect(receivedOptions).toEqual(testOptions);
		});

		test('should throw error for unregistered backend', () => {
			expect(() => {
				registry.create('unknown-backend');
			}).toThrow("Storage backend 'unknown-backend' is not registered");
		});

		test('should include available backends in error message', () => {
			registry.register('backend1', () => new MockBackend('backend1'));
			registry.register('backend2', () => new MockBackend('backend2'));

			expect(() => {
				registry.create('unknown-backend');
			}).toThrow('Available backends: backend1, backend2');
		});
	});

	describe('unregister', () => {
		test('should unregister a backend', () => {
			registry.register('test-backend', () => new MockBackend('test-backend'));
			expect(registry.has('test-backend')).toBe(true);

			const result = registry.unregister('test-backend');
			expect(result).toBe(true);
			expect(registry.has('test-backend')).toBe(false);
		});

		test('should return false when unregistering non-existent backend', () => {
			const result = registry.unregister('unknown-backend');
			expect(result).toBe(false);
		});
	});

	describe('getRegisteredNames', () => {
		test('should return all registered backend names', () => {
			registry.register('backend1', () => new MockBackend('backend1'));
			registry.register('backend2', () => new MockBackend('backend2'));
			registry.register('backend3', () => new MockBackend('backend3'));

			const names = registry.getRegisteredNames();
			expect(names).toContain('backend1');
			expect(names).toContain('backend2');
			expect(names).toContain('backend3');
			expect(names.length).toBe(3);
		});

		test('should return empty array when no backends registered', () => {
			const names = registry.getRegisteredNames();
			expect(names).toEqual([]);
		});
	});

	describe('clear', () => {
		test('should clear all registered backends', () => {
			registry.register('backend1', () => new MockBackend('backend1'));
			registry.register('backend2', () => new MockBackend('backend2'));

			expect(registry.size).toBe(2);
			registry.clear();
			expect(registry.size).toBe(0);
			expect(registry.getRegisteredNames()).toEqual([]);
		});
	});

	describe('global registry', () => {
		test('should allow registering custom backends', () => {
			storageBackendRegistry.register('custom-backend', (options) => {
				return new MockBackend('custom-backend', options);
			});

			expect(storageBackendRegistry.has('custom-backend')).toBe(true);

			const backend = storageBackendRegistry.create('custom-backend');
			expect(backend.name).toBe('custom-backend');

			// Clean up
			storageBackendRegistry.unregister('custom-backend');
		});

		test('should allow registering and using any backend name', () => {
			// Demonstrate extensibility - any name works
			storageBackendRegistry.register('my-custom-storage', (options) => {
				return new MockBackend('my-custom-storage', options);
			});

			const backend = storageBackendRegistry.create('my-custom-storage', {
				customOption: 'value',
			});
			expect(backend.name).toBe('my-custom-storage');

			// Clean up
			storageBackendRegistry.unregister('my-custom-storage');
		});
	});
});
