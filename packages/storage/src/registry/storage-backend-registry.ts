/**
 * Storage Backend Registry
 *
 * Central registry for managing storage backend factories
 * Allows dynamic registration of storage backends by name
 */

import type { StorageBackend } from '@pie-qti/transform-types';

/**
 * Factory function type for creating storage backends
 */
export type StorageBackendFactory = (
	options?: Record<string, unknown>,
) => StorageBackend;

/**
 * Registry for storage backend factories
 */
export class StorageBackendRegistry {
	private factories = new Map<string, StorageBackendFactory>();

	/**
	 * Register a storage backend factory
	 * @param name - Unique name for the backend (e.g., 'filesystem', 's3', 'custom-backend')
	 * @param factory - Factory function that creates the backend instance
	 */
	register(name: string, factory: StorageBackendFactory): void {
		if (this.factories.has(name)) {
			throw new Error(`Storage backend '${name}' is already registered`);
		}
		this.factories.set(name, factory);
	}

	/**
	 * Unregister a storage backend
	 */
	unregister(name: string): boolean {
		return this.factories.delete(name);
	}

	/**
	 * Check if a backend is registered
	 */
	has(name: string): boolean {
		return this.factories.has(name);
	}

	/**
	 * Create a storage backend instance
	 * @param name - Name of the backend to create
	 * @param options - Backend-specific configuration options
	 * @throws Error if backend is not registered
	 */
	create(name: string, options?: Record<string, unknown>): StorageBackend {
		const factory = this.factories.get(name);
		if (!factory) {
			const available = Array.from(this.factories.keys()).join(', ');
			throw new Error(
				`Storage backend '${name}' is not registered. Available backends: ${available || 'none'}`,
			);
		}
		return factory(options);
	}

	/**
	 * Get all registered backend names
	 */
	getRegisteredNames(): string[] {
		return Array.from(this.factories.keys());
	}

	/**
	 * Clear all registered backends
	 */
	clear(): void {
		this.factories.clear();
	}

	/**
	 * Get count of registered backends
	 */
	get size(): number {
		return this.factories.size;
	}
}

/**
 * Global registry instance
 * Can be used directly or extended with custom registries
 */
export const storageBackendRegistry = new StorageBackendRegistry();
