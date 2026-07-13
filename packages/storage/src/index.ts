/**
 * @pie-qti/storage
 *
 * Storage abstraction layer for PIE Transform framework
 */

// Re-export types from @pie-qti/transform-types
export type {
	StorageBackend,
	SessionStorage,
	ZipExtractor,
	ExtractionResult,
	Session,
} from '@pie-qti/transform-types';

// Export implementations
export { FilesystemBackend } from './backends/filesystem-backend.js';
export type { FilesystemBackendOptions } from './backends/filesystem-backend.js';

export { S3Backend } from './backends/s3-backend.js';
export type { S3BackendOptions } from './backends/s3-backend.js';

export { DatabaseBackend } from './backends/database-backend.js';
export type { DatabaseBackendOptions } from './backends/database-backend.js';

export { SessionStorageImpl } from './session-storage.js';
export type { SessionStorageOptions } from './session-storage.js';

export { StorageZipExtractor } from './zip-extractor.js';
export type { StorageZipExtractorOptions } from './zip-extractor.js';

// Export registry
export {
	StorageBackendRegistry,
	storageBackendRegistry,
} from './registry/storage-backend-registry.js';
export type { StorageBackendFactory } from './registry/storage-backend-registry.js';

// Register built-in backends
import { FilesystemBackend } from './backends/filesystem-backend.js';
import { S3Backend } from './backends/s3-backend.js';
import { DatabaseBackend } from './backends/database-backend.js';
import { storageBackendRegistry } from './registry/storage-backend-registry.js';

storageBackendRegistry.register('filesystem', (options) => {
	const rootDir =
		(options?.rootDir as string) ||
		process.env.PIE_QTI_STORAGE_ROOT_DIR ||
		'./uploads';
	return new FilesystemBackend({ rootDir });
});

storageBackendRegistry.register('s3', (options) => {
	return new S3Backend(options as any);
});

storageBackendRegistry.register('database', (options) => {
	return new DatabaseBackend(options as any);
});
