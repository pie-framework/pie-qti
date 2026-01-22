/**
 * Type definitions for browser-based IMS Content Package handling
 */

export interface VirtualFile {
	/** POSIX path relative to package root */
	path: string;
	/** File content (string for text files, Blob for binary) */
	content: string | Blob;
	/** File type classification */
	type: 'text' | 'binary';
	/** File size in bytes */
	size: number;
}

export interface OpenPackageOptions {
	/** Optional storage backend (defaults to sessionStorage) */
	storage?: import('./storage.js').StorageBackend;
	/** Maximum file size in bytes (default: 50MB) */
	maxFileSize?: number;
	/** Maximum number of files (default: 1000) */
	maxFiles?: number;
}

export interface ExtractOptions {
	maxFileSize: number;
	maxFiles: number;
}
