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

/**
 * Storage-aware ZIP extractor
 * Extracts ZIP files to temp directory, then copies to storage backend
 */
export class StorageZipExtractor implements ZipExtractor {
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
		const zipBuffer = await storage.readBuffer(zipPath);

		// Step 2: Create temp directory for extraction
		const tempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), 'pie-qti-extract-'),
		);

		try {
			// Step 3: Extract to temp directory
			const zip = new AdmZip(zipBuffer);
			zip.extractAllTo(tempDir, true);

			// Step 4: Copy extracted files to storage
			const files = await this.copyToStorage(tempDir, targetPath, storage);

			return {
				success: true,
				files,
				totalFiles: files.length,
				totalSize: await storage.getDirectorySize(targetPath),
			};
		} finally {
			// Step 5: Clean up temp directory
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	}

	/**
	 * Recursively copy files from temp directory to storage
	 */
	private async copyToStorage(
		sourceDir: string,
		targetDir: string,
		storage: StorageBackend,
	): Promise<string[]> {
		const files: string[] = [];

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
					// Create directory in storage
					await storage.createDirectory(targetPath);
					// Recursively copy directory contents
					await copyDirectory(sourcePath, targetPath);
				} else if (entry.isFile()) {
					// Read file from temp
					const content = await fs.readFile(sourcePath);
					// Write to storage
					await storage.writeBuffer(targetPath, content);
					// Track file
					files.push(targetPath);
				}
			}
		}

		await copyDirectory(sourceDir, targetDir);
		return files;
	}
}
