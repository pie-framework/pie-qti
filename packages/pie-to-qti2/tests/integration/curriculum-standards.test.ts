/**
 * `curriculumStandards` and `skillLevels` travel on the item resource of a QTI 3 package as CSM 1.1
 * and LOM: the manifest validates against the QTI 3 content packaging schema, and to-pie reads both
 * fields back unchanged without the sidecar. GUIDs here are synthetic.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformQtiPackageToPie } from '@pie-qti/to-pie';
import type { CurriculumStandard, PieItem, SkillLevel } from '@pie-qti/transform-types';
import { validateXML } from 'xmllint-wasm';
import { PieToQtiPlugin } from '../../src/plugin.js';
import type { ResolvedPassage } from '../../src/types/passages.js';

const SCHEMA_DIR = join(import.meta.dir, '../../../qti-common/schemas/qti3');
const schemas = readdirSync(SCHEMA_DIR)
  .filter((fileName) => fileName.endsWith('.xsd'))
  .map((fileName) => ({ fileName, contents: readFileSync(join(SCHEMA_DIR, fileName), 'utf8') }));
const CP_SCHEMA = 'imsqtiv3p0_imscpv1p2_v1p0.xsd';

async function schemaErrors(xml: string): Promise<string[]> {
  const result = await validateXML({
    xml: [{ fileName: 'imsmanifest.xml', contents: xml }],
    schema: schemas.filter((file) => file.fileName === CP_SCHEMA),
    preload: schemas.filter((file) => file.fileName !== CP_SCHEMA),
    maxMemoryPages: 65536,
  });
  return result.errors.map((error) => error.rawMessage);
}

const curriculumStandards: CurriculumStandard[] = [
  {
    providerId: 'AB',
    guid: 'aBcD0001-0000-4000-8000-00000000000A',
    label: 'SYN.1.A',
    primary: true,
    provenance: 'authored',
  },
  {
    providerId: 'CASE',
    guid: '00000000-0000-4000-8000-00000000c001',
    caseItemURI: 'https://case.example.org/ims/case/v1p0/CFItems/00000000-0000-4000-8000-00000000c001',
    label: 'SYN.CASE.1',
    purpose: 'prerequisite',
  },
  {
    providerId: 'AB',
    guid: 'ABCD0002-0000-4000-8000-00000000000B',
    purpose: 'educational objective',
    provenance: 'derived',
    derivedFrom: { providerId: 'CASE', guid: '00000000-0000-4000-8000-00000000c001' },
  },
  { providerId: 'RLI-SKILLS', guid: '00000000-0000-4000-8000-0000000051c1', provenance: 'imported' },
];

const skillLevels: SkillLevel[] = [
  { source: 'webb-dok', id: '1' },
  { source: 'webb-dok', id: '2', rationale: 'Two steps & a comparison' },
  { source: 'blooms-revised', id: 'apply' },
];

function itemWith(fields: Pick<PieItem, 'curriculumStandards' | 'skillLevels'>): PieItem {
  return {
    id: 'item-1',
    uuid: 'item-1',
    baseId: 'base-item-1',
    passage: 'passage-1',
    ...fields,
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
  } as PieItem;
}

async function exportPackage(item: PieItem, targetVersion: '2.2' | '3.0' = '3.0') {
  const plugin = new PieToQtiPlugin({
    targetVersion,
    generatePackage: true,
    passageResolver: async (): Promise<ResolvedPassage> => ({
      id: 'passage-1',
      baseId: 'passage-1',
      title: 'The Water Cycle',
      content: '<p>Water evaporates.</p>',
    }),
  });
  return (await plugin.transform({ content: item, format: 'pie' }, {})) as any;
}

/** The item to-pie reads from the package, with the sidecar left out. */
async function importWithoutSidecar(output: any): Promise<PieItem> {
  const files = new Map<string, string>([
    ['items/base-item-1.xml', output.items[0].content],
    ...output.passageFiles.map((file: any) => [file.filePath, file.xml] as [string, string]),
  ]);
  const result = await transformQtiPackageToPie({
    manifestXml: output.manifest,
    fileAccess: { readText: (path) => files.get(path) ?? null },
  });
  expect(result.items).toHaveLength(1);
  return result.items[0].content as PieItem;
}

describe('curriculum standards and skill levels in a QTI 3 package', () => {
  test('travel as CSM and LOM on the item resource, valid against the QTI 3 CP schema', async () => {
    const { manifest } = await exportPackage(itemWith({ curriculumStandards, skillLevels }));

    expect(manifest).toContain('xmlns:imscsmd="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscsmd_v1p1"');
    // One curriculumStandardsMetadata per run of a provider, so AB, CASE, AB keeps its order.
    expect([...manifest.matchAll(/curriculumStandardsMetadata providerId="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'AB',
      'CASE',
      'AB',
      'RLI-SKILLS',
    ]);
    expect(manifest).toContain('<imscsmd:GUID>aBcD0001-0000-4000-8000-00000000000A</imscsmd:GUID>');
    expect(manifest).toContain('<imsmd:value>skill level</imsmd:value>');
    expect(manifest).toContain('pie:curriculumStandard');
    expect(manifest).toContain('pie:skillLevel');
    expect(await schemaErrors(manifest)).toEqual([]);
  });

  test('read back unchanged without the sidecar', async () => {
    const item = await importWithoutSidecar(await exportPackage(itemWith({ curriculumStandards, skillLevels })));

    expect(item.curriculumStandards).toEqual(curriculumStandards);
    expect(item.skillLevels).toEqual(skillLevels);
  });

  test('keep a providerless standard providerless, its LOM naming it "AB"', async () => {
    const providerless: CurriculumStandard[] = [
      { guid: 'ABCD0003-0000-4000-8000-00000000000C', purpose: 'prerequisite', primary: true },
      { providerId: 'AB', guid: 'ABCD0004-0000-4000-8000-00000000000D' },
    ];
    const output = await exportPackage(itemWith({ curriculumStandards: providerless }));
    expect(output.manifest).toContain('<imscsmd:curriculumStandardsMetadata>');
    expect([...output.manifest.matchAll(/curriculumStandardsMetadata providerId="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'AB',
    ]);
    expect(await schemaErrors(output.manifest)).toEqual([]);

    const item = await importWithoutSidecar(output);
    expect(item.curriculumStandards).toEqual(providerless);
  });

  test('keep [] apart from absent', async () => {
    const output = await exportPackage(itemWith({ curriculumStandards: [] }));
    expect(output.manifest).not.toContain('imscsmd:curriculumStandardsMetadataSet');
    expect(await schemaErrors(output.manifest)).toEqual([]);

    const item = await importWithoutSidecar(output);
    expect(item.curriculumStandards).toEqual([]);
    expect(item).not.toHaveProperty('skillLevels');
  });

  test('a QTI 2.2 package leaves them to the sidecar', async () => {
    const { manifest, items } = await exportPackage(itemWith({ curriculumStandards, skillLevels }), '2.2');

    expect(manifest).not.toContain('imscsmd');
    expect(manifest).not.toContain('skill level');
    expect(items[0].sidecar.sourceModel.curriculumStandards).toEqual(curriculumStandards);
  });
});
