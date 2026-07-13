/**
 * ZIP Extractor with Storage Abstraction
 * Extracts ZIP files and copies contents to storage backend
 */

import AdmZip from 'adm-zip';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
	ZipExtractor,
	StorageBackend,
	ExtractionResult,
} from '@pie-qti/transform-types';

export interface StorageZipExtractorOptions {
	/** Maximum compressed ZIP input size in bytes (default: 100MB). */
	maxCompressedSize?: number;
	/** Maximum cumulative uncompressed size in bytes (default: 250MB). */
	maxTotalUncompressedSize?: number;
	/** Maximum number of ZIP entries, including directories (default: 1000). */
	maxEntries?: number;
	/** Maximum advertised uncompressed/compressed ratio per file (default: 200). */
	maxCompressionRatio?: number;
}

type ResolvedStorageZipExtractorOptions = Required<StorageZipExtractorOptions>;

const DEFAULT_ARCHIVE_LIMITS: ResolvedStorageZipExtractorOptions = {
	maxCompressedSize: 100 * 1024 * 1024,
	maxTotalUncompressedSize: 250 * 1024 * 1024,
	maxEntries: 1000,
	maxCompressionRatio: 200,
};

function resolveOptions(options: StorageZipExtractorOptions): ResolvedStorageZipExtractorOptions {
	return {
		maxCompressedSize: resolveLimit(
			options.maxCompressedSize,
			DEFAULT_ARCHIVE_LIMITS.maxCompressedSize,
			'maxCompressedSize',
		),
		maxTotalUncompressedSize: resolveLimit(
			options.maxTotalUncompressedSize,
			DEFAULT_ARCHIVE_LIMITS.maxTotalUncompressedSize,
			'maxTotalUncompressedSize',
		),
		maxEntries: resolveLimit(
			options.maxEntries,
			DEFAULT_ARCHIVE_LIMITS.maxEntries,
			'maxEntries',
			true,
		),
		maxCompressionRatio: resolveLimit(
			options.maxCompressionRatio,
			DEFAULT_ARCHIVE_LIMITS.maxCompressionRatio,
			'maxCompressionRatio',
		),
	};
}

function resolveLimit(
	value: number | undefined,
	fallback: number,
	name: string,
	requireInteger = false,
): number {
	const resolved = value ?? fallback;
	if (
		resolved !== Number.POSITIVE_INFINITY &&
		(!Number.isFinite(resolved) || resolved < 0 || (requireInteger && !Number.isInteger(resolved)))
	) {
		throw new Error(`${name} must be a non-negative ${requireInteger ? 'integer' : 'number'}`);
	}
	return resolved;
}

function exceedsCompressionRatio(uncompressed: number, compressed: number, maximum: number): boolean {
	if (uncompressed === 0 || maximum === Number.POSITIVE_INFINITY) return false;
	if (compressed <= 0) return true;
	return uncompressed / compressed > maximum;
}

function assertArchiveMetadata(
	entries: AdmZip.IZipEntry[],
	limits: ResolvedStorageZipExtractorOptions,
): void {
	if (entries.length > limits.maxEntries) {
		throw new Error(`Package exceeds maximum entry count (${limits.maxEntries})`);
	}

	let advertisedTotalSize = 0;
	for (const entry of entries) {
		if (entry.isDirectory) continue;

		const uncompressedSize = entry.header.size;
		const compressedSize = entry.header.compressedSize;
		if (!Number.isSafeInteger(uncompressedSize) || uncompressedSize < 0) {
			throw new Error(`Zip entry has an invalid uncompressed size: ${entry.entryName}`);
		}
		if (!Number.isSafeInteger(compressedSize) || compressedSize < 0) {
			throw new Error(`Zip entry has an invalid compressed size: ${entry.entryName}`);
		}
		advertisedTotalSize += uncompressedSize;
		if (advertisedTotalSize > limits.maxTotalUncompressedSize) {
			throw new Error(
				`Package exceeds maximum total uncompressed size (${limits.maxTotalUncompressedSize} bytes)`,
			);
		}
		if (exceedsCompressionRatio(uncompressedSize, compressedSize, limits.maxCompressionRatio)) {
			throw new Error(
				`File ${entry.entryName} exceeds maximum compression ratio (${limits.maxCompressionRatio})`,
			);
		}
	}
}

/**
 * Storage-aware ZIP extractor
 * Extracts ZIP files to temp directory, then copies to storage backend
 */
export class StorageZipExtractor implements ZipExtractor {
	private readonly limits: ResolvedStorageZipExtractorOptions;

	constructor(options: StorageZipExtractorOptions = {}) {
		this.limits = resolveOptions(options);
	}

	/**
	 * Extract ZIP file to storage backend
	 *
	 * @param zipPath Path to ZIP file in storage
	 * @param targetPath Target path in storage to extract to
	 * @param storage Storage backend to use
	 * @returns Extraction result with file list and statistics
	 */
	async extract(
		zipPath: string,
		targetPath: string,
		storage: StorageBackend,
	): Promise<ExtractionResult> {
		// Step 1: Read ZIP from storage
		if (storage.getMetadata) {
			const metadata = await storage.getMetadata(zipPath);
			if (metadata.size > this.limits.maxCompressedSize) {
				throw new Error(
					`Package exceeds maximum compressed size (${this.limits.maxCompressedSize} bytes)`,
				);
			}
		}
		const zipBuffer = await storage.readBuffer(zipPath);
		if (zipBuffer.byteLength > this.limits.maxCompressedSize) {
			throw new Error(
				`Package exceeds maximum compressed size (${this.limits.maxCompressedSize} bytes)`,
			);
		}

		const zip = new AdmZip(zipBuffer);
		const entries = zip.getEntries();
		assertArchiveMetadata(entries, this.limits);

		// Step 2: Create temp directory for extraction
		const tempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), 'pie-qti-extract-'),
		);

		try {
			// Step 3: Extract entries incrementally so an incorrect central-directory
			// size cannot expand the entire archive before the actual-byte check runs.
			await this.extractToTemp(zip, entries, tempDir);

			// Step 4: Copy extracted files to storage
			const { files, totalSize } = await this.copyToStorage(
				tempDir,
				targetPath,
				storage,
				this.limits.maxTotalUncompressedSize,
			);

			return {
				success: true,
				files,
				totalFiles: files.length,
				totalSize,
			};
		} finally {
			// Step 5: Clean up temp directory
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	}

	private async extractToTemp(
		zip: AdmZip,
		entries: AdmZip.IZipEntry[],
		tempDir: string,
	): Promise<void> {
		let actualTotalSize = 0;
		for (const entry of entries) {
			const outputPath = path.resolve(tempDir, entry.entryName);
			const relative = path.relative(tempDir, outputPath);
			if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
				throw new Error(`Zip entry path escapes extraction directory: ${entry.entryName}`);
			}
			if (entry.isDirectory) {
				// adm-zip treats directory extraction as recursive. Calling extractEntryTo
				// for every authored directory would therefore extract descendants once per
				// ancestor and bypass the intended one-entry/one-write accounting model.
				await fs.mkdir(outputPath, { recursive: true });
				continue;
			}

			const extracted = zip.extractEntryTo(entry, tempDir, true, true);
			if (!extracted) {
				throw new Error(`Failed to extract ZIP entry: ${entry.entryName}`);
			}

			const fileStat = await fs.stat(outputPath);
			actualTotalSize += fileStat.size;
			if (actualTotalSize > this.limits.maxTotalUncompressedSize) {
				throw new Error(
					`Package exceeds maximum total uncompressed size (${this.limits.maxTotalUncompressedSize} bytes)`,
				);
			}
		}
	}

	/**
	 * Recursively copy files from temp directory to storage
	 */
	private async copyToStorage(
		sourceDir: string,
		targetDir: string,
		storage: StorageBackend,
		maxTotalUncompressedSize: number,
	): Promise<{ files: string[]; totalSize: number }> {
		const files: string[] = [];
		let totalSize = 0;

		async function copyDirectory(
			currentSource: string,
			currentTarget: string,
		): Promise<void> {
			const entries = await fs.readdir(currentSource, {
				withFileTypes: true,
			});

			for (const entry of entries) {
				const sourcePath = path.join(currentSource, entry.name);
				const targetPath = `${currentTarget}/${entry.name}`;

				if (entry.isDirectory()) {
					// Create directory in storage if supported
					if (storage.createDirectory) {
						await storage.createDirectory(targetPath);
					}
					// Recursively copy directory contents
					await copyDirectory(sourcePath, targetPath);
				} else if (entry.isFile()) {
					const fileStat = await fs.stat(sourcePath);
					if (totalSize + fileStat.size > maxTotalUncompressedSize) {
						throw new Error(
							`Package exceeds maximum total uncompressed size (${maxTotalUncompressedSize} bytes)`,
						);
					}
					// Read file from temp
					const content = await fs.readFile(sourcePath);
					// Write to storage
					await storage.writeBuffer(targetPath, content);
					// Track file
					files.push(targetPath);
					totalSize += content.byteLength;
				}
			}
		}

		await copyDirectory(sourceDir, targetDir);
		return { files, totalSize };
	}
}
