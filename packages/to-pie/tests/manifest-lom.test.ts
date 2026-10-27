import { describe, expect, test } from 'bun:test';
import { readPieResourceLom } from '../src/utils/manifest-lom';

const classification = (key: string, entries: string[], description?: string, prefix = 'pie:extension:') => `
          <imsmd:classification>
            <imsmd:taxonPath>
              <imsmd:source><imsmd:string language="x-none">${prefix}${key}</imsmd:string></imsmd:source>
              ${entries.map((entry) => `<imsmd:taxon><imsmd:entry><imsmd:string language="x-none">${entry}</imsmd:string></imsmd:entry></imsmd:taxon>`).join('')}
            </imsmd:taxonPath>
            ${description === undefined ? '' : `<imsmd:description><imsmd:string language="x-none">${description}</imsmd:string></imsmd:description>`}
          </imsmd:classification>`;

const manifest = (lom: string) => `
<manifest identifier="pkg" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:imsmd="http://ltsc.ieee.org/xsd/LOM">
  <resources>
    <resource identifier="item1" type="imsqti_item_xmlv2p2" href="items/item1.xml">
      <metadata><imsmd:lom>${lom}</imsmd:lom></metadata>
      <file href="items/item1.xml"/>
    </resource>
    <resource identifier="item2" type="imsqti_item_xmlv2p2" href="items/item2.xml">
      <file href="items/item2.xml"/>
    </resource>
  </resources>
</manifest>`;

describe('readPieResourceLom', () => {
  test('reads baseId from the PIE identifier catalog only', () => {
    const lom = readPieResourceLom(
      manifest(`
          <imsmd:general>
            <imsmd:identifier><imsmd:catalog>ISBN</imsmd:catalog><imsmd:entry>other</imsmd:entry></imsmd:identifier>
            <imsmd:identifier><imsmd:catalog>pie:baseId</imsmd:catalog><imsmd:entry>base-1</imsmd:entry></imsmd:identifier>
          </imsmd:general>`)
    );

    expect(lom.get('item1')).toEqual({ baseId: 'base-1' });
    expect(lom.has('item2')).toBe(false);
  });

  test('decodes extension values with their types', () => {
    const lom = readPieResourceLom(
      manifest(
        [
          classification('subject', ['Math &amp; Logic']),
          classification('gradeLevel', ['3', '4'], '[&quot;3&quot;,&quot;4&quot;]'),
          classification('dok', ['2'], '2'),
          classification('tags', ['{&quot;a&quot;:1}'], '{&quot;a&quot;:1}'),
          classification('padded', [' spaced ']),
          classification('untyped', ['x', 'y']),
        ].join('')
      )
    );

    expect(lom.get('item1')?.extensions).toEqual({
      subject: 'Math & Logic',
      gradeLevel: ['3', '4'],
      dok: 2,
      tags: { a: 1 },
      padded: ' spaced ',
      untyped: ['x', 'y'],
    });
  });

  test('reads the legacy source prefix, the current one winning per key', () => {
    const lom = readPieResourceLom(
      manifest(
        [
          classification('subject', ['Science'], undefined, 'pie:searchMetaData:'),
          classification('dok', ['3'], '3', 'pie:searchMetaData:'),
          classification('subject', ['Math']),
        ].join('')
      )
    );

    expect(lom.get('item1')?.extensions).toEqual({ subject: 'Math', dok: 3 });
  });

  test('ignores classifications from other taxonomies', () => {
    const lom = readPieResourceLom(
      manifest(`
          <imsmd:classification>
            <imsmd:taxonPath>
              <imsmd:source><imsmd:string>CCSS</imsmd:string></imsmd:source>
              <imsmd:taxon><imsmd:entry><imsmd:string>3.OA.1</imsmd:string></imsmd:entry></imsmd:taxon>
            </imsmd:taxonPath>
          </imsmd:classification>`)
    );

    expect(lom.size).toBe(0);
  });

  test('reads nothing from a manifest that does not parse', () => {
    expect(readPieResourceLom('<manifest><resources>').size).toBe(0);
  });
});

describe('readPieResourceLom: standards and skill levels', () => {
  const csmManifest = (metadata: string) => `
<manifest identifier="pkg" xmlns="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscp_v1p1"
          xmlns:imsmd="http://ltsc.ieee.org/xsd/LOM" xmlns:csm="http://www.imsglobal.org/xsd/qti/qtiv3p0/imscsmd_v1p1">
  <resources>
    <resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item1.xml">
      <metadata>${metadata}</metadata>
      <file href="items/item1.xml"/>
    </resource>
  </resources>
</manifest>`;

  test('reads CSM and LOM from a package without PIE sources, with no PIE extensions', () => {
    const lom = readPieResourceLom(
      csmManifest(`
        <csm:curriculumStandardsMetadataSet>
          <csm:curriculumStandardsMetadata providerId="AB">
            <csm:setOfGUIDs>
              <csm:labelledGUID><csm:label> SYN.1 </csm:label><csm:GUID> aBcD0001-0000-4000-8000-00000000000A </csm:GUID></csm:labelledGUID>
              <csm:labelledGUID><csm:GUID>ABCD0002-0000-4000-8000-00000000000B</csm:GUID></csm:labelledGUID>
            </csm:setOfGUIDs>
          </csm:curriculumStandardsMetadata>
        </csm:curriculumStandardsMetadataSet>
        <imsmd:lom>
          <imsmd:classification>
            <imsmd:purpose><imsmd:source>LOMv1.0</imsmd:source><imsmd:value>prerequisite</imsmd:value></imsmd:purpose>
            <imsmd:taxonPath>
              <imsmd:source><imsmd:string>AB</imsmd:string></imsmd:source>
              <imsmd:taxon><imsmd:id>abcd0002-0000-4000-8000-00000000000b</imsmd:id></imsmd:taxon>
            </imsmd:taxonPath>
          </imsmd:classification>
          <imsmd:classification>
            <imsmd:purpose><imsmd:source>LOMv1.0</imsmd:source><imsmd:value>skill level</imsmd:value></imsmd:purpose>
            <imsmd:taxonPath>
              <imsmd:source><imsmd:string>webb-dok</imsmd:string></imsmd:source>
              <imsmd:taxon><imsmd:entry><imsmd:string>3</imsmd:string></imsmd:entry></imsmd:taxon>
            </imsmd:taxonPath>
            <imsmd:description><imsmd:string>Strategic thinking</imsmd:string></imsmd:description>
          </imsmd:classification>
        </imsmd:lom>`)
    );

    expect(lom.get('item1')).toEqual({
      curriculumStandards: [
        { providerId: 'AB', guid: 'aBcD0001-0000-4000-8000-00000000000A', label: 'SYN.1' },
        { providerId: 'AB', guid: 'ABCD0002-0000-4000-8000-00000000000B', purpose: 'prerequisite' },
      ],
      skillLevels: [{ source: 'webb-dok', id: '3' }],
    });
  });

  test('keeps a CSM block without a provider, leaving providerId absent and naming it "AB" in LOM', () => {
    const lom = readPieResourceLom(
      csmManifest(`
        <csm:curriculumStandardsMetadataSet>
          <csm:curriculumStandardsMetadata>
            <csm:setOfGUIDs><csm:labelledGUID><csm:GUID>00000000-0000-4000-8000-000000000001</csm:GUID></csm:labelledGUID></csm:setOfGUIDs>
          </csm:curriculumStandardsMetadata>
        </csm:curriculumStandardsMetadataSet>
        <imsmd:lom>
          <imsmd:classification>
            <imsmd:purpose><imsmd:source>LOMv1.0</imsmd:source><imsmd:value>prerequisite</imsmd:value></imsmd:purpose>
            <imsmd:taxonPath>
              <imsmd:source><imsmd:string language="x-none">AB</imsmd:string></imsmd:source>
              <imsmd:taxon><imsmd:id>00000000-0000-4000-8000-000000000001</imsmd:id></imsmd:taxon>
            </imsmd:taxonPath>
          </imsmd:classification>
        </imsmd:lom>`)
    );

    expect(lom.get('item1')?.curriculumStandards).toEqual([
      { guid: '00000000-0000-4000-8000-000000000001', purpose: 'prerequisite' },
    ]);
  });

  test('skips CSM entries without a GUID', () => {
    const lom = readPieResourceLom(
      csmManifest(`
        <csm:curriculumStandardsMetadataSet>
          <csm:curriculumStandardsMetadata providerId="CASE">
            <csm:setOfGUIDs><csm:labelledGUID><csm:label>SYN.2</csm:label><csm:GUID> </csm:GUID></csm:labelledGUID></csm:setOfGUIDs>
          </csm:curriculumStandardsMetadata>
        </csm:curriculumStandardsMetadataSet>`)
    );

    expect(lom.size).toBe(0);
  });
});
