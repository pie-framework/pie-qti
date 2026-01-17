/**
 * Storage abstraction layer interfaces
 * Provides pluggable storage backends (filesystem, S3, database, etc.)
 */

/**
 * Core storage backend interface
 * Implementations provide different storage mechanisms (filesystem, S3, database)
 */
export interface StorageBackend {
	/** Unique name identifying this storage backend */
	readonly name: string;

	/** Initialize the storage backend (create directories, connect to services, etc.) */
	initialize(): Promise<void>;

	// Text operations
	/** Read a file as UTF-8 text */
	readText(path: string): Promise<string>;

	/** Write UTF-8 text to a file */
	writeText(path: string, content: string): Promise<void>;

	// Binary operations
	/** Read a file as a binary Buffer */
	readBuffer(path: string): Promise<Buffer>;

	/** Write binary Buffer to a file */
	writeBuffer(path: string, content: Buffer): Promise<void>;

	// File operations
	/** Check if a file or directory exists */
	exists(path: string): Promise<boolean>;

	/** List all files in a directory (not recursive) */
	listFiles(path: string): Promise<string[]>;

	/** Delete a file or empty directory */
	delete(path: string): Promise<void>;

	/** Copy a file from source to destination */
	copy(sourcePath: string, destPath: string): Promise<void>;

	// Metadata
	/** Get size of a file in bytes */
	getSize(path: string): Promise<number>;

	/** Create a directory (and parent directories if needed) */
	createDirectory(path: string): Promise<void>;

	/** Get total size of all files in a directory recursively */
	getDirectorySize(path: string): Promise<number>;

	// Optional: URL generation for direct access (S3/CDN)
	/** Generate a URL for direct access to a file (optional, for S3/CDN backends) */
	getUrl?(path: string): Promise<string>;
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
	status: 'uploading' | 'extracting' | 'ready' | 'transforming' | 'completed' | 'error';
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
