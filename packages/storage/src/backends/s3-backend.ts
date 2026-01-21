/**
 * S3 Storage Backend
 * Storage backend using AWS S3 or S3-compatible services
 */

import type { StorageBackend, ResourceInfo } from '@pie-qti/transform-types';

// Type definitions for optional AWS SDK modules
type S3ClientType = any;
type CommandType = any;
type GetSignedUrlFunction = (client: any, command: any, options: any) => Promise<string>;

// These imports are optional peer dependencies
let S3Client: S3ClientType | undefined;
let GetObjectCommand: CommandType | undefined;
let PutObjectCommand: CommandType | undefined;
let HeadObjectCommand: CommandType | undefined;
let DeleteObjectCommand: CommandType | undefined;
let CopyObjectCommand: CommandType | undefined;
let ListObjectsV2Command: CommandType | undefined;
let getSignedUrl: GetSignedUrlFunction | undefined;

// Try to load AWS SDK modules if available
async function loadAwsSdk() {
	try {
		// Use Function constructor to avoid TypeScript compile-time module resolution
		const dynamicImport = new Function('specifier', 'return import(specifier)');

		const s3Module = await dynamicImport('@aws-sdk/client-s3');
		S3Client = s3Module.S3Client;
		GetObjectCommand = s3Module.GetObjectCommand;
		PutObjectCommand = s3Module.PutObjectCommand;
		HeadObjectCommand = s3Module.HeadObjectCommand;
		DeleteObjectCommand = s3Module.DeleteObjectCommand;
		CopyObjectCommand = s3Module.CopyObjectCommand;
		ListObjectsV2Command = s3Module.ListObjectsV2Command;

		const presignerModule = await dynamicImport('@aws-sdk/s3-request-presigner');
		getSignedUrl = presignerModule.getSignedUrl;
	} catch {
		// AWS SDK not installed - will throw helpful errors at runtime
	}
}

// Load AWS SDK at module initialization
const awsSdkLoaded = loadAwsSdk();

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

	/**
	 * Default presigned URL expiration in seconds
	 * @default 3600 (1 hour)
	 */
	defaultUrlExpiration?: number;
}

/**
 * S3 storage backend with presigned URL support
 *
 * To use this backend, install the AWS SDK:
 *
 * ```bash
 * bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 * ```
 */
export class S3Backend implements StorageBackend {
	readonly name = 's3';
	private client: any;
	private options: S3BackendOptions;

	constructor(options: S3BackendOptions) {
		this.options = {
			prefix: '',
			defaultUrlExpiration: 3600,
			...options,
		};
	}

	/**
	 * Ensure AWS SDK is loaded
	 */
	private async ensureAwsSdk(): Promise<void> {
		await awsSdkLoaded;
		if (!S3Client) {
			throw new Error(
				'AWS SDK not found. Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner to use S3Backend.',
			);
		}
	}

	/**
	 * Get the full S3 key for a path
	 */
	private getKey(path: string): string {
		const normalized = path.startsWith('/') ? path.slice(1) : path;
		return this.options.prefix ? `${this.options.prefix}/${normalized}` : normalized;
	}

	async initialize(): Promise<void> {
		await this.ensureAwsSdk();

		this.client = new S3Client!({
			region: this.options.region,
			endpoint: this.options.endpoint,
			credentials: this.options.credentials,
		});

		// Test connection by listing bucket
		try {
			await this.client.send(
				new ListObjectsV2Command!({
					Bucket: this.options.bucket,
					MaxKeys: 1,
				}),
			);
		} catch (error) {
			throw new Error(
				`Failed to initialize S3Backend: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async readText(path: string): Promise<string> {
		const buffer = await this.readBuffer(path);
		return buffer.toString('utf-8');
	}

	async writeText(path: string, content: string): Promise<void> {
		await this.writeBuffer(path, Buffer.from(content, 'utf-8'));
	}

	async readBuffer(path: string): Promise<Buffer> {
		await this.ensureAwsSdk();

		try {
			const command = new GetObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
			});

			const response = await this.client.send(command);
			const stream = response.Body;

			// Convert stream to buffer
			const chunks: Uint8Array[] = [];
			for await (const chunk of stream) {
				chunks.push(chunk);
			}

			return Buffer.concat(chunks);
		} catch (error: any) {
			if (error.name === 'NoSuchKey') {
				throw new Error(`File not found: ${path}`);
			}
			throw new Error(
				`Failed to read from S3: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async writeBuffer(path: string, content: Buffer): Promise<void> {
		await this.ensureAwsSdk();

		try {
			const command = new PutObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
				Body: content,
			});

			await this.client.send(command);
		} catch (error) {
			throw new Error(
				`Failed to write to S3: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async exists(path: string): Promise<boolean> {
		await this.ensureAwsSdk();

		try {
			const command = new HeadObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
			});

			await this.client.send(command);
			return true;
		} catch (error: any) {
			if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
				return false;
			}
			throw new Error(
				`Failed to check S3 object existence: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async listFiles(path: string): Promise<string[]> {
		await this.ensureAwsSdk();

		try {
			const prefix = this.getKey(path);
			const command = new ListObjectsV2Command!({
				Bucket: this.options.bucket,
				Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
			});

			const response = await this.client.send(command);
			const contents = response.Contents || [];

			return contents.map((item: any) => item.Key as string).filter((key: string) => key !== prefix);
		} catch (error) {
			throw new Error(
				`Failed to list S3 objects: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async delete(path: string): Promise<void> {
		await this.ensureAwsSdk();

		try {
			const command = new DeleteObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
			});

			await this.client.send(command);
		} catch (error) {
			throw new Error(
				`Failed to delete from S3: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async copy(sourcePath: string, destPath: string): Promise<void> {
		await this.ensureAwsSdk();

		try {
			const command = new CopyObjectCommand!({
				Bucket: this.options.bucket,
				CopySource: `${this.options.bucket}/${this.getKey(sourcePath)}`,
				Key: this.getKey(destPath),
			});

			await this.client.send(command);
		} catch (error) {
			throw new Error(
				`Failed to copy in S3: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async getSize(path: string): Promise<number> {
		await this.ensureAwsSdk();

		try {
			const command = new HeadObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
			});

			const response = await this.client.send(command);
			return response.ContentLength || 0;
		} catch (error: any) {
			if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
				throw new Error(`File not found: ${path}`);
			}
			throw new Error(
				`Failed to get S3 object size: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async createDirectory(_path: string): Promise<void> {
		// S3 doesn't have directories - this is a no-op
	}

	async getDirectorySize(path: string): Promise<number> {
		const files = await this.listFiles(path);
		let totalSize = 0;

		for (const file of files) {
			totalSize += await this.getSize(file);
		}

		return totalSize;
	}

	/**
	 * Get a presigned URL for direct access to an S3 object
	 *
	 * @param path - Path to the file
	 * @param expiresIn - URL expiration time in seconds (default: 3600)
	 * @returns Presigned URL for downloading the file
	 */
	async getUrl(path: string, expiresIn?: number): Promise<string> {
		await this.ensureAwsSdk();

		if (!getSignedUrl) {
			throw new Error(
				'@aws-sdk/s3-request-presigner not found. Install it to use presigned URLs.',
			);
		}

		try {
			const command = new GetObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
			});

			const url = await getSignedUrl(this.client, command, {
				expiresIn: expiresIn ?? this.options.defaultUrlExpiration,
			});

			return url;
		} catch (error) {
			throw new Error(
				`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get a presigned URL for uploading to S3
	 *
	 * @param path - Path where the file will be uploaded
	 * @param expiresIn - URL expiration time in seconds (default: 3600)
	 * @returns Presigned URL for uploading the file
	 */
	async getUploadUrl(path: string, expiresIn?: number): Promise<string> {
		await this.ensureAwsSdk();

		if (!getSignedUrl) {
			throw new Error(
				'@aws-sdk/s3-request-presigner not found. Install it to use presigned URLs.',
			);
		}

		try {
			const command = new PutObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
			});

			const url = await getSignedUrl(this.client, command, {
				expiresIn: expiresIn ?? this.options.defaultUrlExpiration,
			});

			return url;
		} catch (error) {
			throw new Error(
				`Failed to generate upload presigned URL: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async write(path: string, content: string | Buffer): Promise<void> {
		if (typeof content === 'string') {
			await this.writeText(path, content);
		} else {
			await this.writeBuffer(path, content);
		}
	}

	async createReadStream(path: string): Promise<import('stream').Readable> {
		await this.ensureAwsSdk();

		try {
			const command = new GetObjectCommand!({
				Bucket: this.options.bucket,
				Key: this.getKey(path),
			});

			const response = await this.client.send(command);
			return response.Body as import('stream').Readable;
		} catch (error: any) {
			if (error.name === 'NoSuchKey') {
				throw new Error(`File not found: ${path}`);
			}
			throw new Error(
				`Failed to create read stream: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async createWriteStream(_path: string): Promise<import('stream').Writable> {
		throw new Error(
			'S3Backend does not support write streams. Use writeBuffer() or write() instead.',
		);
	}

	async list(pattern: string): Promise<ResourceInfo[]> {
		await this.ensureAwsSdk();

		try {
			const prefix = this.getKey(pattern);
			const command = new ListObjectsV2Command!({
				Bucket: this.options.bucket,
				Prefix: prefix,
			});

			const response = await this.client.send(command);
			const contents = response.Contents || [];

			return contents.map((item: any) => ({
				path: item.Key as string,
				size: item.Size as number,
				modified: item.LastModified as Date,
				isDirectory: false,
			}));
		} catch (error) {
			throw new Error(
				`Failed to list S3 resources: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
