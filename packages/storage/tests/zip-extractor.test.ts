/**
 * ZIP Extractor Tests
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import AdmZip from 'adm-zip';
import { createRequire } from 'node:module';
import { FilesystemBackend } from '../src/backends/filesystem-backend';
import { StorageZipExtractor } from '../src/zip-extractor';

describe('StorageZipExtractor', () => {
	let tempDir: string;
	let backend: FilesystemBackend;
	let extractor: StorageZipExtractor;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), 'zip-extractor-test-'),
		);
		backend = new FilesystemBackend({ rootDir: tempDir });
		await backend.initialize();
		extractor = new StorageZipExtractor();
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	/**
	 * Helper to create a test ZIP file
	 */
	async function createTestZip(
		zipPath: string,
		files: Record<string, string>,
	): Promise<void> {
		const zip = new AdmZip();

		for (const [filePath, content] of Object.entries(files)) {
			zip.addFile(filePath, Buffer.from(content, 'utf-8'));
		}

		const zipBuffer = zip.toBuffer();
		await backend.writeBuffer(zipPath, zipBuffer);
	}

	test('should extract simple ZIP file', async () => {
		const zipPath = 'test.zip';
		const targetPath = 'extracted';

		// Create test ZIP
		await createTestZip(zipPath, {
			'file1.txt': 'Content 1',
			'file2.txt': 'Content 2',
		});

		// Extract
		const result = await extractor.extract(zipPath, targetPath, backend);

		expect(result.success).toBe(true);
		expect(result.totalFiles).toBe(2);
		expect(result.files).toContain('extracted/file1.txt');
		expect(result.files).toContain('extracted/file2.txt');

		// Verify extracted files
		expect(await backend.readText('extracted/file1.txt')).toBe('Content 1');
		expect(await backend.readText('extracted/file2.txt')).toBe('Content 2');
	});

	test('should extract nested directories', async () => {
		const zipPath = 'test.zip';
		const targetPath = 'extracted';

		await createTestZip(zipPath, {
			'root.txt': 'Root file',
			'dir1/file1.txt': 'File in dir1',
			'dir1/dir2/file2.txt': 'File in nested dir',
		});

		const result = await extractor.extract(zipPath, targetPath, backend);

		expect(result.success).toBe(true);
		expect(result.totalFiles).toBe(3);

		expect(await backend.readText('extracted/root.txt')).toBe('Root file');
		expect(await backend.readText('extracted/dir1/file1.txt')).toBe(
			'File in dir1',
		);
		expect(await backend.readText('extracted/dir1/dir2/file2.txt')).toBe(
			'File in nested dir',
		);
	});

	test('does not ask adm-zip to recursively extract directory entries', async () => {
		const zipPath = 'explicit-directories.zip';
		const zip = new AdmZip();
		zip.addFile('one/', Buffer.alloc(0));
		zip.addFile('one/two/', Buffer.alloc(0));
		zip.addFile('one/two/file.txt', Buffer.from('once'));
		await backend.writeBuffer(zipPath, zip.toBuffer());

		// AdmZip defines extraction methods on each returned object rather than on
		// its prototype. Count its synchronous file opens instead: asking it
		// to extract either explicit directory would recursively write the child
		// file before the normal file-entry pass and make this count greater than 1.
		type OpenSync = typeof import('node:fs').openSync;
		const mutableFs = createRequire(import.meta.url)('node:fs') as { openSync: OpenSync };
		const originalOpenSync = mutableFs.openSync;
		const extractedFiles: string[] = [];
		mutableFs.openSync = ((...args: Parameters<OpenSync>) => {
			const outputPath = String(args[0]);
			if (outputPath.endsWith(path.join('one', 'two', 'file.txt'))) {
				extractedFiles.push(outputPath);
			}
			return Reflect.apply(originalOpenSync, mutableFs, args);
		}) as OpenSync;

		try {
			const result = await extractor.extract(zipPath, 'explicit-output', backend);
			expect(result.totalFiles).toBe(1);
			expect(extractedFiles).toHaveLength(1);
			expect(await backend.readText('explicit-output/one/two/file.txt')).toBe('once');
		} finally {
			mutableFs.openSync = originalOpenSync;
		}
	});

	test('should handle binary files', async () => {
		const zipPath = 'test.zip';
		const targetPath = 'extracted';

		const zip = new AdmZip();
		const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
		zip.addFile('binary.bin', binaryContent);

		await backend.writeBuffer(zipPath, zip.toBuffer());

		const result = await extractor.extract(zipPath, targetPath, backend);

		expect(result.success).toBe(true);
		expect(result.totalFiles).toBe(1);

		const extractedContent = await backend.readBuffer('extracted/binary.bin');
		expect(extractedContent).toEqual(binaryContent);
	});

	test('should calculate total size', async () => {
		const zipPath = 'test.zip';
		const targetPath = 'extracted';

		await createTestZip(zipPath, {
			'file1.txt': 'Hello', // 5 bytes
			'file2.txt': 'World', // 5 bytes
		});

		const result = await extractor.extract(zipPath, targetPath, backend);

		expect(result.success).toBe(true);
		expect(result.totalSize).toBe(10);
	});

	test('should extract empty ZIP', async () => {
		const zipPath = 'empty.zip';
		const targetPath = 'extracted';

		// Create empty ZIP
		const zip = new AdmZip();
		await backend.writeBuffer(zipPath, zip.toBuffer());

		const result = await extractor.extract(zipPath, targetPath, backend);

		expect(result.success).toBe(true);
		expect(result.totalFiles).toBe(0);
		expect(result.files).toEqual([]);
	});

	test('should handle large number of files', async () => {
		const zipPath = 'large.zip';
		const targetPath = 'extracted';

		const files: Record<string, string> = {};
		for (let i = 0; i < 100; i++) {
			files[`file${i}.txt`] = `Content ${i}`;
		}

		await createTestZip(zipPath, files);

		const result = await extractor.extract(zipPath, targetPath, backend);

		expect(result.success).toBe(true);
		expect(result.totalFiles).toBe(100);

		// Spot check a few files
		expect(await backend.readText('extracted/file0.txt')).toBe('Content 0');
		expect(await backend.readText('extracted/file50.txt')).toBe('Content 50');
		expect(await backend.readText('extracted/file99.txt')).toBe('Content 99');
	});

	test('should reject compressed input that exceeds the configured byte limit', async () => {
		const zipPath = 'compressed-limit.zip';
		await createTestZip(zipPath, { 'file.txt': 'content' });
		const compressedSize = (await backend.readBuffer(zipPath)).byteLength;
		const limitedExtractor = new StorageZipExtractor({
			maxCompressedSize: compressedSize - 1,
		});

		await expect(
			limitedExtractor.extract(zipPath, 'compressed-limit-output', backend),
		).rejects.toThrow('maximum compressed size');
	});

	test('should reject archives that exceed cumulative size or entry count limits', async () => {
		const zipPath = 'cumulative-limits.zip';
		await createTestZip(zipPath, {
			'one.txt': '12345',
			'two.txt': '67890',
		});

		await expect(
			new StorageZipExtractor({ maxEntries: 1 }).extract(zipPath, 'entry-output', backend),
		).rejects.toThrow('maximum entry count');
		await expect(
			new StorageZipExtractor({ maxTotalUncompressedSize: 9 }).extract(
				zipPath,
				'size-output',
				backend,
			),
		).rejects.toThrow('maximum total uncompressed size');
	});

	test('should reject entries that exceed the configured compression ratio', async () => {
		const zipPath = 'ratio-limit.zip';
		await createTestZip(zipPath, {
			'repetitive.txt': 'A'.repeat(16 * 1024),
		});

		await expect(
			new StorageZipExtractor({ maxCompressionRatio: 10 }).extract(
				zipPath,
				'ratio-output',
				backend,
			),
		).rejects.toThrow('maximum compression ratio');
	});
});
