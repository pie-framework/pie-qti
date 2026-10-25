/**
 * Item `baseId` and `extensions` travel as IEEE LOM on the item's manifest resource: the
 * manifest validates against IMS CP with LOM, and to-pie reads both back without the sidecar.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformQtiPackageToPie } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { validateXML } from 'xmllint-wasm';
import { generateManifest } from '../../src/generators/manifest-generator.js';
import { PieToQtiPlugin } from '../../src/plugin.js';
import type { ResolvedPassage } from '../../src/types/passages.js';

const schemaDir = join(import.meta.dir, '../fixtures/schemas/imscp');
const schemaFiles = readdirSync(schemaDir)
  .filter((name) => name.endsWith('.xsd'))
  .map((fileName) => ({ fileName, contents: readFileSync(join(schemaDir, fileName), 'utf8') }));

async function schemaErrors(manifestXml: string): Promise<string[]> {
  const result = await validateXML({
    xml: [{ fileName: 'imsmanifest.xml', contents: manifestXml }],
    schema: schemaFiles.filter((file) => file.fileName === 'manifest-root.xsd'),
    preload: schemaFiles.filter((file) => file.fileName !== 'manifest-root.xsd'),
  });
  return result.errors
    .map((error) => error.rawMessage)
    .filter((message) => !/fails to validate\s*$/.test(message.trim()));
}

const extensions = {
  subject: 'Math & Logic',
  gradeLevel: ['4', '3'],
  single: ['only'],
  empty: [],
  dok: 2,
  standards: [{ code: '3.OA.1', source: 'CCSS' }],
  nested: { review: { by: 'qa', passes: [1, null, 'x'] } },
  reviewed: true,
  retired: null,
};

const pieItem: PieItem = {
  id: 'item-1',
  baseId: 'base-item-1',
  passage: 'passage-1',
  extensions,
  config: {
    id: 'item-1',
    models: [
      {
        id: 'mc-1',
        element: '@pie-element/multiple-choice',
        prompt: '<p>What drives the water cycle?</p>',
        choiceMode: 'radio',
        choices: [
          { label: 'Sun energy', value: 'a', correct: true },
          { label: 'Moon gravity', value: 'b', correct: false },
        ],
      },
    ],
    elements: { '@pie-element/multiple-choice': '1.0.0' },
  },
};

async function exportPackage() {
  const plugin = new PieToQtiPlugin({
    generatePackage: true,
    passageResolver: async (): Promise<ResolvedPassage> => ({
      id: 'passage-1',
      baseId: 'passage-1',
      title: 'The Water Cycle',
      content: '<p>Water evaporates.</p>',
      metadata: { genre: 'informational' },
    }),
  });
  return (await plugin.transform({ content: pieItem, format: 'pie' }, {})) as any;
}

describe('manifest LOM', () => {
  test('carries baseId and extensions on the item resource and validates as IMS CP with LOM', async () => {
    const output = await exportPackage();
    const manifestXml: string = output.manifest;

    expect(manifestXml).toContain('xmlns:imsmd="http://ltsc.ieee.org/xsd/LOM"');
    expect(manifestXml).toContain('<imsmd:catalog>pie:baseId</imsmd:catalog>');
    expect(manifestXml).toContain('<imsmd:entry>base-item-1</imsmd:entry>');
    expect(manifestXml).toContain('pie:extension:subject');
    expect(manifestXml).toContain('pie:extension:genre');
    expect(manifestXml).not.toContain('pie:searchMetaData:');
    expect(manifestXml).not.toContain('<imsmd:purpose>');
    expect(await schemaErrors(manifestXml)).toEqual([]);
  });

  test('validates title, description and language in LOM general', async () => {
    const manifestXml = generateManifest({
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
          locale: 'es-ES',
          metadata: { title: 'Ciclo del agua', description: 'Ítem <de> prueba' },
        },
      ],
    });

    expect(manifestXml).toContain('<imsmd:string language="es-ES">Ciclo del agua</imsmd:string>');
    expect(manifestXml).toContain('<imsmd:language>es-ES</imsmd:language>');
    expect(await schemaErrors(manifestXml)).toEqual([]);
  });

  test('writes no resource metadata when there is nothing to carry', () => {
    const manifestXml = generateManifest({ items: [{ id: 'item-1', filePath: 'items/item-1.xml' }] });

    expect(manifestXml).not.toContain('<imsmd:lom>');
  });

  test('the schema check rejects LOM it does not define', async () => {
    const manifestXml = generateManifest({
      items: [{ id: 'item-1', filePath: 'items/item-1.xml', baseId: 'base-item-1' }],
    }).replace('<imsmd:catalog>', '<imsmd:bogus/><imsmd:catalog>');

    expect((await schemaErrors(manifestXml)).join('\n')).toContain('bogus');
  });

  async function importWithoutSidecar(manifestXml: string, output: any) {
    const files = new Map<string, string>([
      [`items/${pieItem.baseId}.xml`, output.items[0].content],
      ...output.passageFiles.map((file: any) => [file.filePath, file.xml] as [string, string]),
    ]);
    const result = await transformQtiPackageToPie({
      manifestXml,
      fileAccess: { readText: (path) => files.get(path) ?? null },
    });
    expect(result.items).toHaveLength(1);
    return result.items[0].content;
  }

  test('to-pie reads baseId and extensions back when the package has no sidecar', async () => {
    const output = await exportPackage();
    const item = await importWithoutSidecar(output.manifest, output);

    expect(item.config.models.map((model: any) => model.element)).toContain('multiple-choice');
    expect(item.baseId).toBe('base-item-1');
    expect(item.extensions).toEqual(extensions);
    expect(Object.keys(item.extensions)).toEqual(Object.keys(extensions));
  });

  test('to-pie reads the same extensions from a package written with the legacy LOM source', async () => {
    const output = await exportPackage();
    const legacyManifest = output.manifest.replaceAll('pie:extension:', 'pie:searchMetaData:');
    const item = await importWithoutSidecar(legacyManifest, output);

    expect(item.extensions).toEqual(extensions);
  });
});
