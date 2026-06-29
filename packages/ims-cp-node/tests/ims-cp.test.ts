import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadResolvedManifest, openContentPackage } from '../src/index.js';

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
});
