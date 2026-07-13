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
	private realRootDir: string | undefined;

	constructor(options: FilesystemBackendOptions) {
		this.rootDir = path.resolve(options.rootDir);
		this.enforceSecurity = options.enforceSecurity ?? true;
	}

	async initialize(): Promise<void> {
		// Ensure root directory exists
		await fs.mkdir(this.rootDir, { recursive: true });
		if (this.enforceSecurity) {
			this.realRootDir = await fs.realpath(this.rootDir);
		}
	}

	/**
	 * Resolve path relative to root directory
	 * Throws if path attempts directory traversal (when security enforced)
	 */
	private resolvePath(filePath: string): string {
		const resolved = path.resolve(this.rootDir, filePath);

		// Security check: ensure resolved path is within root directory
		const relative = path.relative(this.rootDir, resolved);
		if (
			this.enforceSecurity &&
			(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
		) {
			throw new Error(
				`Path security violation: ${filePath} resolves outside root directory`,
			);
		}

		return resolved;
	}

	/**
	 * Resolve a path for filesystem access and verify that existing path
	 * components do not escape the configured root through a symbolic link.
	 *
	 * The lexical check in resolvePath catches `..` traversal. This canonical
	 * check is also needed for paths such as `root/link/file`, where `link`
	 * already points outside `root`.
	 */
	private async resolvePathForAccess(filePath: string): Promise<string> {
		const resolved = this.resolvePath(filePath);
		if (!this.enforceSecurity) return resolved;

		let realRoot: string;
		try {
			realRoot = this.realRootDir ?? (await fs.realpath(this.rootDir));
			this.realRootDir ??= realRoot;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

			// A missing root cannot contain a pre-existing symlink. Preserve the
			// existing behavior that allows initialize()/writes to create it.
			try {
				await fs.lstat(this.rootDir);
			} catch (lstatError) {
				if ((lstatError as NodeJS.ErrnoException).code === 'ENOENT') return resolved;
				throw lstatError;
			}

			throw new Error(
				`Path security violation: storage root contains an unresolved symbolic link`,
			);
		}

		let existingPath = resolved;
		while (true) {
			try {
				await fs.lstat(existingPath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

				const parentPath = path.dirname(existingPath);
				if (parentPath === existingPath) throw error;
				existingPath = parentPath;
				continue;
			}

			let realExistingPath: string;
			try {
				realExistingPath = await fs.realpath(existingPath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
				throw new Error(
					`Path security violation: ${filePath} contains an unresolved symbolic link`,
				);
			}

			const relative = path.relative(realRoot, realExistingPath);
			if (
				relative === '..' ||
				relative.startsWith(`..${path.sep}`) ||
				path.isAbsolute(relative)
			) {
				throw new Error(
					`Path security violation: ${filePath} resolves outside root directory through a symbolic link`,
				);
			}

			return resolved;
		}
	}

	async readText(filePath: string): Promise<string> {
		const resolved = await this.resolvePathForAccess(filePath);
		return fs.readFile(resolved, 'utf-8');
	}

	async writeText(filePath: string, content: string): Promise<void> {
		const resolved = await this.resolvePathForAccess(filePath);
		await fs.mkdir(path.dirname(resolved), { recursive: true });
		await fs.writeFile(resolved, content, 'utf-8');
	}

	async readBuffer(filePath: string): Promise<Buffer> {
		const resolved = await this.resolvePathForAccess(filePath);
		return fs.readFile(resolved);
	}

	async writeBuffer(filePath: string, content: Buffer): Promise<void> {
		const resolved = await this.resolvePathForAccess(filePath);
		await fs.mkdir(path.dirname(resolved), { recursive: true });
		await fs.writeFile(resolved, content);
	}

	async write(filePath: string, content: string | Buffer): Promise<void> {
		if (typeof content === 'string') {
			await this.writeText(filePath, content);
		} else {
			await this.writeBuffer(filePath, content);
		}
	}

	async createReadStream(filePath: string): Promise<import('stream').Readable> {
		const { createReadStream } = await import('node:fs');
		const resolved = await this.resolvePathForAccess(filePath);
		return createReadStream(resolved);
	}

	async createWriteStream(filePath: string): Promise<import('stream').Writable> {
		const { createWriteStream } = await import('node:fs');
		const resolved = await this.resolvePathForAccess(filePath);
		await fs.mkdir(path.dirname(resolved), { recursive: true });
		return createWriteStream(resolved);
	}

	async list(pattern: string): Promise<import('@pie-qti/transform-types').ResourceInfo[]> {
		// Simple glob-like pattern matching (basic implementation)
		const dirPath = pattern.includes('*') ? path.dirname(pattern) : pattern;
		const resolved = await this.resolvePathForAccess(dirPath);

		try {
			const entries = await fs.readdir(resolved, { withFileTypes: true });
			const results: import('@pie-qti/transform-types').ResourceInfo[] = [];

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);
				const stat = await fs.stat(await this.resolvePathForAccess(fullPath));

				results.push({
					uri: fullPath,
					type: entry.isDirectory() ? 'directory' : 'file',
					size: entry.isFile() ? stat.size : undefined,
					lastModified: stat.mtime,
				});
			}

			return results;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return [];
			}
			throw error;
		}
	}

	async exists(filePath: string): Promise<boolean> {
		try {
			const resolved = await this.resolvePathForAccess(filePath);
			await fs.access(resolved);
			return true;
		} catch {
			return false;
		}
	}

	async listFiles(dirPath: string): Promise<string[]> {
		const resolved = await this.resolvePathForAccess(dirPath);
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
		const resolved = await this.resolvePathForAccess(filePath);
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
		const resolvedSource = await this.resolvePathForAccess(sourcePath);
		const resolvedDest = await this.resolvePathForAccess(destPath);
		await fs.mkdir(path.dirname(resolvedDest), { recursive: true });
		await fs.copyFile(resolvedSource, resolvedDest);
	}

	async getSize(filePath: string): Promise<number> {
		const resolved = await this.resolvePathForAccess(filePath);
		const stat = await fs.stat(resolved);
		return stat.size;
	}

	async createDirectory(dirPath: string): Promise<void> {
		const resolved = await this.resolvePathForAccess(dirPath);
		await fs.mkdir(resolved, { recursive: true });
	}

	async getDirectorySize(dirPath: string): Promise<number> {
		const resolved = await this.resolvePathForAccess(dirPath);

		const calculateSize = async (currentPath: string): Promise<number> => {
			await this.resolvePathForAccess(path.relative(this.rootDir, currentPath));
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
		};

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
	 * Read multiple files in batch
	 * More efficient than reading files sequentially
	 */
	async readBatch(uris: string[]): Promise<Map<string, string | Buffer>> {
		const results = new Map<string, string | Buffer>();

		// Read all files in parallel
		const readPromises = uris.map(async (uri) => {
			try {
				const buffer = await this.readBuffer(uri);
				return { uri, buffer };
			} catch (error) {
				// Skip files that don't exist or can't be read
				console.warn(`Failed to read ${uri}:`, error);
				return null;
			}
		});

		const readResults = await Promise.all(readPromises);

		for (const result of readResults) {
			if (result) {
				results.set(result.uri, result.buffer);
			}
		}

		return results;
	}

	/**
	 * Write multiple files in batch
	 * More efficient than writing files sequentially
	 */
	async writeBatch(
		writes: Array<{ uri: string; content: string | Buffer; options?: any }>
	): Promise<void> {
		// Ensure all parent directories exist
		const dirPaths = new Set<string>();
		for (const { uri } of writes) {
			const resolved = await this.resolvePathForAccess(uri);
			dirPaths.add(path.dirname(resolved));
		}

		// Create all directories in parallel
		await Promise.all(
			Array.from(dirPaths).map(dir => fs.mkdir(dir, { recursive: true }))
		);

		// Write all files in parallel
		const writePromises = writes.map(({ uri, content }) =>
			this.write(uri, content)
		);

		await Promise.all(writePromises);
	}

	/**
	 * Get absolute filesystem path (filesystem-specific feature)
	 * This is not part of StorageBackend interface but useful for filesystem backend
	 */
	getAbsolutePath(filePath: string): string {
		return this.resolvePath(filePath);
	}
}
