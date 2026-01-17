/**
 * Filesystem Storage Backend
 * Default storage backend using Node.js fs module
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StorageBackend } from '@pie-qti/transform-types';

export interface FilesystemBackendOptions {
	/**
	 * Root directory for storage
	 * All paths will be relative to this directory
	 */
	rootDir: string;

	/**
	 * Enforce path security (prevent directory traversal)
	 * @default true
	 */
	enforceSecurity?: boolean;
}

/**
 * Filesystem storage backend
 * Stores files in the local filesystem
 */
export class FilesystemBackend implements StorageBackend {
	readonly name = 'filesystem';
	private rootDir: string;
	private enforceSecurity: boolean;

	constructor(options: FilesystemBackendOptions) {
		this.rootDir = path.resolve(options.rootDir);
		this.enforceSecurity = options.enforceSecurity ?? true;
	}

	async initialize(): Promise<void> {
		// Ensure root directory exists
		await fs.mkdir(this.rootDir, { recursive: true });
	}

	/**
	 * Resolve path relative to root directory
	 * Throws if path attempts directory traversal (when security enforced)
	 */
	private resolvePath(filePath: string): string {
		const resolved = path.resolve(this.rootDir, filePath);

		// Security check: ensure resolved path is within root directory
		if (this.enforceSecurity && !resolved.startsWith(this.rootDir)) {
			throw new Error(
				`Path security violation: ${filePath} resolves outside root directory`,
			);
		}

		return resolved;
	}

	async readText(filePath: string): Promise<string> {
		const resolved = this.resolvePath(filePath);
		return fs.readFile(resolved, 'utf-8');
	}

	async writeText(filePath: string, content: string): Promise<void> {
		const resolved = this.resolvePath(filePath);
		await fs.mkdir(path.dirname(resolved), { recursive: true });
		await fs.writeFile(resolved, content, 'utf-8');
	}

	async readBuffer(filePath: string): Promise<Buffer> {
		const resolved = this.resolvePath(filePath);
		return fs.readFile(resolved);
	}

	async writeBuffer(filePath: string, content: Buffer): Promise<void> {
		const resolved = this.resolvePath(filePath);
		await fs.mkdir(path.dirname(resolved), { recursive: true });
		await fs.writeFile(resolved, content);
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			const resolved = this.resolvePath(filePath);
			await fs.access(resolved);
			return true;
		} catch {
			return false;
		}
	}

	async listFiles(dirPath: string): Promise<string[]> {
		const resolved = this.resolvePath(dirPath);
		try {
			const entries = await fs.readdir(resolved, { withFileTypes: true });
			// Return all entries (files and directories)
			// This matches the semantic meaning of "list files" in storage context
			// where we often need to list both files and subdirectories
			return entries.map((entry) => entry.name);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return [];
			}
			throw error;
		}
	}

	async delete(filePath: string): Promise<void> {
		const resolved = this.resolvePath(filePath);
		try {
			const stat = await fs.stat(resolved);
			if (stat.isDirectory()) {
				await fs.rm(resolved, { recursive: true, force: true });
			} else {
				await fs.unlink(resolved);
			}
		} catch (error) {
			// Ignore if file doesn't exist
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}
	}

	async copy(sourcePath: string, destPath: string): Promise<void> {
		const resolvedSource = this.resolvePath(sourcePath);
		const resolvedDest = this.resolvePath(destPath);
		await fs.mkdir(path.dirname(resolvedDest), { recursive: true });
		await fs.copyFile(resolvedSource, resolvedDest);
	}

	async getSize(filePath: string): Promise<number> {
		const resolved = this.resolvePath(filePath);
		const stat = await fs.stat(resolved);
		return stat.size;
	}

	async createDirectory(dirPath: string): Promise<void> {
		const resolved = this.resolvePath(dirPath);
		await fs.mkdir(resolved, { recursive: true });
	}

	async getDirectorySize(dirPath: string): Promise<number> {
		const resolved = this.resolvePath(dirPath);

		async function calculateSize(currentPath: string): Promise<number> {
			const stat = await fs.stat(currentPath);

			if (stat.isFile()) {
				return stat.size;
			}

			if (stat.isDirectory()) {
				const entries = await fs.readdir(currentPath, {
					withFileTypes: true,
				});
				const sizes = await Promise.all(
					entries.map((entry) =>
						calculateSize(path.join(currentPath, entry.name)),
					),
				);
				return sizes.reduce((total, size) => total + size, 0);
			}

			return 0;
		}

		try {
			return await calculateSize(resolved);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return 0;
			}
			throw error;
		}
	}

	/**
	 * Get absolute filesystem path (filesystem-specific feature)
	 * This is not part of StorageBackend interface but useful for filesystem backend
	 */
	getAbsolutePath(filePath: string): string {
		return this.resolvePath(filePath);
	}
}
