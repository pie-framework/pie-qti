import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import {
	extractZipToDirSafe,
	extractZipToDirStream,
	loadResolvedManifest,
	openContentPackage,
} from '../src/index.js';

function crc32(content: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of content) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) {
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function createZip(entries: Record<string, string>): Buffer {
	const localParts: Buffer[] = [];
	const centralParts: Buffer[] = [];
	let localOffset = 0;

	for (const [name, value] of Object.entries(entries)) {
		const nameBytes = Buffer.from(name);
		const content = Buffer.from(value);
		const compressed = deflateRawSync(content);
		const checksum = crc32(content);

		const localHeader = Buffer.alloc(30);
		localHeader.writeUInt32LE(0x04034b50, 0);
		localHeader.writeUInt16LE(20, 4);
		localHeader.writeUInt16LE(8, 8);
		localHeader.writeUInt32LE(checksum, 14);
		localHeader.writeUInt32LE(compressed.length, 18);
		localHeader.writeUInt32LE(content.length, 22);
		localHeader.writeUInt16LE(nameBytes.length, 26);
		localParts.push(localHeader, nameBytes, compressed);

		const centralHeader = Buffer.alloc(46);
		centralHeader.writeUInt32LE(0x02014b50, 0);
		centralHeader.writeUInt16LE(20, 4);
		centralHeader.writeUInt16LE(20, 6);
		centralHeader.writeUInt16LE(8, 10);
		centralHeader.writeUInt32LE(checksum, 16);
		centralHeader.writeUInt32LE(compressed.length, 20);
		centralHeader.writeUInt32LE(content.length, 24);
		centralHeader.writeUInt16LE(nameBytes.length, 28);
		centralHeader.writeUInt32LE(localOffset, 42);
		centralParts.push(centralHeader, nameBytes);

		localOffset += localHeader.length + nameBytes.length + compressed.length;
	}

	const centralDirectory = Buffer.concat(centralParts);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(centralParts.length / 2, 8);
	end.writeUInt16LE(centralParts.length / 2, 10);
	end.writeUInt32LE(centralDirectory.length, 12);
	end.writeUInt32LE(localOffset, 16);

	return Buffer.concat([...localParts, centralDirectory, end]);
}

async function createSamplePackage(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-'));
	const nestedDir = path.join(root, 'nested');
	await mkdir(nestedDir, { recursive: true });

	const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="MANIFEST-001">
  <organizations/>
  <resources>
    <resource identifier="ITEM-1" type="imsqti_item_xmlv2p2" href="item1.xml">
      <file href="item1.xml"/>
    </resource>
  </resources>
</manifest>`;

	await writeFile(path.join(nestedDir, 'imsmanifest.xml'), manifest, 'utf-8');
	await writeFile(path.join(nestedDir, 'item1.xml'), '<assessmentItem/>', 'utf-8');
	return root;
}

describe('ims-cp-node', () => {
	test('loadResolvedManifest resolves resource hrefs relative to manifest location', async () => {
		const root = await createSamplePackage();

		const resolved = await loadResolvedManifest(root);
		expect(resolved.manifestPath.endsWith('nested/imsmanifest.xml')).toBe(true);
		expect(resolved.items.length).toBe(1);
		expect(resolved.items[0].hrefResolved).toBe('nested/item1.xml');
		expect(resolved.items[0].filesResolved).toEqual(['nested/item1.xml']);
	});

	test('openContentPackage(folder) returns non-temporary handle', async () => {
		const root = await createSamplePackage();

		const pkg = await openContentPackage(root);
		expect(pkg.isTemporary).toBe(false);
		expect(path.resolve(pkg.packageRoot)).toBe(path.resolve(root));
		await pkg.close();
	});

	test('extractZipToDirSafe enforces compressed input size before parsing', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-limits-'));
		const zipPath = path.join(root, 'invalid.zip');
		await writeFile(zipPath, Buffer.alloc(32));

		try {
			await expect(
				extractZipToDirSafe(zipPath, path.join(root, 'out'), { maxCompressedSize: 16 }),
			).rejects.toThrow('maximum compressed size');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('extractZipToDirStream uses the same bounded safe extraction path', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-limits-'));
		const zipPath = path.join(root, 'package.zip');
		await writeFile(zipPath, createZip({ 'one.txt': '12345', 'two.txt': '67890' }));

		try {
			await expect(
				extractZipToDirStream(zipPath, path.join(root, 'out'), { maxEntries: 1 }),
			).rejects.toThrow('maximum entry count');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('extractZipToDirSafe enforces cumulative size and entry count limits', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-limits-'));
		const zipPath = path.join(root, 'package.zip');
		await writeFile(zipPath, createZip({ 'one.txt': '12345', 'two.txt': '67890' }));

		try {
			await expect(
				extractZipToDirSafe(zipPath, path.join(root, 'count'), { maxEntries: 1 }),
			).rejects.toThrow('maximum entry count');
			await expect(
				extractZipToDirSafe(zipPath, path.join(root, 'size'), { maxTotalUncompressedSize: 9 }),
			).rejects.toThrow('maximum total uncompressed size');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('extractZipToDirSafe rejects excessive compression ratios and extracts within limits', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-limits-'));
		const bombPath = path.join(root, 'repetitive.zip');
		const normalPath = path.join(root, 'normal.zip');
		await writeFile(bombPath, createZip({ 'repetitive.txt': 'A'.repeat(16 * 1024) }));
		await writeFile(normalPath, createZip({ 'safe.txt': 'safe content' }));

		try {
			await expect(
				extractZipToDirSafe(bombPath, path.join(root, 'bomb'), { maxCompressionRatio: 10 }),
			).rejects.toThrow('maximum compression ratio');

			const target = path.join(root, 'normal');
			const result = await extractZipToDirSafe(normalPath, target, {
				maxCompressedSize: 1024,
				maxEntries: 2,
				maxTotalUncompressedSize: 1024,
				maxCompressionRatio: 200,
			});
			expect(result).toEqual({ fileCount: 1, totalSize: 12 });
			expect(await readFile(path.join(target, 'safe.txt'), 'utf8')).toBe('safe content');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('extractZipToDirSafe rejects a pre-existing symlink that escapes the target', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-symlink-'));
		const zipPath = path.join(root, 'package.zip');
		const target = path.join(root, 'target');
		const outside = path.join(root, 'outside');
		await writeFile(zipPath, createZip({ 'escape/owned.txt': 'hacked' }));
		await mkdir(target, { recursive: true });
		await mkdir(outside, { recursive: true });
		await symlink(outside, path.join(target, 'escape'), 'dir');

		try {
			await expect(extractZipToDirSafe(zipPath, target)).rejects.toThrow(
				'escapes target directory',
			);
			await expect(readFile(path.join(outside, 'owned.txt'), 'utf8')).rejects.toMatchObject({
				code: 'ENOENT',
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('extractZipToDirSafe does not overwrite an outside file through a symlink', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-file-symlink-'));
		const zipPath = path.join(root, 'package.zip');
		const target = path.join(root, 'target');
		const outsideFile = path.join(root, 'outside.txt');
		await writeFile(zipPath, createZip({ 'owned.txt': 'hacked' }));
		await mkdir(target, { recursive: true });
		await writeFile(outsideFile, 'original', 'utf8');
		await symlink(outsideFile, path.join(target, 'owned.txt'), 'file');

		try {
			await expect(extractZipToDirSafe(zipPath, target)).rejects.toThrow(
				'escapes target directory',
			);
			expect(await readFile(outsideFile, 'utf8')).toBe('original');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	test('extractZipToDirSafe rejects a symlink used as the extraction target', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-target-symlink-'));
		const zipPath = path.join(root, 'package.zip');
		const outside = path.join(root, 'outside');
		const targetLink = path.join(root, 'target');
		await writeFile(zipPath, createZip({ 'owned.txt': 'hacked' }));
		await mkdir(outside, { recursive: true });
		await symlink(outside, targetLink, 'dir');

		try {
			await expect(extractZipToDirSafe(zipPath, targetLink)).rejects.toThrow(
				'must not be a symbolic link',
			);
			await expect(readFile(path.join(outside, 'owned.txt'), 'utf8')).rejects.toMatchObject({
				code: 'ENOENT',
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
