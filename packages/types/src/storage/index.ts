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
 * Stream options
 */
export interface StreamOptions {
	/** Start byte offset for reading */
	start?: number;
	/** End byte offset for reading */
	end?: number;
	/** Encoding for text streams */
	encoding?: BufferEncoding;
	/** High water mark for stream buffer */
	highWaterMark?: number;
}

/**
 * Transaction interface for atomic operations
 */
export interface Transaction {
	/** Commit the transaction */
	commit(): Promise<void>;
	/** Rollback the transaction */
	rollback(): Promise<void>;
	/** Execute an operation within the transaction */
	execute<T>(operation: () => Promise<T>): Promise<T>;
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
	createReadStream(uri: string, options?: StreamOptions): Promise<Readable>;

	/** Create a writable stream for a resource */
	createWriteStream(uri: string, options?: StreamOptions): Promise<Writable>;

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

	// Transactions (optional, for databases)
	/** Begin a transaction for atomic operations */
	beginTransaction?(): Promise<Transaction>;

	// Directory operations (optional, for filesystem-like backends)
	/** List all files in a directory (not recursive) */
	listFiles?(path: string): Promise<string[]>;

	/** Create a directory (and parent directories if needed) */
	createDirectory?(path: string): Promise<void>;

	/** Get total size of all files in a directory recursively */
	getDirectorySize?(path: string): Promise<number>;
}

/**
 * Session-aware storage wrapper
 * Provides convenience methods for working with session-based storage
 */
export interface SessionStorage {
	/** Get the root path for a session */
	getSessionPath(sessionId: string): string;

	/** Get the uploads path for a session */
	getUploadsPath(sessionId: string): string;

	/** Get the extracted files path for a session */
	getExtractedPath(sessionId: string): string;

	/** Get the outputs path for a session */
	getOutputsPath(sessionId: string): string;

	/** Read session metadata */
	readSessionMetadata(sessionId: string): Promise<Session | null>;

	/** Write session metadata */
	writeSessionMetadata(sessionId: string, session: Session): Promise<void>;

	/** Delete an entire session and all its files */
	deleteSession(sessionId: string): Promise<void>;

	/** List all sessions */
	listSessions(): Promise<Session[]>;

	/** Get total size of a session in bytes */
	getSessionSize(sessionId: string): Promise<number>;
}

/**
 * Session metadata
 */
export interface Session {
	id: string;
	createdAt: string; // ISO 8601 timestamp
	lastAccessedAt?: string; // ISO 8601 timestamp
	status: string; // Extensible session status
	extractedFiles?: string[];
	error?: string;
}

/**
 * Result of ZIP extraction
 */
export interface ExtractionResult {
	/** Whether extraction was successful */
	success: boolean;
	/** List of extracted file paths (relative to extraction directory) */
	files: string[];
	/** Total number of files extracted */
	totalFiles: number;
	/** Total size of extracted files in bytes */
	totalSize: number;
}

/**
 * ZIP extractor interface
 * Handles extraction of ZIP archives to storage backend
 */
export interface ZipExtractor {
	/**
	 * Extract a ZIP archive to a target directory
	 * @param zipPath Path to the ZIP file
	 * @param targetPath Target directory for extraction
	 * @param storage Storage backend to use
	 */
	extract(
		zipPath: string,
		targetPath: string,
		storage: StorageBackend,
	): Promise<ExtractionResult>;
}
