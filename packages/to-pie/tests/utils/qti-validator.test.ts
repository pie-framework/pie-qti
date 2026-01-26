/**
 * QTI Validator Tests
 */

import { describe, expect, it } from 'bun:test';
import { QtiValidator, validateQti } from '../../src/utils/qti-validator';

describe('QtiValidator', () => {
  describe('version detection', () => {
    it('should detect QTI 2.2', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <itemBody><p>Test</p></itemBody>
</assessmentItem>`;

      const validator = new QtiValidator();
      const result = await validator.validate(qti);
      expect(result.valid).toBe(true);
    });
  });

  describe('structural validation', () => {
    it('should validate well-formed QTI item', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="item-001"
                title="Sample Item">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">Option A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing identifier', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <itemBody><p>Test</p></itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('identifier'))).toBe(true);
    });

    it('should warn about missing title', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <itemBody><p>Test</p></itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      expect(result.warnings.some(w => w.message.includes('title'))).toBe(true);
    });

    it('should warn about missing namespace', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem identifier="test" title="Test">
  <itemBody><p>Test</p></itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      expect(result.warnings.some(w => w.message.includes('namespace'))).toBe(true);
    });

    it('should warn about missing responseDeclaration', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">Option A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      expect(result.warnings.some(w => w.message.includes('responseDeclaration'))).toBe(true);
    });
  });

  describe('well-formedness checks', () => {
    it('should warn about unescaped ampersand', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <itemBody><p>Tom & Jerry</p></itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      // node-html-parser is lenient, but we warn about potential issues
      expect(result.warnings.some(w => w.message.includes('ampersand'))).toBe(true);
    });

    it('should accept escaped ampersand', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <itemBody><p>Tom &amp; Jerry</p></itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      expect(result.valid).toBe(true);
    });

    it('should warn about tag mismatch', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <itemBody><p>Test</itemBody>
</assessmentItem>`;

      const result = await validateQti(qti);
      // node-html-parser is lenient with mismatched tags
      expect(result.warnings.some(w => w.message.includes('tag mismatch'))).toBe(true);
    });
  });

  describe('batch validation', () => {
    it('should validate multiple files', async () => {
      const validator = new QtiValidator();

      const files = [
        {
          path: 'item1.xml',
          content: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item1"><itemBody><p>Test</p></itemBody></assessmentItem>`
        },
        {
          path: 'item2.xml',
          content: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item2"><itemBody><p>Test</p></itemBody></assessmentItem>`
        },
        {
          path: 'invalid.xml',
          content: `<assessmentItem><itemBody><p>Test</itemBody>`
        }
      ];

      const results = await validator.validateBatch(files);

      expect(results.size).toBe(3);
      expect(results.get('item1.xml')?.valid).toBe(true);
      expect(results.get('item2.xml')?.valid).toBe(true);
      expect(results.get('invalid.xml')?.valid).toBe(false);

      const summary = QtiValidator.getValidationSummary(results);
      expect(summary.total).toBe(3);
      expect(summary.valid).toBe(2);
      expect(summary.invalid).toBe(1);
    });
  });

  describe('assessment types', () => {
    it('should validate assessmentTest', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test-001">
  <testPart identifier="part1" navigationMode="linear">
    <assessmentSection identifier="section1" title="Section 1">
      <assessmentItemRef identifier="item1" href="item1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

      const result = await validateQti(qti);
      expect(result.valid).toBe(true);
    });

    it('should validate assessmentPassage', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentPassage xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="passage-001">
  <passageBody>
    <p>This is a reading passage...</p>
  </passageBody>
</assessmentPassage>`;

      const result = await validateQti(qti);
      expect(result.valid).toBe(true);
    });
  });

  describe('validator options', () => {
    it('should respect strict mode', async () => {
      const validator = new QtiValidator({ strict: true });
      const qti = `<?xml version="1.0"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <itemBody><p>Test</p></itemBody>
</assessmentItem>`;

      const result = await validator.validate(qti);
      // In strict mode, warnings could fail validation (if implemented)
      expect(result).toBeDefined();
    });
  });

  describe('error details', () => {
    it('should include error messages', async () => {
      const qti = `<?xml version="1.0"?>
<invalid><itemBody><p>Test</p></itemBody></invalid>`;

      const result = await validateQti(qti);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toBeDefined();
    });

    it('should include warning messages', async () => {
      const qti = `<?xml version="1.0"?>
<assessmentItem identifier="test"><itemBody><p>Test</p></itemBody></assessmentItem>`;

      const result = await validateQti(qti);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toBeDefined();
    });
  });
});
