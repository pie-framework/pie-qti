/**
 * Mock Storage Backend for Testing
 * Implements StorageBackend interface with in-memory storage
 */

import type { StorageBackend, ResourceInfo } from '@pie-qti/transform-types';
import { Readable, Writable } from 'node:stream';

/**
 * In-memory storage backend for testing
 * All operations are synchronous and stored in memory
 */
export class MockStorageBackend implements StorageBackend {
	readonly name = 'mock';
	private files = new Map<string, Buffer>();
	private initialized = false;

	/**
	 * Create a mock storage backend
	 * @param initialFiles Optional initial files to populate
	 */
	constructor(initialFiles?: Record<string, string | Buffer>) {
		if (initialFiles) {
			for (const [path, content] of Object.entries(initialFiles)) {
				this.files.set(
					path,
					typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
				);
			}
		}
	}

	async initialize(): Promise<void> {
		this.initialized = true;
	}

	async readText(filePath: string): Promise<string> {
		const buffer = this.files.get(filePath);
		if (!buffer) {
			throw new Error(`File not found: ${filePath}`);
		}
		return buffer.toString('utf-8');
	}

	async writeText(filePath: string, content: string): Promise<void> {
		this.files.set(filePath, Buffer.from(content, 'utf-8'));
	}

	async readBuffer(filePath: string): Promise<Buffer> {
		const buffer = this.files.get(filePath);
		if (!buffer) {
			throw new Error(`File not found: ${filePath}`);
		}
		return buffer;
	}

	async writeBuffer(filePath: string, content: Buffer): Promise<void> {
		this.files.set(filePath, content);
	}

	async write(filePath: string, content: string | Buffer): Promise<void> {
		if (typeof content === 'string') {
			await this.writeText(filePath, content);
		} else {
			await this.writeBuffer(filePath, content);
		}
	}

	async createReadStream(filePath: string): Promise<Readable> {
		const buffer = this.files.get(filePath);
		if (!buffer) {
			throw new Error(`File not found: ${filePath}`);
		}
		return Readable.from(buffer);
	}

	async createWriteStream(filePath: string): Promise<Writable> {
		const chunks: Buffer[] = [];
		const stream = new Writable({
			write(chunk: Buffer, _encoding, callback) {
				chunks.push(chunk);
				callback();
			},
			final: (callback) => {
				this.files.set(filePath, Buffer.concat(chunks));
				callback();
			},
		});
		return stream;
	}

	async list(pattern: string): Promise<ResourceInfo[]> {
		// Simple pattern matching - supports basic wildcards
		const regex = this.patternToRegex(pattern);
		const results: ResourceInfo[] = [];

		for (const [path, buffer] of this.files.entries()) {
			if (regex.test(path)) {
				results.push({
					uri: path,
					type: 'file',
					size: buffer.length,
					lastModified: new Date(),
				});
			}
		}

		return results;
	}

	async exists(filePath: string): Promise<boolean> {
		return this.files.has(filePath);
	}

	async listFiles(dirPath: string): Promise<string[]> {
		const normalizedDir = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
		const files: string[] = [];

		for (const path of this.files.keys()) {
			if (path.startsWith(normalizedDir)) {
				// Get the relative path from dirPath
				const relativePath = path.substring(normalizedDir.length);
				// Only include files directly in this directory (not subdirectories)
				if (!relativePath.includes('/')) {
					files.push(relativePath);
				}
			}
		}

		return files;
	}

	async delete(filePath: string): Promise<void> {
		// If it's a directory path, delete all files within it
		if (filePath.endsWith('/')) {
			const toDelete: string[] = [];
			for (const path of this.files.keys()) {
				if (path.startsWith(filePath)) {
					toDelete.push(path);
				}
			}
			for (const path of toDelete) {
				this.files.delete(path);
			}
		} else {
			this.files.delete(filePath);
		}
	}

	async copy(sourcePath: string, destPath: string): Promise<void> {
		const buffer = this.files.get(sourcePath);
		if (!buffer) {
			throw new Error(`Source file not found: ${sourcePath}`);
		}
		this.files.set(destPath, Buffer.from(buffer));
	}

	async getSize(filePath: string): Promise<number> {
		const buffer = this.files.get(filePath);
		if (!buffer) {
			throw new Error(`File not found: ${filePath}`);
		}
		return buffer.length;
	}

	async createDirectory(_dirPath: string): Promise<void> {
		// No-op for mock storage - directories are implicit
	}

	async getDirectorySize(dirPath: string): Promise<number> {
		const normalizedDir = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
		let totalSize = 0;

		for (const [path, buffer] of this.files.entries()) {
			if (path.startsWith(normalizedDir)) {
				totalSize += buffer.length;
			}
		}

		return totalSize;
	}

	// Test-specific helper methods

	/**
	 * Get a file's buffer directly (test helper)
	 */
	getFile(filePath: string): Buffer | undefined {
		return this.files.get(filePath);
	}

	/**
	 * Check if a file exists (synchronous test helper)
	 */
	hasFile(filePath: string): boolean {
		return this.files.has(filePath);
	}

	/**
	 * List all file paths (test helper)
	 */
	listAllFiles(): string[] {
		return Array.from(this.files.keys());
	}

	/**
	 * Clear all files (test helper)
	 */
	clear(): void {
		this.files.clear();
	}

	/**
	 * Get file count (test helper)
	 */
	getFileCount(): number {
		return this.files.size;
	}

	/**
	 * Check if initialized (test helper)
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Convert glob-like pattern to regex
	 */
	private patternToRegex(pattern: string): RegExp {
		// Escape special regex characters except * and ?
		const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
		// Convert glob wildcards to regex
		const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
		return new RegExp(`^${regexPattern}$`);
	}
}
