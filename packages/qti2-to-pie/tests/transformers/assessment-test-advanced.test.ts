/**
 * Tests for advanced QTI 2.2 assessmentTest features:
 * - Outcome declarations
 * - Template declarations
 * - Template processing
 * - Test feedback
 */

import { describe, expect, it } from 'bun:test';
import { transformAssessmentTest } from '../../src/transformers/assessment-test.js';

describe('Advanced Assessment Features - Outcome Declarations', () => {
  it('should extract outcome declarations from assessmentTest', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean">
    <defaultValue>
      <value>false</value>
    </defaultValue>
  </outcomeDeclaration>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.outcomeDeclarationsXml).toBeDefined();
    expect(result.outcomeDeclarationsXml).toHaveLength(2);
    expect(result.outcomeDeclarationsXml![0]).toContain('identifier="SCORE"');
    expect(result.outcomeDeclarationsXml![0]).toContain('baseType="float"');
    expect(result.outcomeDeclarationsXml![1]).toContain('identifier="PASS"');
    expect(result.outcomeDeclarationsXml![1]).toContain('baseType="boolean"');
  });

  it('should handle assessmentTest without outcome declarations', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.outcomeDeclarationsXml).toBeUndefined();
  });

  it('should extract multiple outcome declarations with different types', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="PERCENTAGE" cardinality="single" baseType="float"/>
  <outcomeDeclaration identifier="GRADE" cardinality="single" baseType="identifier"/>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.outcomeDeclarationsXml).toHaveLength(4);
    expect(result.outcomeDeclarationsXml![2]).toContain('identifier="PERCENTAGE"');
    expect(result.outcomeDeclarationsXml![3]).toContain('identifier="GRADE"');
    expect(result.outcomeDeclarationsXml![3]).toContain('baseType="identifier"');
  });
});

describe('Advanced Assessment Features - Template Declarations', () => {
  it('should extract template declarations from assessmentTest', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <templateDeclaration identifier="DIFFICULTY" cardinality="single" baseType="integer">
    <defaultValue>
      <value>1</value>
    </defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="CORRECT_COUNT" cardinality="single" baseType="integer">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </templateDeclaration>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.templateDeclarationsXml).toBeDefined();
    expect(result.templateDeclarationsXml).toHaveLength(2);
    expect(result.templateDeclarationsXml![0]).toContain('identifier="DIFFICULTY"');
    expect(result.templateDeclarationsXml![0]).toContain('baseType="integer"');
    expect(result.templateDeclarationsXml![1]).toContain('identifier="CORRECT_COUNT"');
  });

  it('should handle assessmentTest without template declarations', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.templateDeclarationsXml).toBeUndefined();
  });

  it('should extract template declaration with multiple cardinality', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <templateDeclaration identifier="ITEM_POOL" cardinality="multiple" baseType="identifier">
    <defaultValue>
      <value>item-1</value>
      <value>item-2</value>
      <value>item-3</value>
    </defaultValue>
  </templateDeclaration>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.templateDeclarationsXml).toHaveLength(1);
    expect(result.templateDeclarationsXml![0]).toContain('identifier="ITEM_POOL"');
    expect(result.templateDeclarationsXml![0]).toContain('cardinality="multiple"');
    expect(result.templateDeclarationsXml![0]).toContain('item-1');
    expect(result.templateDeclarationsXml![0]).toContain('item-2');
  });
});

describe('Advanced Assessment Features - Template Processing', () => {
  it('should extract template processing from assessmentTest', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <templateProcessing>
    <setTemplateValue identifier="DIFFICULTY">
      <baseValue baseType="integer">2</baseValue>
    </setTemplateValue>
  </templateProcessing>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.templateProcessingXml).toBeDefined();
    expect(result.templateProcessingXml).toContain('<templateProcessing>');
    expect(result.templateProcessingXml).toContain('setTemplateValue');
    expect(result.templateProcessingXml).toContain('identifier="DIFFICULTY"');
  });

  it('should handle assessmentTest without template processing', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.templateProcessingXml).toBeUndefined();
  });

  it('should extract complex template processing with multiple operations', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <templateProcessing>
    <setTemplateValue identifier="DIFFICULTY">
      <baseValue baseType="integer">2</baseValue>
    </setTemplateValue>
    <setTemplateValue identifier="ITEM_POOL">
      <random>
        <variable identifier="ITEM_POOL"/>
      </random>
    </setTemplateValue>
    <setTemplateValue identifier="ATTEMPT_COUNT">
      <sum>
        <variable identifier="ATTEMPT_COUNT"/>
        <baseValue baseType="integer">1</baseValue>
      </sum>
    </setTemplateValue>
  </templateProcessing>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.templateProcessingXml).toContain('setTemplateValue');
    expect(result.templateProcessingXml).toContain('DIFFICULTY');
    expect(result.templateProcessingXml).toContain('ITEM_POOL');
    expect(result.templateProcessingXml).toContain('ATTEMPT_COUNT');
    expect(result.templateProcessingXml).toContain('<random>');
    expect(result.templateProcessingXml).toContain('<sum>');
  });
});

describe('Advanced Assessment Features - Test Feedback', () => {
  it('should extract test feedback from assessmentTest', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
  <testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd">
    <div class="feedback success">
      <h3>Congratulations!</h3>
      <p>You passed the test.</p>
    </div>
  </testFeedback>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.testFeedback).toBeDefined();
    expect(result.testFeedback).toHaveLength(1);
    expect(result.testFeedback![0].identifier).toBe('pass-feedback');
    expect(result.testFeedback![0].outcomeIdentifier).toBe('PASS');
    expect(result.testFeedback![0].showHide).toBe('show');
    expect(result.testFeedback![0].access).toBe('atEnd');
    expect(result.testFeedback![0].xml).toContain('<testFeedback');
    expect(result.testFeedback![0].xml).toContain('Congratulations!');
  });

  it('should handle assessmentTest without test feedback', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.testFeedback).toBeUndefined();
  });

  it('should extract multiple test feedback blocks with different conditions', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
  <testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd">
    <div class="feedback success">
      <p>You passed!</p>
    </div>
  </testFeedback>
  <testFeedback identifier="fail-feedback" outcomeIdentifier="PASS" showHide="hide" access="atEnd">
    <div class="feedback warning">
      <p>Keep practicing.</p>
    </div>
  </testFeedback>
  <testFeedback identifier="during-feedback" outcomeIdentifier="SCORE" showHide="show" access="during">
    <div class="feedback info">
      <p>Current progress...</p>
    </div>
  </testFeedback>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.testFeedback).toHaveLength(3);

    // Pass feedback
    expect(result.testFeedback![0].identifier).toBe('pass-feedback');
    expect(result.testFeedback![0].showHide).toBe('show');
    expect(result.testFeedback![0].access).toBe('atEnd');

    // Fail feedback
    expect(result.testFeedback![1].identifier).toBe('fail-feedback');
    expect(result.testFeedback![1].showHide).toBe('hide');
    expect(result.testFeedback![1].access).toBe('atEnd');

    // During feedback
    expect(result.testFeedback![2].identifier).toBe('during-feedback');
    expect(result.testFeedback![2].outcomeIdentifier).toBe('SCORE');
    expect(result.testFeedback![2].access).toBe('during');
  });

  it('should extract test feedback with complex HTML content', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
  <testFeedback identifier="rich-feedback" outcomeIdentifier="SCORE" showHide="show" access="atEnd">
    <div class="feedback">
      <h2>Test Results</h2>
      <p>Your score: <printedVariable identifier="SCORE"/></p>
      <p>Percentage: <printedVariable identifier="PERCENTAGE"/></p>
      <ul>
        <li>Section 1: Complete</li>
        <li>Section 2: Complete</li>
      </ul>
    </div>
  </testFeedback>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.testFeedback).toHaveLength(1);
    expect(result.testFeedback![0].xml).toContain('<h2>Test Results</h2>');
    expect(result.testFeedback![0].xml).toContain('printedVariable identifier="SCORE"');
    expect(result.testFeedback![0].xml).toContain('<ul>');
  });
});

describe('Advanced Assessment Features - Combined Features', () => {
  it('should extract all advanced features together', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Complete Advanced Test">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>
  <templateDeclaration identifier="DIFFICULTY" cardinality="single" baseType="integer">
    <defaultValue>
      <value>1</value>
    </defaultValue>
  </templateDeclaration>
  <templateProcessing>
    <setTemplateValue identifier="DIFFICULTY">
      <baseValue baseType="integer">2</baseValue>
    </setTemplateValue>
  </templateProcessing>
  <testPart identifier="testPart1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE"/>
      </sum>
    </setOutcomeValue>
  </outcomeProcessing>
  <testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd">
    <div>Passed!</div>
  </testFeedback>
  <testFeedback identifier="fail-feedback" outcomeIdentifier="PASS" showHide="hide" access="atEnd">
    <div>Failed.</div>
  </testFeedback>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    // Verify all features extracted
    expect(result.outcomeDeclarationsXml).toBeDefined();
    expect(result.outcomeDeclarationsXml).toHaveLength(2);

    expect(result.templateDeclarationsXml).toBeDefined();
    expect(result.templateDeclarationsXml).toHaveLength(1);

    expect(result.templateProcessingXml).toBeDefined();
    expect(result.templateProcessingXml).toContain('setTemplateValue');

    expect(result.outcomeProcessingXml).toBeDefined();
    expect(result.outcomeProcessingXml).toContain('setOutcomeValue');

    expect(result.testFeedback).toBeDefined();
    expect(result.testFeedback).toHaveLength(2);

    // Verify basic assessment structure
    expect(result.title).toBe('Complete Advanced Test');
    expect(result.sections).toHaveLength(1);
  });

  it('should preserve correct XML nesting for all features', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <templateDeclaration identifier="VAR1" cardinality="single" baseType="integer"/>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    // Verify preserved XML is valid and complete
    expect(result.outcomeDeclarationsXml![0]).toContain('<outcomeDeclaration');
    expect(result.outcomeDeclarationsXml![0]).toContain('identifier="SCORE"');

    expect(result.templateDeclarationsXml![0]).toContain('<templateDeclaration');
    expect(result.templateDeclarationsXml![0]).toContain('identifier="VAR1"');
  });
});

describe('Advanced Assessment Features - Edge Cases', () => {
  it('should handle empty default values in declarations', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    expect(result.outcomeDeclarationsXml).toHaveLength(1);
    expect(result.outcomeDeclarationsXml![0]).toContain('identifier="SCORE"');
  });

  it('should handle test feedback with missing optional attributes', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
  <testFeedback identifier="feedback-1" outcomeIdentifier="SCORE">
    <div>Feedback</div>
  </testFeedback>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    // Should not extract feedback with missing required attributes
    expect(result.testFeedback).toBeUndefined();
  });

  it('should only extract direct children declarations (not nested)', () => {
    const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="test-1" title="Test 1">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <templateProcessing>
    <outcomeDeclaration identifier="NESTED" cardinality="single" baseType="float"/>
  </templateProcessing>
  <testPart identifier="testPart1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true" fixed="false">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml" required="true" fixed="false"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

    const result = transformAssessmentTest(qtiXml, 'test-1');

    // Should only extract the direct child SCORE declaration, not the nested one
    expect(result.outcomeDeclarationsXml).toHaveLength(1);
    expect(result.outcomeDeclarationsXml![0]).toContain('identifier="SCORE"');
    expect(result.outcomeDeclarationsXml![0]).not.toContain('identifier="NESTED"');
  });
});
