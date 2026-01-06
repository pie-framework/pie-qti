import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadResolvedManifest, openContentPackage } from '../../src/utils/ims-cp/index.js';

describe('ims-cp', () => {
  test('loadResolvedManifest resolves resource hrefs relative to manifest location', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'ims-cp-'));

    // Create nested package structure
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

    const resolved = await loadResolvedManifest(root);
    expect(resolved.manifestPath.endsWith('nested/imsmanifest.xml')).toBe(true);
    expect(resolved.items.length).toBe(1);
    expect(resolved.items[0].hrefResolved).toBe('nested/item1.xml');
    expect(resolved.items[0].filesResolved).toEqual(['nested/item1.xml']);
  });

  test('loadResolvedManifest works on repo sample packages', async () => {
    const sampleDir = path.resolve(
      import.meta.dir,
      '../../../transform-app/static/samples/basic-interactions'
    );

    const resolved = await loadResolvedManifest(sampleDir);
    expect(resolved.items.length).toBeGreaterThan(0);
    // basic sanity check: resolved hrefs stay within package root
    for (const item of resolved.items.slice(0, 3)) {
      expect(item.hrefResolved?.includes('..')).toBe(false);
    }
  });

  test('openContentPackage(folder) returns non-temporary handle', async () => {
    const sampleDir = path.resolve(
      import.meta.dir,
      '../../../transform-app/static/samples/basic-interactions'
    );
    const pkg = await openContentPackage(sampleDir);
    expect(pkg.isTemporary).toBe(false);
    expect(path.resolve(pkg.packageRoot)).toBe(path.resolve(sampleDir));
    await pkg.close();
  });
});


