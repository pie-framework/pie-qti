/**
 * S3 Storage Backend
 * Storage backend using AWS S3 or S3-compatible services
 *
 * Note: This is a demonstration/stub implementation.
 * Full S3 implementation would require @aws-sdk/client-s3 dependency.
 */

import type { StorageBackend } from '@pie-qti/transform-types';

export interface S3BackendOptions {
	/**
	 * S3 bucket name
	 */
	bucket: string;

	/**
	 * AWS region
	 */
	region: string;

	/**
	 * Base path prefix for all keys
	 * @default ''
	 */
	prefix?: string;

	/**
	 * S3 endpoint URL (for S3-compatible services)
	 */
	endpoint?: string;

	/**
	 * AWS credentials
	 */
	credentials?: {
		accessKeyId: string;
		secretAccessKey: string;
	};
}

/**
 * S3 storage backend (stub implementation)
 *
 * This is a placeholder for S3 storage backend.
 * To use this backend, install @aws-sdk/client-s3:
 *
 * ```bash
 * bun add @aws-sdk/client-s3
 * ```
 *
 * Then implement the full S3Client integration.
 */
export class S3Backend implements StorageBackend {
	readonly name = 's3';
	// private _options: S3BackendOptions;

	constructor(_options: S3BackendOptions) {
		// this._options = options;
		// Options would be used in a full implementation
	}

	async initialize(): Promise<void> {
		throw new Error(
			'S3Backend is a stub implementation. Install @aws-sdk/client-s3 and implement S3Client integration.',
		);
	}

	async readText(_path: string): Promise<string> {
		throw new Error('S3Backend not implemented');
	}

	async writeText(_path: string, _content: string): Promise<void> {
		throw new Error('S3Backend not implemented');
	}

	async readBuffer(_path: string): Promise<Buffer> {
		throw new Error('S3Backend not implemented');
	}

	async writeBuffer(_path: string, _content: Buffer): Promise<void> {
		throw new Error('S3Backend not implemented');
	}

	async exists(_path: string): Promise<boolean> {
		throw new Error('S3Backend not implemented');
	}

	async listFiles(_path: string): Promise<string[]> {
		throw new Error('S3Backend not implemented');
	}

	async delete(_path: string): Promise<void> {
		throw new Error('S3Backend not implemented');
	}

	async copy(_sourcePath: string, _destPath: string): Promise<void> {
		throw new Error('S3Backend not implemented');
	}

	async getSize(_path: string): Promise<number> {
		throw new Error('S3Backend not implemented');
	}

	async createDirectory(_path: string): Promise<void> {
		// S3 doesn't have directories - this is a no-op
	}

	async getDirectorySize(_path: string): Promise<number> {
		throw new Error('S3Backend not implemented');
	}

	async getUrl(_path: string): Promise<string> {
		throw new Error('S3Backend not implemented');
	}
}
