/**
 * Schema gate: every generator's output, exported as QTI 3.0, validates against the vendored
 * QTI 3.0 ASI schema, keeps no QTI 2 camelCase attribute, imports as its QTI 2.2 twin does and
 * round-trips through its sidecar. Packages validate against the QTI 3 content packaging schema.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAssessmentItemDefinition } from '@pie-qti/item-player/server';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { validateXML } from 'xmllint-wasm';
import { generatePassageStimulusXml } from '../../src/generators/passage-generator.js';
import { PieToQtiPlugin } from '../../src/plugin.js';
import type { ResolvedPassage } from '../../src/types/passages.js';
import { cases, itemFor } from './schema-gate-cases.js';

const SCHEMA_DIR = join(import.meta.dir, '../../../qti-common/schemas/qti3');
const schemas = readdirSync(SCHEMA_DIR)
  .filter((fileName) => fileName.endsWith('.xsd'))
  .map((fileName) => ({ fileName, contents: readFileSync(join(SCHEMA_DIR, fileName), 'utf8') }));

const ASI_SCHEMA = 'imsqti_asiv3p0_v1p0.xsd';
const CP_SCHEMA = 'imsqtiv3p0_imscpv1p2_v1p0.xsd';

async function schemaErrors(xml: string, schema = ASI_SCHEMA): Promise<string[]> {
  const result = await validateXML({
    xml: [{ fileName: 'document.xml', contents: xml }],
    schema: schemas.filter((file) => file.fileName === schema),
    preload: schemas.filter((file) => file.fileName !== schema),
    maxMemoryPages: 65536,
  });
  return result.errors.map((error) => error.rawMessage);
}

/** QTI 2 attribute names left in QTI markup; foreign MathML and SVG subtrees are skipped. */
function camelCaseAttributes(xml: string): string[] {
  const qti = xml.replace(/<(math|svg)[\s>][\s\S]*?<\/\1>/g, '');
  return [...qti.matchAll(/\s([a-z]+[A-Z]\w*)\s*=/g)].map((match) => match[1] as string);
}

async function expectValid(xml: string, schema = ASI_SCHEMA): Promise<void> {
  expect(await schemaErrors(xml, schema)).toEqual([]);
  expect(camelCaseAttributes(xml)).toEqual([]);
}

/** `value` with each generated UUID replaced by its order of first appearance. */
function withStableIds(value: unknown): unknown {
  const ids = new Map<string, string>();
  const json = JSON.stringify(value).replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    (uuid) => ids.get(uuid) ?? (ids.set(uuid, `id-${ids.size}`), `id-${ids.size - 1}`)
  );
  return JSON.parse(json);
}

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const qti22 = new PieToQtiPlugin();
const qti30 = new PieToQtiPlugin({ targetVersion: '3.0' });
const qtiToPie = new QtiToPiePlugin();

describe('Schema gate: QTI 3.0 XSD', () => {
  for (const [label, name, model] of cases) {
    test(`${label} validates, imports as its QTI 2.2 twin and round-trips through its sidecar`, async () => {
      const item = itemFor(name, model);
      const output = await qti30.transform({ content: item }, { logger });
      const xml = output.items[0].content as string;
      expect(output.format).toBe('qti30');
      expect(xml).toContain('<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"');
      await expectValid(xml);

      const twin = (await qti22.transform({ content: item }, { logger })).items[0].content as string;
      // An item to-pie cannot convert without its sidecar is refused for both versions alike.
      const [fromQti3, fromQti22] = await Promise.all(
        [xml, twin].map((content) =>
          qtiToPie.transform({ content }, { logger }).then(
            (result) => withStableIds((result.items[0].content as PieItem).config),
            (error: Error) => error.name
          )
        )
      );
      expect(fromQti3).toEqual(fromQti22);

      const back = await qtiToPie.transform({ content: xml, sidecar: output.items[0].sidecar }, { logger });
      expect(back.items[0].content).toMatchObject({ id: item.id, baseId: 'base-1', config: item.config });
    });
  }

  test('an inline passage beside an interaction validates', async () => {
    const item = {
      id: 'passage-item',
      config: {
        id: 'c',
        models: [
          { id: 'p', element: 'passage-el', passages: [{ title: 'Theme', text: '<p>Once upon a time.</p>' }] },
          { id: '1', element: 'er-el', prompt: 'Explain.' },
        ],
        elements: {
          'passage-el': '@pie-element/passage@1.0.0',
          'er-el': '@pie-element/extended-response@1.0.0',
        },
      },
    } as PieItem;

    const output = await qti30.transform({ content: item }, { logger });
    await expectValid(output.items[0].content as string);
  });

  test('a rubric validates inside qti-content-body', async () => {
    const item = {
      id: 'rubric-item',
      config: {
        id: 'c',
        models: [
          { id: '1', element: 'er-el', prompt: 'Explain.' },
          { id: '2', element: 'rubric-el', points: ['<p>None</p>', 'Partial', 'Full'], excludeZero: false },
        ],
        elements: { 'er-el': '@pie-element/extended-response@1.0.0', 'rubric-el': '@pie-element/rubric@1.0.0' },
      },
    } as PieItem;

    const xml = (await qti30.transform({ content: item }, { logger })).items[0].content as string;
    await expectValid(xml);
    expect(xml).toMatch(/<qti-rubric-block view="scorer" use="scoring">\s*<qti-content-body>/);

    const twin = (await qti22.transform({ content: item }, { logger })).items[0].content as string;
    const [fromQti3, fromQti22] = await Promise.all(
      [xml, twin].map(async (content) => (await qtiToPie.transform({ content }, { logger })).items[0].content as PieItem)
    );
    expect(withStableIds(fromQti3.config)).toEqual(withStableIds(fromQti22.config));
  });

  test('an external passage becomes a stimulus file the item references, packaged in a valid manifest', async () => {
    const passage: ResolvedPassage = {
      id: 'passage-abc',
      title: 'The Water Cycle',
      content: '<p>Water <span data-catalog-idref="term-cycle">cycles</span>.</p>',
      accessibilityCatalogs: [{ identifier: 'term-cycle', cards: [{ catalog: 'spoken', content: '<speak>cycle</speak>' }] }],
    } as ResolvedPassage;
    const plugin = new PieToQtiPlugin({
      targetVersion: '3.0',
      generatePackage: true,
      passageResolver: async () => passage,
    });
    const item = { ...itemFor('multiple-choice', cases.find(([label]) => label === 'multiple-choice')![2]), passage: 'passage-abc' };

    const output = await plugin.transform({ content: item }, { logger });
    const xml = output.items[0].content as string;
    await expectValid(xml);
    expect(xml).toMatch(
      /<qti-assessment-stimulus-ref identifier="passage-abc" href="passages\/passage-abc\.xml" data-pie-passage-id="passage-abc"\/>\s*<qti-item-body/
    );

    const imported = (await qtiToPie.transform({ content: xml }, { logger })).items[0].content as PieItem;
    expect(imported.passage).toBe('passage-abc');

    const [stimulus] = (output as any).passageFiles as Array<{ xml: string }>;
    await expectValid(stimulus!.xml);
    expect(stimulus!.xml).toContain('<qti-catalog id="term-cycle">');

    const manifest = (output as any).manifest as string;
    expect(await schemaErrors(manifest, CP_SCHEMA)).toEqual([]);
    expect(manifest).toContain('type="imsqti_item_xmlv3p0"');
    expect(manifest).toContain('type="imsqti_stimulus_xmlv3p0"');
  });

  test('a standalone stimulus validates', async () => {
    await expectValid(generatePassageStimulusXml({ id: 'p1', baseId: 'b1', title: 'Theme', content: '<p>Once.</p>' }));
  });

  test('catalogs are written as qti-catalog-info and read back as they were', async () => {
    const catalogs = [
      {
        identifier: 'term-water',
        cards: [
          { catalog: 'spoken', content: '<speak>water</speak>' },
          { catalog: 'keyword-translation', language: 'es', content: 'agua' },
        ],
      },
    ];
    const item = {
      id: 'catalog-item',
      config: {
        id: 'c',
        models: [
          {
            id: 'mc-1',
            element: 'mc-el',
            prompt: '<p>Which word means <span data-catalog-idref="term-water">water</span>?</p>',
            choiceMode: 'radio',
            choices: [
              { label: 'agua', value: 'a', correct: true },
              { label: 'fuego', value: 'b', correct: false },
            ],
            accessibilityCatalogs: catalogs,
          },
        ],
        elements: { 'mc-el': '@pie-element/multiple-choice@1.0.0' },
      },
    } as PieItem;

    const output = await qti30.transform({ content: item }, { logger });
    const xml = output.items[0].content as string;
    await expectValid(xml);
    expect((output.metadata.warnings as string[]).filter((warning) => warning.includes('catalogs'))).toEqual([]);
    expect(xml).toMatch(/<\/qti-item-body>\s*<qti-catalog-info>[\s\S]*<\/qti-catalog-info>\s*<qti-response-processing/);
    const imported = (await qtiToPie.transform({ content: xml }, { logger })).items[0].content as PieItem;
    expect(imported.config.models[0].accessibilityCatalogs).toEqual(catalogs);
  });

  test('a reference to an undeclared catalog is dropped and named', async () => {
    const item = {
      id: 'dangling',
      config: {
        id: 'c',
        models: [{ id: '1', element: 'er-el', prompt: '<p><span data-catalog-idref="missing">x</span></p>' }],
        elements: { 'er-el': '@pie-element/extended-response@1.0.0' },
      },
    } as PieItem;

    const output = await qti30.transform({ content: item }, { logger });
    const xml = output.items[0].content as string;
    await expectValid(xml);
    expect(xml).not.toContain('data-catalog-idref');
    expect((output.metadata.warnings as string[]).join('\n')).toContain('"missing"');
  });

  test('an assessment validates as a qti-assessment-test in a valid package', async () => {
    const assessment = {
      id: 'test-1',
      title: 'Test',
      outcomeDeclarationsXml: ['<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>'],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }],
        },
      ],
    };
    const output = await new PieToQtiPlugin({ targetVersion: '3.0', generatePackage: true }).transform(
      { content: assessment },
      { logger }
    );
    const xml = output.items[0].content as string;
    expect(output.format).toBe('qti30');
    expect(xml).toContain('<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"');
    await expectValid(xml);

    const manifest = (output as any).manifest as string;
    expect(await schemaErrors(manifest, CP_SCHEMA)).toEqual([]);
    expect(manifest).toContain('type="imsqti_test_xmlv3p0"');
  });

  test('response processing scores as the QTI 2.2 twin does', async () => {
    const item = itemFor('multiple-choice', {
      choiceMode: 'checkbox',
      choices: [
        { value: 'a', label: 'A', correct: true },
        { value: 'b', label: 'B', correct: true },
        { value: 'c', label: 'C' },
      ],
    });
    const score = async (plugin: PieToQtiPlugin, responses: Record<string, unknown>) => {
      const itemXml = (await plugin.transform({ content: item }, { logger })).items[0].content as string;
      const session = createAssessmentItemDefinition({ itemXml }).openSession({ responses, activate: true });
      const scoring = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
      session.dispose();
      return { score: scoring?.score, maxScore: scoring?.maxScore };
    };
    for (const responses of [{ RESPONSE: ['choice-0'] }, { RESPONSE: ['choice-0', 'choice-1'] }, { RESPONSE: ['choice-2'] }]) {
      expect(await score(qti30, responses)).toEqual(await score(qti22, responses));
    }
  });
});
