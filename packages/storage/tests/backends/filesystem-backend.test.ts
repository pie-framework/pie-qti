/**
 * Filesystem Backend Tests
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FilesystemBackend } from '../../src/backends/filesystem-backend';

describe('FilesystemBackend', () => {
	let tempDir: string;
	let backend: FilesystemBackend;

	beforeEach(async () => {
		// Create temp directory for tests
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-backend-test-'));
		backend = new FilesystemBackend({ rootDir: tempDir });
		await backend.initialize();
	});

	afterEach(async () => {
		// Clean up temp directory
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('should initialize and create root directory', async () => {
		const newTempDir = path.join(tempDir, 'subdir', 'nested');
		const newBackend = new FilesystemBackend({ rootDir: newTempDir });
		await newBackend.initialize();

		const stat = await fs.stat(newTempDir);
		expect(stat.isDirectory()).toBe(true);

		// Clean up
		await fs.rm(newTempDir, { recursive: true, force: true });
	});

	test('should write and read text', async () => {
		const filePath = 'test.txt';
		const content = 'Hello, World!';

		await backend.writeText(filePath, content);
		const read = await backend.readText(filePath);

		expect(read).toBe(content);
	});

	test('should write and read buffer', async () => {
		const filePath = 'test.bin';
		const content = Buffer.from([0x00, 0x01, 0x02, 0x03]);

		await backend.writeBuffer(filePath, content);
		const read = await backend.readBuffer(filePath);

		expect(read).toEqual(content);
	});

	test('should check file existence', async () => {
		const filePath = 'exists.txt';

		expect(await backend.exists(filePath)).toBe(false);

		await backend.writeText(filePath, 'content');

		expect(await backend.exists(filePath)).toBe(true);
	});

	test('should list files in directory', async () => {
		await backend.writeText('file1.txt', 'content1');
		await backend.writeText('file2.txt', 'content2');
		await backend.writeText('subdir/file3.txt', 'content3');

		const files = await backend.listFiles('.');
		expect(files).toContain('file1.txt');
		expect(files).toContain('file2.txt');
		expect(files).toContain('subdir'); // Directories are included

		const subdirFiles = await backend.listFiles('subdir');
		expect(subdirFiles).toContain('file3.txt');
	});

	test('should return empty array for non-existent directory', async () => {
		const files = await backend.listFiles('nonexistent');
		expect(files).toEqual([]);
	});

	test('should delete file', async () => {
		const filePath = 'delete-me.txt';
		await backend.writeText(filePath, 'content');

		expect(await backend.exists(filePath)).toBe(true);

		await backend.delete(filePath);

		expect(await backend.exists(filePath)).toBe(false);
	});

	test('should delete directory recursively', async () => {
		await backend.writeText('dir/file1.txt', 'content1');
		await backend.writeText('dir/file2.txt', 'content2');

		expect(await backend.exists('dir/file1.txt')).toBe(true);

		await backend.delete('dir');

		expect(await backend.exists('dir')).toBe(false);
		expect(await backend.exists('dir/file1.txt')).toBe(false);
	});

	test('should not throw when deleting non-existent file', async () => {
		// Should not throw an error
		await backend.delete('nonexistent.txt');
		// If we got here, it didn't throw
		expect(true).toBe(true);
	});

	test('should copy file', async () => {
		const sourcePath = 'source.txt';
		const destPath = 'dest.txt';
		const content = 'Copy me!';

		await backend.writeText(sourcePath, content);
		await backend.copy(sourcePath, destPath);

		expect(await backend.readText(destPath)).toBe(content);
	});

	test('should get file size', async () => {
		const filePath = 'sized.txt';
		const content = 'This is 30 characters long!';

		await backend.writeText(filePath, content);
		const size = await backend.getSize(filePath);

		expect(size).toBe(content.length);
	});

	test('should create directory', async () => {
		const dirPath = 'nested/deep/directory';

		await backend.createDirectory(dirPath);

		expect(await backend.exists(dirPath)).toBe(true);
	});

	test('should get directory size', async () => {
		await backend.writeText('dir/file1.txt', 'Hello');
		await backend.writeText('dir/file2.txt', 'World');
		await backend.writeText('dir/subdir/file3.txt', '!');

		const size = await backend.getDirectorySize('dir');

		// Total size should be 5 + 5 + 1 = 11 bytes
		expect(size).toBe(11);
	});

	test('should return 0 for non-existent directory size', async () => {
		const size = await backend.getDirectorySize('nonexistent');
		expect(size).toBe(0);
	});

	test('should enforce path security by default', async () => {
		const maliciousPath = '../../../etc/passwd';

		await expect(backend.writeText(maliciousPath, 'hacked')).rejects.toThrow(
			'Path security violation',
		);
	});

	test('should allow disabling path security', async () => {
		const insecureBackend = new FilesystemBackend({
			rootDir: tempDir,
			enforceSecurity: false,
		});
		await insecureBackend.initialize();

		// This should work without path security
		const outsidePath = '../test-outside.txt';
		await insecureBackend.writeText(outsidePath, 'content');

		// Verify file was created outside root
		const resolvedPath = path.resolve(tempDir, outsidePath);
		const content = await fs.readFile(resolvedPath, 'utf-8');
		expect(content).toBe('content');

		// Clean up
		await fs.unlink(resolvedPath);
	});

	test('should get absolute filesystem path', async () => {
		const filePath = 'test.txt';
		const absolutePath = backend.getAbsolutePath(filePath);

		expect(path.isAbsolute(absolutePath)).toBe(true);
		expect(absolutePath).toContain(tempDir);
		expect(absolutePath).toContain('test.txt');
	});

	test('should handle nested paths correctly', async () => {
		const nestedPath = 'a/b/c/d/file.txt';
		const content = 'Nested content';

		await backend.writeText(nestedPath, content);

		expect(await backend.exists(nestedPath)).toBe(true);
		expect(await backend.readText(nestedPath)).toBe(content);
	});
});
