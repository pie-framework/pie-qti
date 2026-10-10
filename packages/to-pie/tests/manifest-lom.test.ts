import { describe, expect, test } from 'bun:test';
import { readPieResourceLom } from '../src/utils/manifest-lom';

const classification = (key: string, entries: string[], description?: string) => `
          <imsmd:classification>
            <imsmd:taxonPath>
              <imsmd:source><imsmd:string language="x-none">pie:searchMetaData:${key}</imsmd:string></imsmd:source>
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

  test('decodes searchMetaData values with their types', () => {
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

    expect(lom.get('item1')?.searchMetaData).toEqual({
      subject: 'Math & Logic',
      gradeLevel: ['3', '4'],
      dok: 2,
      tags: { a: 1 },
      padded: ' spaced ',
      untyped: ['x', 'y'],
    });
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
