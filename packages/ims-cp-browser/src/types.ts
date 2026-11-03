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
	/**
	 * Opt in to saving the (text-only) package snapshot to `storage` after opening.
	 * Off by default: `save()` serializes into the backend's quota (sessionStorage is
	 * typically ~5MB) and binary files are not persisted, so a restored package is
	 * missing its images/media.
	 */
	persist?: boolean;
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
