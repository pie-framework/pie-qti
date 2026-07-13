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
	/** Maximum compressed archive input size in bytes (default: 100MB) */
	maxCompressedSize?: number;
	/** Maximum cumulative uncompressed size in bytes (default: 250MB) */
	maxTotalUncompressedSize?: number;
	/** Maximum number of ZIP entries, including directories (default: 1000) */
	maxEntries?: number;
	/** Maximum advertised uncompressed/compressed ratio per entry (default: 200) */
	maxCompressionRatio?: number;
	/** Maximum number of safe files extracted from the package (default: 1000) */
	maxFiles?: number;
}

export interface ExtractOptions {
	maxFileSize?: number;
	maxCompressedSize?: number;
	maxTotalUncompressedSize?: number;
	maxEntries?: number;
	maxCompressionRatio?: number;
	/** Maximum number of safe files extracted from the package (default: 1000) */
	maxFiles?: number;
}
