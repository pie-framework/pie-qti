import { describe, expect, test } from 'bun:test';
import JSZip from 'jszip';
import { extractPackage, loadResolvedManifest } from '../src/package-loader.js';

describe('loadResolvedManifest', () => {
	test('rejects unsafe manifest href and file paths', async () => {
		const manifest = await loadResolvedManifest(
			`<manifest identifier="unsafe">
        <resources>
          <resource identifier="item1" type="imsqti_item_xmlv3p0" href="../../../secret.xml">
            <file href="%252e%252e/secret.css"/>
            <file href="items/item.xml"/>
          </resource>
        </resources>
      </manifest>`,
			'imsmanifest.xml'
		);

		const item = manifest.resources.get('item1');
		expect(item?.hrefResolved).toBeUndefined();
		expect(item?.filesResolved).toEqual(['items/item.xml']);
	});

	test('rejects unsafe xml:base before resolving resource files', async () => {
		const manifest = await loadResolvedManifest(
			`<manifest identifier="unsafe-base" xml:base="%252e%252e">
        <resources>
          <resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item.xml">
            <file href="items/item.xml"/>
          </resource>
        </resources>
      </manifest>`,
			'imsmanifest.xml'
		);

		const item = manifest.resources.get('item1');
		expect(item?.hrefResolved).toBeUndefined();
		expect(item?.filesResolved).toEqual([]);
	});

	test('skips unsafe ZIP entries before storing package files', async () => {
		const zip = new JSZip();
		zip.file('imsmanifest.xml', '<manifest identifier="safe"><resources/></manifest>');
		zip.file('%252e%252e/secret.txt', 'secret');
		zip.file('items/item.xml', '<assessmentItem/>');
		const data = await zip.generateAsync({ type: 'arraybuffer' });

		const extracted = await extractPackage(data as unknown as File, { maxFiles: 10 });

		expect(extracted.files.has('imsmanifest.xml')).toBe(true);
		expect(extracted.files.has('items/item.xml')).toBe(true);
		expect([...extracted.files.keys()]).not.toContain('%252e%252e/secret.txt');
	});

	test('fails closed when only unsafe manifest entries are present', async () => {
		const zip = new JSZip();
		zip.file('%252e%252e/imsmanifest.xml', '<manifest identifier="unsafe"><resources/></manifest>');
		const data = await zip.generateAsync({ type: 'arraybuffer' });

		await expect(extractPackage(data as unknown as File, { maxFiles: 10 })).rejects.toThrow(
			'No imsmanifest.xml found in package'
		);
	});

	test('rejects ZIP entries that exceed the maximum file size', async () => {
		const zip = new JSZip();
		zip.file('imsmanifest.xml', '<manifest id="s"/>');
		zip.file('items/large.txt', 'x'.repeat(1024));
		const data = await zip.generateAsync({ type: 'arraybuffer' });

		await expect(extractPackage(data as unknown as File, { maxFiles: 10, maxFileSize: 128 })).rejects.toThrow(
			'items/large.txt exceeds maximum file size'
		);
	});

	test('rejects compressed input before parsing when its byte size exceeds the limit', async () => {
		const zip = new JSZip();
		zip.file('imsmanifest.xml', '<manifest identifier="safe"><resources/></manifest>');
		const data = await zip.generateAsync({ type: 'arraybuffer' });

		await expect(
			extractPackage(data as unknown as File, { maxCompressedSize: data.byteLength - 1 }),
		).rejects.toThrow('maximum compressed size');
	});

	test('rejects packages whose cumulative uncompressed size exceeds the limit', async () => {
		const zip = new JSZip();
		zip.file('imsmanifest.xml', '<manifest identifier="safe"><resources/></manifest>');
		zip.file('items/one.txt', 'a'.repeat(100));
		zip.file('items/two.txt', 'b'.repeat(100));
		const data = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });

		await expect(
			extractPackage(data as unknown as File, { maxTotalUncompressedSize: 150 }),
		).rejects.toThrow('maximum total uncompressed size');
	});

	test('rejects packages that exceed the entry count limit', async () => {
		const zip = new JSZip();
		zip.file('imsmanifest.xml', '<manifest identifier="safe"><resources/></manifest>');
		zip.file('items/item.xml', '<assessmentItem/>');
		const data = await zip.generateAsync({ type: 'arraybuffer' });

		await expect(extractPackage(data as unknown as File, { maxEntries: 1 })).rejects.toThrow(
			'maximum entry count',
		);
	});

	test('rejects highly compressed entries that exceed the ratio limit', async () => {
		const zip = new JSZip();
		zip.file('imsmanifest.xml', '<manifest identifier="safe"><resources/></manifest>');
		zip.file('items/repetitive.txt', 'A'.repeat(16 * 1024));
		const data = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });

		await expect(
			extractPackage(data as unknown as File, { maxCompressionRatio: 10 }),
		).rejects.toThrow('maximum compression ratio');
	});
});
