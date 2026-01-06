/**
 * Passage Generator Tests
 */

import { describe, expect, test } from 'bun:test';
import type { PieModel } from '@pie-framework/transform-types';
import {
  generatePassageFile,
  generatePassageObjectTag,
  generatePassageXml,
  insertPassageObjectReference,
} from '../../src/generators/passage-generator.js';
import type { ResolvedPassage } from '../../src/types/passages.js';

describe('Passage Generator', () => {
  test('should generate passage XML from PIE model', () => {
    const passage: PieModel = {
      id: 'passage-1',
      element: '@pie-element/passage',
      passages: [
        {
          title: 'Photosynthesis',
          text: '<p>Plants convert sunlight into energy through photosynthesis.</p>',
        },
      ],
    };

    const xml = generatePassageXml(passage);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<assessmentItem');
    expect(xml).toContain('identifier="passage-1"');
    expect(xml).toContain('title="Photosynthesis"');
    expect(xml).toContain('<div class="stimulus">');
    expect(xml).toContain('<h2>Photosynthesis</h2>');
    expect(xml).toContain('Plants convert sunlight');
  });

  test('should generate passage XML from resolved passage', () => {
    const passage: ResolvedPassage = {
      id: 'passage-abc',
      title: 'The Water Cycle',
      content: '<p>Water moves through the environment in a continuous cycle.</p>',
    };

    const xml = generatePassageXml(passage);

    expect(xml).toContain('identifier="passage-abc"');
    expect(xml).toContain('title="The Water Cycle"');
    expect(xml).toContain('Water moves through the environment');
  });

  test('should handle passage without title', () => {
    const passage: ResolvedPassage = {
      id: 'passage-2',
      content: '<p>Content without title.</p>',
    };

    const xml = generatePassageXml(passage);

    expect(xml).toContain('identifier="passage-2"');
    expect(xml).toContain('title="Passage"'); // Default title
    expect(xml).not.toContain('<h2>'); // No title element
    expect(xml).toContain('Content without title');
  });

  test('should escape XML special characters', () => {
    const passage: ResolvedPassage = {
      id: 'passage-special',
      title: 'Title with <tags> & "quotes"',
      content: '<p>Content</p>',
    };

    const xml = generatePassageXml(passage);

    expect(xml).toContain('title="Title with &lt;tags&gt; &amp; &quot;quotes&quot;"');
    expect(xml).toContain('<h2>Title with &lt;tags&gt; &amp; &quot;quotes&quot;</h2>');
  });

  test('should generate passage file with correct path', () => {
    const passage: PieModel = {
      id: 'passage-test',
      element: '@pie-element/passage',
      passages: [{ text: '<p>Test content</p>' }],
    };

    const file = generatePassageFile(passage);

    expect(file.id).toBe('passage-test');
    expect(file.filePath).toBe('passages/passage-test.xml');
    expect(file.xml).toContain('identifier="passage-test"');
  });

  test('should generate passage file with custom base path', () => {
    const passage: PieModel = {
      id: 'passage-custom',
      element: '@pie-element/passage',
      passages: [{ text: '<p>Content</p>' }],
    };

    const file = generatePassageFile(passage, {
      basePath: 'stimuli',
    });

    expect(file.filePath).toBe('stimuli/passage-custom.xml');
  });

  test('should generate passage object tag', () => {
    const objectTag = generatePassageObjectTag('passage-abc', 'passages/passage-abc.xml');

    expect(objectTag).toContain('<object');
    expect(objectTag).toContain('data="passages/passage-abc.xml"');
    expect(objectTag).toContain('type="text/html"');
    expect(objectTag).toContain('data-pie-passage-id="passage-abc"');
    expect(objectTag).toContain('Passage content not available');
  });

  test('should insert passage object reference into itemBody', () => {
    const qtiXml = `<?xml version="1.0"?>
<assessmentItem identifier="item-1">
  <responseDeclaration/>
  <itemBody>
    <prompt>Question text</prompt>
    <choiceInteraction>
      <simpleChoice>A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

    const result = insertPassageObjectReference(
      qtiXml,
      'passage-abc',
      'passages/passage-abc.xml'
    );

    // Verify object tag is inserted before prompt
    expect(result).toContain('<itemBody>');
    expect(result).toContain('<object data="passages/passage-abc.xml"');
    expect(result).toContain('<prompt>Question text</prompt>');

    const objectIndex = result.indexOf('<object');
    const promptIndex = result.indexOf('<prompt>');
    expect(objectIndex).toBeLessThan(promptIndex);
  });

  test('should handle missing itemBody gracefully', () => {
    const qtiXml = `<?xml version="1.0"?>
<assessmentItem identifier="item-1">
  <responseDeclaration/>
</assessmentItem>`;

    const warnings: string[] = [];
    const logger = {
      warn: (msg: string) => warnings.push(msg),
    };

    const result = insertPassageObjectReference(
      qtiXml,
      'passage-abc',
      'passages/passage-abc.xml',
      logger
    );

    // Should return unchanged XML and log warning
    expect(result).toBe(qtiXml);
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('should generate valid QTI passage structure', () => {
    const passage: PieModel = {
      id: 'passage-valid',
      element: '@pie-element/passage',
      passages: [
        {
          title: 'Test Passage',
          text: '<p>This is a test passage with <strong>formatted</strong> content.</p>',
        },
      ],
    };

    const xml = generatePassageXml(passage);

    // Verify QTI namespace
    expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"');
    expect(xml).toContain('xsi:schemaLocation');

    // Verify required attributes
    expect(xml).toContain('adaptive="false"');
    expect(xml).toContain('timeDependent="false"');

    // Verify structure
    expect(xml).toContain('<itemBody>');
    expect(xml).toContain('</itemBody>');
    expect(xml).toContain('</assessmentItem>');
  });
});
