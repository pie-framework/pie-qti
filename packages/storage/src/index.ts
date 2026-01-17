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
