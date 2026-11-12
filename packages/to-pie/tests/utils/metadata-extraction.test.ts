/**
 * Metadata extension extraction
 *
 * A `pie:sourceModel` that is present but holds malformed JSON is a content failure and must
 * surface as one: silently falling through to the QTI metadata would drop the author's embedded
 * extensions as if none existed. An absent element, or a valid `sourceModel` without an
 * `extensions` object, falls through to the QTI metadata normally.
 */

import { describe, expect, test } from 'bun:test';
import { extractExtensions } from '../../src/utils/metadata-extraction.js';

const item = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:pie="https://github.com/pie-framework/pie-elements" identifier="meta-ext-1" title="Metadata Extension" adaptive="false" timeDependent="false">
  <qti-metadata>
    <qti-metadata-field name="topic" value="Fractions"/>
  </qti-metadata>
  ${body}
</assessmentItem>`;

const sourceModel = (json: string) =>
  `<pie:sourceModel><![CDATA[${json}]]></pie:sourceModel>`;

describe('extractExtensions', () => {
  test('no pie:sourceModel falls through to the QTI metadata', () => {
    expect(extractExtensions(item(''))).toEqual({ topic: 'Fractions' });
  });

  test('a valid sourceModel with extensions wins over the QTI metadata', () => {
    const extensions = { subject: 'Math' };
    expect(extractExtensions(item(sourceModel(JSON.stringify({ id: 'meta-ext-1', extensions }))))).toEqual(extensions);
  });

  test('a valid sourceModel without extensions falls through to the QTI metadata', () => {
    expect(extractExtensions(item(sourceModel(JSON.stringify({ id: 'meta-ext-1' }))))).toEqual({
      topic: 'Fractions',
    });
  });

  test('a malformed sourceModel throws naming the content', () => {
    const failure = () => extractExtensions(item(sourceModel('{"extensions": {"subject"')));

    expect(failure).toThrow(/sourceModel/);
    expect(failure).toThrow(/not valid JSON/);
  });
});
