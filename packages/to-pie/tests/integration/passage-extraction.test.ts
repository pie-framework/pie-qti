/**
 * Passage Extraction Integration Tests
 *
 * Tests QTI → PIE transformation with external passage references
 */

import { describe, expect, test } from 'bun:test';
import type { TransformContext } from '@pie-qti/transform-types';
import { QtiToPiePlugin } from '../../src/plugin.js';

describe('Passage Extraction (QTI → PIE)', () => {
  const plugin = new QtiToPiePlugin();
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
  const context: TransformContext = { logger: mockLogger };

  test('should extract external passage reference from object tag', async () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item-with-passage"
                title="Question with Passage">
  <itemBody>
    <object data="passages/passage-123.xml"
            type="text/html"
            data-pie-passage-id="passage-123">
      <p>Passage content not available</p>
    </object>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>What is the main idea?</prompt>
      <simpleChoice identifier="A">Choice A</simpleChoice>
      <simpleChoice identifier="B">Choice B</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
</assessmentItem>`;

    const result = await plugin.transform({ content: qtiXml }, context);

    expect(result.items.length).toBe(1);
    const pieItem = result.items[0].content;

    expect(pieItem.passage).toBe('passage-123');
    expect(pieItem.metadata.qtiPassageReferences).toEqual([
      { identifier: 'passage-123', href: 'passages/passage-123.xml', via: 'object' },
    ]);
    expect(pieItem.config.models.map((model) => model.element)).toEqual(['multiple-choice']);
    expect(pieItem.config.models[0].prompt).not.toContain('<object');
  });

  test('should leave an object without data-pie-passage-id in the prompt and report it', async () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item-ref"
                title="Question">
  <itemBody>
    <object data="passages/another-passage.xml" type="text/html">
      <p>Fallback</p>
    </object>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Question?</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
</assessmentItem>`;

    const result = await plugin.transform({ content: qtiXml }, context);

    expect(result.items.length).toBe(1);
    const pieItem = result.items[0].content;

    expect(pieItem.passage).toBeUndefined();
    expect(pieItem.config.models[0].prompt).toContain('<object data="passages/another-passage.xml"');
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'QTI_PASSAGE_UNRESOLVED', path: 'passages/another-passage.xml' })
    );
  });

  test('should NOT populate passage property for inline stimulus', async () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item-inline"
                title="Question with Inline Stimulus">
  <itemBody>
    <stimulus>
      <p>This is inline passage content embedded in the item.</p>
    </stimulus>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Question about the passage?</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
</assessmentItem>`;

    const result = await plugin.transform({ content: qtiXml }, context);

    expect(result.items.length).toBe(1);
    const pieItem = result.items[0].content;

    // Inline stimulus should NOT populate passage property
    expect(pieItem.passage).toBeUndefined();

    // But should still add passage model to config.models
    expect(pieItem.config.models.length).toBe(2); // passage + mc
    expect(pieItem.config.models[0].element).toBe('passage');
  });

  test('should handle item without any passage', async () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item-no-passage"
                title="Simple Question">
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>What is 2+2?</prompt>
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>B</value>
    </correctResponse>
  </responseDeclaration>
</assessmentItem>`;

    const result = await plugin.transform({ content: qtiXml }, context);

    expect(result.items.length).toBe(1);
    const pieItem = result.items[0].content;

    // No passage property
    expect(pieItem.passage).toBeUndefined();

    // Only MC model in config.models
    expect(pieItem.config.models.length).toBe(1);
    expect(pieItem.config.models[0].element).toBe('multiple-choice');
  });

  test('should work with extended-response items', async () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="er-with-passage"
                title="ER with Passage">
  <itemBody>
    <object data="passages/science-passage.xml"
            type="text/html"
            data-pie-passage-id="science-123">
      <p>Science passage not available</p>
    </object>

    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="5">
      <prompt>Explain the process described in the passage.</prompt>
    </extendedTextInteraction>
  </itemBody>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
</assessmentItem>`;

    const result = await plugin.transform({ content: qtiXml }, context);

    expect(result.items.length).toBe(1);
    const pieItem = result.items[0].content;

    expect(pieItem.passage).toBe('science-123');
    expect(pieItem.config.models.map((model) => model.element)).toEqual(['extended-text-entry']);
  });

  test('should report a self-closing object the item cannot resolve', async () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item-check-path"
                title="Check Path">
  <itemBody>
    <object data="passages/chapter3/reading-comprehension.xml" type="text/html"/>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Q?</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
</assessmentItem>`;

    const result = await plugin.transform({ content: qtiXml }, context);

    expect(result.items.length).toBe(1);
    const pieItem = result.items[0].content;

    expect(pieItem.passage).toBeUndefined();
    expect(pieItem.config.models.map((model) => model.element)).toEqual(['multiple-choice']);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'QTI_PASSAGE_UNRESOLVED',
        path: 'passages/chapter3/reading-comprehension.xml',
      })
    );
  });
});

describe('Round-Trip Compatibility (PIE → QTI → PIE)', () => {
  test('should preserve passage ID through round-trip', async () => {
    // This test documents the expected round-trip behavior:
    // 1. PIE item with passage: "passage-abc"
    // 2. Transform to QTI (pie-to-qti2): <object data="passages/passage-abc.xml" data-pie-passage-id="passage-abc">
    // 3. Transform back to PIE (qti2-to-pie): passage: "passage-abc"

    // We're verifying step 3 here - the QTI has the object tag with data-pie-passage-id
    const qtiFromPieToQti2 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item-roundtrip"
                title="Round-trip Test">
  <itemBody>
    <object data="passages/passage-abc.xml"
            type="text/html"
            data-pie-passage-id="passage-abc">
      <p>Passage content not available</p>
    </object>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Test question</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
</assessmentItem>`;

    const plugin = new QtiToPiePlugin();
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };
    const context: TransformContext = { logger: mockLogger };

    const result = await plugin.transform({ content: qtiFromPieToQti2 }, context);

    expect(result.items.length).toBe(1);
    const pieItem = result.items[0].content;

    // Original passage ID should be preserved
    expect(pieItem.passage).toBe('passage-abc');
  });
});
