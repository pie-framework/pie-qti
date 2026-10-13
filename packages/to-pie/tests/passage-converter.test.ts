/// <reference types="bun" />

import { describe, expect, test } from 'bun:test';
import { convertQtiPassageDocument } from '../src/passage-converter.js';

const stimulus = `
<assessmentStimulus identifier="reading" title="The Tide Pool">
  <stimulusBody>
    <p>Tide pools form where the sea retreats.</p>
  </stimulusBody>
</assessmentStimulus>
`;

describe('convertQtiPassageDocument', () => {
  test('converts a stimulus document into a complete PIE passage config', () => {
    const result = convertQtiPassageDocument({
      xml: stimulus,
      passageId: 'reading',
      sourcePath: 'passages/reading.xml',
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') {
      return;
    }
    expect(result.passage.title).toBe('The Tide Pool');
    // Complete enough to render on its own: markup naming an element the config declares.
    expect(result.passage.config.markup).toBe('<passage id="reading:0"></passage>');
    expect(result.passage.config.elements).toEqual({ passage: '@pie-element/passage@latest' });
    expect(result.passage.config.models[0]).toMatchObject({
      id: 'reading:0',
      element: 'passage',
      passages: [{ title: 'The Tide Pool' }],
    });
    const text = (result.passage.config.models[0] as { passages: Array<{ text: string }> })
      .passages[0]?.text;
    expect(text).toContain('Tide pools form where the sea retreats.');
  });

  test('converts the same document to the same config', () => {
    // Model ids come out of the passage transformer as a fresh UUID per call, which would make
    // every re-analysis of an unchanged package look like a content change downstream.
    const first = convertQtiPassageDocument({ xml: stimulus, passageId: 'reading' });
    const second = convertQtiPassageDocument({ xml: stimulus, passageId: 'reading' });

    expect(first).toEqual(second);
  });

  test('names a passage whose source declares no title after its file', () => {
    const result = convertQtiPassageDocument({
      xml: '<assessmentStimulus><stimulusBody><p>Untitled.</p></stimulusBody></assessmentStimulus>',
      passageId: 'reading',
      sourcePath: 'passages/spring-tides.xml',
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') {
      return;
    }
    expect(result.passage.title).toBe('spring-tides');
  });

  test('converts a passage the package declares as web content', () => {
    // An item pointing at `<object data="reading.html">` is the common shape, and the manifest
    // carries the target as `type="webcontent"` with no `assessmentStimulus` in it at all.
    const result = convertQtiPassageDocument({
      xml: `
<html lang="en">
  <head><title>Spring Tides</title></head>
  <body><p>The moon pulls twice a month.</p></body>
</html>
`,
      passageId: 'passage1',
      sourcePath: 'passages/passage.html',
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') {
      return;
    }
    expect(result.passage.title).toBe('Spring Tides');
    expect(result.passage.config.markup).toBe('<passage id="passage1:0"></passage>');
    expect(
      (result.passage.config.models[0] as { passages: Array<{ text: string }> }).passages[0]?.text
    ).toBe('<p>The moon pulls twice a month.</p>');
  });

  test('names a web-content passage with no title after its file', () => {
    const result = convertQtiPassageDocument({
      xml: '<html><body><p>Untitled web content.</p></body></html>',
      passageId: 'passage1',
      sourcePath: 'passages/spring-tides.html',
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') {
      return;
    }
    expect(result.passage.title).toBe('spring-tides');
  });

  test('reports a document that holds no passage content instead of throwing', () => {
    const result = convertQtiPassageDocument({
      xml: '<manifest><resources /></manifest>',
      passageId: 'reading',
      sourcePath: 'passages/reading.xml',
    });

    // Markup with no text in it is not a passage: the web-content branch declines it rather
    // than persisting a passage that renders as nothing.
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') {
      return;
    }
    expect(result.code).toBe('passage_content_not_found');
  });

  test('converts an assessmentPassage as well as an assessmentStimulus', () => {
    const result = convertQtiPassageDocument({
      xml: `
<assessmentPassage identifier="poem" title="Sea Fever">
  <partBody><p>I must go down to the seas again.</p></partBody>
</assessmentPassage>
`,
      passageId: 'poem',
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') {
      return;
    }
    expect(result.passage.title).toBe('Sea Fever');
  });
});
