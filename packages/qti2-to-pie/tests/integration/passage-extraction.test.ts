/**
 * Passage Extraction Integration Tests
 *
 * Tests QTI → PIE transformation with external passage references
 */

import { describe, expect, test } from 'bun:test';
import type { TransformContext } from '@pie-framework/transform-types';
import { Qti22ToPiePlugin } from '../../src/plugin.js';

describe('Passage Extraction (QTI → PIE)', () => {
  const plugin = new Qti22ToPiePlugin();
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

    // Should populate passage property with passage ID
    expect(pieItem.passage).toBe('passage-123');

    // Should also add passage model to config.models
    expect(pieItem.config.models.length).toBe(2); // passage + mc
    expect(pieItem.config.models[0].element).toBe('@pie-element/passage');
  });

  test('should handle object tag without data-pie-passage-id attribute', async () => {
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

    // Should generate stable ID from file path
    expect(pieItem.passage).toBeTruthy();
    expect(typeof pieItem.passage).toBe('string');

    // Should contain normalized file path
    expect(pieItem.passage).toContain('passage');
    expect(pieItem.passage).toContain('another-passage');
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
    expect(pieItem.config.models[0].element).toBe('@pie-element/passage');
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
    expect(pieItem.config.models[0].element).toBe('@pie-element/multiple-choice');
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

    // Should populate passage property
    expect(pieItem.passage).toBe('science-123');

    // Should have passage + ER models
    expect(pieItem.config.models.length).toBe(2);
    expect(pieItem.config.models[0].element).toBe('@pie-element/passage');
    expect(pieItem.config.models[1].element).toBe('@pie-element/extended-text-entry');
  });

  test('should preserve object data path in passage model', async () => {
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

    // Passage property should be derived from file path
    expect(pieItem.passage).toBeTruthy();

    // Passage model should indicate it's external
    const passageModel = pieItem.config.models.find(m => m.element === '@pie-element/passage');
    expect(passageModel).toBeTruthy();
    expect(passageModel.passages[0].text).toContain('External passage');
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

    const plugin = new Qti22ToPiePlugin();
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
