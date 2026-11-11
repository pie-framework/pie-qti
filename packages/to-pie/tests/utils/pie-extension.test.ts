/**
 * PIE extension extraction
 *
 * A legacy `<pie:sourceModel>` that is present but holds malformed JSON is a content failure and
 * must surface as one: silently reporting "no extension" would drop the interaction's custom data
 * as if the author had embedded none.
 */

import { describe, expect, test } from 'bun:test';
import { extractPieExtension, hasPieExtension } from '../../src/utils/pie-extension.js';

const item = (sourceModel: string, metadata = '') =>
  `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:pie="https://github.com/pie-framework/pie-elements" identifier="legacy-ext-1" title="Legacy Extension" adaptive="false" timeDependent="false">
  ${metadata}
  <pie:sourceModel><![CDATA[${sourceModel}]]></pie:sourceModel>
</assessmentItem>`;

const metadataElement = `<pie:metadata><pie:generator version="1.0.0">@pie-element/multiple-choice</pie:generator><pie:elementType>@pie-element/multiple-choice</pie:elementType></pie:metadata>`;
const validSourceModel = JSON.stringify({
  id: 'legacy-ext-1',
  config: { models: [{ id: '1', element: '@pie-element/multiple-choice' }] },
  extensions: { subject: 'Math' },
});

describe('extractPieExtension', () => {
  test('an item with no extension reports none and does not throw', () => {
    const xml = item(validSourceModel).replace(/<pie:sourceModel>.*<\/pie:sourceModel>/s, '');

    expect(hasPieExtension(xml)).toBe(false);
    expect(extractPieExtension(xml)).toEqual({ sourceModel: null, hasExtension: false });
  });

  test('a present but empty sourceModel reports none and does not throw', () => {
    expect(extractPieExtension(item(''))).toEqual({ sourceModel: null, hasExtension: false });
  });

  test('a malformed sourceModel throws naming the interaction and item', () => {
    const corrupt = '{"id": "truncated';
    const failure = () => extractPieExtension(item(corrupt, metadataElement));

    expect(failure).toThrow(/@pie-element\/multiple-choice/);
    expect(failure).toThrow(/legacy-ext-1/);
    expect(failure).toThrow(/malformed/);
  });

  test('a malformed sourceModel throws even without metadata to name', () => {
    expect(() => extractPieExtension(item('{"id": "truncated'))).toThrow(/legacy-ext-1/);
  });

  test('a valid sourceModel extracts the model and its metadata unchanged', () => {
    const extracted = extractPieExtension(item(validSourceModel, metadataElement));

    expect(extracted.hasExtension).toBe(true);
    expect(extracted.sourceModel).toEqual(JSON.parse(validSourceModel));
    expect(extracted.metadata?.elementType).toBe('@pie-element/multiple-choice');
    expect(extracted.metadata?.generator).toEqual({
      package: '@pie-element/multiple-choice',
      version: '1.0.0',
    });
  });
});
