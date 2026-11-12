/**
 * Storage abstraction layer interfaces
 * Provides pluggable storage backends (filesystem, S3, database, etc.)
 */

import type { Readable, Writable } from 'stream';

/**
 * Resource metadata
 */
export interface ResourceMetadata {
	/** Resource URI */
	uri: string;
	/** Resource size in bytes */
	size: number;
	/** MIME type (if available) */
	mimeType?: string;
	/** Last modified timestamp */
	lastModified?: Date;
	/** ETag or version identifier (for caching/optimistic concurrency) */
	etag?: string;
	/** Custom metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Resource information (lightweight version without full metadata)
 */
export interface ResourceInfo {
	/** Resource URI */
	uri: string;
	/** Resource type */
	type: 'file' | 'directory';
	/** Resource size in bytes (for files) */
	size?: number;
	/** Last modified timestamp */
	lastModified?: Date;
}

/**
 * Write options
 */
export interface WriteOptions {
	/** MIME type for the content */
	mimeType?: string;
	/** Custom metadata */
	metadata?: Record<string, unknown>;
	/** Content encoding */
	encoding?: BufferEncoding;
	/** If true, create parent directories automatically */
	createParents?: boolean;
}

/**
 * Core storage backend interface
 * Implementations provide different storage mechanisms (filesystem, S3, database)
 */
export interface StorageBackend {
	/** Unique name identifying this storage backend */
	readonly name: string;

	/** Initialize the storage backend (create directories, connect to services, etc.) */
	initialize(): Promise<void>;

	// Basic Read/Write operations
	/** Read a file as UTF-8 text */
	readText(uri: string): Promise<string>;

	/** Write UTF-8 text to a file */
	writeText(uri: string, content: string, options?: WriteOptions): Promise<void>;

	/** Read a file as a binary Buffer */
	readBuffer(uri: string): Promise<Buffer>;

	/** Write binary Buffer to a file */
	writeBuffer(uri: string, content: Buffer, options?: WriteOptions): Promise<void>;

	/** Write content (text or buffer) to a file */
	write(uri: string, content: string | Buffer, options?: WriteOptions): Promise<void>;

	// Streaming operations (for large content)
	/** Create a readable stream for a resource */
	createReadStream(uri: string): Promise<Readable>;

	/** Create a writable stream for a resource */
	createWriteStream(uri: string): Promise<Writable>;

	// Metadata operations
	/** Get full metadata for a resource */
	getMetadata?(uri: string): Promise<ResourceMetadata>;

	/** Check if a file or directory exists */
	exists(uri: string): Promise<boolean>;

	/** List resources matching a pattern (e.g., "items/*.xml") */
	list(pattern: string): Promise<ResourceInfo[]>;

	/** Delete a file or empty directory */
	delete(uri: string): Promise<void>;

	/** Copy a file from source to destination */
	copy?(sourceUri: string, destUri: string): Promise<void>;

	// Batch operations (optional, for efficiency)
	/** Read multiple resources in one operation */
	readBatch?(uris: string[]): Promise<Map<string, string | Buffer>>;

	/** Write multiple resources in one operation */
	writeBatch?(
		writes: Array<{ uri: string; content: string | Buffer; options?: WriteOptions }>
	): Promise<void>;

	// Directory operations (optional, for filesystem-like backends)
	/** List all files in a directory (not recursive) */
	listFiles?(path: string): Promise<string[]>;

	/** Create a directory (and parent directories if needed) */
	createDirectory?(path: string): Promise<void>;

	/** Get total size of all files in a directory recursively */
	getDirectorySize?(path: string): Promise<number>;
}
