/**
 * Tests for PIE → QTI advanced assessment features generation:
 * - Outcome declarations
 * - Template declarations
 * - Template processing
 * - Test feedback
 */

import { describe, expect, it } from 'bun:test';
import { PieToQti2Plugin } from '../../src/plugin.js';

describe('PIE → QTI Advanced Features - Outcome Declarations', () => {
  it('should preserve outcome declarations in generated QTI', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Test with Outcomes',
      outcomeDeclarationsXml: [
        `<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`,
        `<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>`
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [
            {
              identifier: 'item-1',
              href: 'items/item-1.xml',
              required: true
            }
          ]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('<outcomeDeclaration identifier="SCORE"');
    expect(qtiXml).toContain('baseType="float"');
    expect(qtiXml).toContain('<outcomeDeclaration identifier="PASS"');
    expect(qtiXml).toContain('baseType="boolean"');

    // Verify outcome declarations appear before testPart
    const outcomeIndex = qtiXml.indexOf('<outcomeDeclaration');
    const testPartIndex = qtiXml.indexOf('<testPart');
    expect(outcomeIndex).toBeLessThan(testPartIndex);
  });

  it('should handle assessment without outcome declarations', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Simple Test',
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [
            {
              identifier: 'item-1',
              href: 'items/item-1.xml',
              required: true
            }
          ]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).not.toContain('<outcomeDeclaration');
    expect(qtiXml).toContain('<assessmentTest');
    expect(qtiXml).toContain('<testPart');
  });

  it('should preserve multiple outcome declarations', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Test with Multiple Outcomes',
      outcomeDeclarationsXml: [
        '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>',
        '<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>',
        '<outcomeDeclaration identifier="PERCENTAGE" cardinality="single" baseType="float"/>',
        '<outcomeDeclaration identifier="GRADE" cardinality="single" baseType="identifier"/>'
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('identifier="SCORE"');
    expect(qtiXml).toContain('identifier="PASS"');
    expect(qtiXml).toContain('identifier="PERCENTAGE"');
    expect(qtiXml).toContain('identifier="GRADE"');
  });
});

describe('PIE → QTI Advanced Features - Template Declarations', () => {
  it('should preserve template declarations in generated QTI', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Adaptive Test',
      templateDeclarationsXml: [
        `<templateDeclaration identifier="DIFFICULTY" cardinality="single" baseType="integer">
  <defaultValue>
    <value>1</value>
  </defaultValue>
</templateDeclaration>`,
        '<templateDeclaration identifier="CORRECT_COUNT" cardinality="single" baseType="integer"/>'
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('<templateDeclaration identifier="DIFFICULTY"');
    expect(qtiXml).toContain('baseType="integer"');
    expect(qtiXml).toContain('<templateDeclaration identifier="CORRECT_COUNT"');

    // Verify template declarations appear before testPart
    const templateIndex = qtiXml.indexOf('<templateDeclaration');
    const testPartIndex = qtiXml.indexOf('<testPart');
    expect(templateIndex).toBeLessThan(testPartIndex);
  });

  it('should handle assessment without template declarations', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Non-Adaptive Test',
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).not.toContain('<templateDeclaration');
  });

  it('should preserve template declaration with multiple cardinality', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Test with Item Pool',
      templateDeclarationsXml: [
        `<templateDeclaration identifier="ITEM_POOL" cardinality="multiple" baseType="identifier">
  <defaultValue>
    <value>item-1</value>
    <value>item-2</value>
    <value>item-3</value>
  </defaultValue>
</templateDeclaration>`
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('identifier="ITEM_POOL"');
    expect(qtiXml).toContain('cardinality="multiple"');
    expect(qtiXml).toContain('<value>item-1</value>');
    expect(qtiXml).toContain('<value>item-2</value>');
  });
});

describe('PIE → QTI Advanced Features - Template Processing', () => {
  it('should preserve template processing in generated QTI', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Adaptive Test',
      templateProcessingXml: `<templateProcessing>
  <setTemplateValue identifier="DIFFICULTY">
    <baseValue baseType="integer">2</baseValue>
  </setTemplateValue>
</templateProcessing>`,
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('<templateProcessing>');
    expect(qtiXml).toContain('setTemplateValue');
    expect(qtiXml).toContain('identifier="DIFFICULTY"');

    // Verify template processing appears after testPart
    const testPartIndex = qtiXml.lastIndexOf('</testPart>');
    const templateProcessingIndex = qtiXml.indexOf('<templateProcessing>');
    expect(templateProcessingIndex).toBeGreaterThan(testPartIndex);
  });

  it('should handle assessment without template processing', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Test',
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).not.toContain('<templateProcessing>');
  });

  it('should preserve complex template processing', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Complex Adaptive Test',
      templateProcessingXml: `<templateProcessing>
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
</templateProcessing>`,
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('DIFFICULTY');
    expect(qtiXml).toContain('ITEM_POOL');
    expect(qtiXml).toContain('ATTEMPT_COUNT');
    expect(qtiXml).toContain('<random>');
    expect(qtiXml).toContain('<sum>');
  });
});

describe('PIE → QTI Advanced Features - Test Feedback', () => {
  it('should preserve test feedback in generated QTI', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Test with Feedback',
      testFeedback: [
        {
          identifier: 'pass-feedback',
          outcomeIdentifier: 'PASS',
          showHide: 'show',
          access: 'atEnd',
          xml: `<testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd">
  <div class="feedback success">
    <p>You passed!</p>
  </div>
</testFeedback>`
        }
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('<testFeedback');
    expect(qtiXml).toContain('identifier="pass-feedback"');
    expect(qtiXml).toContain('outcomeIdentifier="PASS"');
    expect(qtiXml).toContain('showHide="show"');
    expect(qtiXml).toContain('access="atEnd"');
    expect(qtiXml).toContain('You passed!');

    // Verify test feedback appears after testPart
    const testPartIndex = qtiXml.lastIndexOf('</testPart>');
    const feedbackIndex = qtiXml.indexOf('<testFeedback');
    expect(feedbackIndex).toBeGreaterThan(testPartIndex);
  });

  it('should handle assessment without test feedback', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Test',
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).not.toContain('<testFeedback');
  });

  it('should preserve multiple test feedback blocks', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Test with Multiple Feedback',
      testFeedback: [
        {
          identifier: 'pass-feedback',
          outcomeIdentifier: 'PASS',
          showHide: 'show',
          access: 'atEnd',
          xml: '<testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd"><div>Passed!</div></testFeedback>'
        },
        {
          identifier: 'fail-feedback',
          outcomeIdentifier: 'PASS',
          showHide: 'hide',
          access: 'atEnd',
          xml: '<testFeedback identifier="fail-feedback" outcomeIdentifier="PASS" showHide="hide" access="atEnd"><div>Failed.</div></testFeedback>'
        },
        {
          identifier: 'during-feedback',
          outcomeIdentifier: 'SCORE',
          showHide: 'show',
          access: 'during',
          xml: '<testFeedback identifier="during-feedback" outcomeIdentifier="SCORE" showHide="show" access="during"><div>Progress...</div></testFeedback>'
        }
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    expect(qtiXml).toContain('identifier="pass-feedback"');
    expect(qtiXml).toContain('identifier="fail-feedback"');
    expect(qtiXml).toContain('identifier="during-feedback"');
    expect(qtiXml).toContain('access="atEnd"');
    expect(qtiXml).toContain('access="during"');
  });
});

describe('PIE → QTI Advanced Features - Combined Features', () => {
  it('should preserve all advanced features in correct QTI structure', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Complete Advanced Test',
      outcomeDeclarationsXml: [
        '<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>',
        '<outcomeDeclaration identifier="PASS" cardinality="single" baseType="boolean"/>'
      ],
      templateDeclarationsXml: [
        '<templateDeclaration identifier="DIFFICULTY" cardinality="single" baseType="integer"/>'
      ],
      templateProcessingXml: '<templateProcessing><setTemplateValue identifier="DIFFICULTY"><baseValue baseType="integer">2</baseValue></setTemplateValue></templateProcessing>',
      outcomeProcessingXml: '<outcomeProcessing><setOutcomeValue identifier="SCORE"><sum><testVariables variableIdentifier="SCORE"/></sum></setOutcomeValue></outcomeProcessing>',
      testFeedback: [
        {
          identifier: 'pass-feedback',
          outcomeIdentifier: 'PASS',
          showHide: 'show',
          access: 'atEnd',
          xml: '<testFeedback identifier="pass-feedback" outcomeIdentifier="PASS" showHide="show" access="atEnd"><div>Passed!</div></testFeedback>'
        }
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [{ identifier: 'item-1', href: 'items/item-1.xml', required: true }]
        }
      ]
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    // Verify all features present
    expect(qtiXml).toContain('<outcomeDeclaration');
    expect(qtiXml).toContain('<templateDeclaration');
    expect(qtiXml).toContain('<templateProcessing>');
    expect(qtiXml).toContain('<outcomeProcessing>');
    expect(qtiXml).toContain('<testFeedback');

    // Verify correct ordering (QTI 2.2 structure)
    const outcomeIndex = qtiXml.indexOf('<outcomeDeclaration');
    const templateIndex = qtiXml.indexOf('<templateDeclaration');
    const testPartIndex = qtiXml.indexOf('<testPart');
    const outcomeProcessingIndex = qtiXml.indexOf('<outcomeProcessing>');
    const templateProcessingIndex = qtiXml.indexOf('<templateProcessing>');
    const feedbackIndex = qtiXml.indexOf('<testFeedback');

    // Declarations before testPart
    expect(outcomeIndex).toBeLessThan(testPartIndex);
    expect(templateIndex).toBeLessThan(testPartIndex);

    // Processing and feedback after testPart
    const testPartEndIndex = qtiXml.lastIndexOf('</testPart>');
    expect(outcomeProcessingIndex).toBeGreaterThan(testPartEndIndex);
    expect(templateProcessingIndex).toBeGreaterThan(testPartEndIndex);
    expect(feedbackIndex).toBeGreaterThan(testPartEndIndex);
  });

  it('should generate valid QTI XML with all advanced features', async () => {
    const pieAssessment = {
      id: 'test-1',
      title: 'Complete Test',
      metadata: {
        navigationMode: 'nonlinear',
        submissionMode: 'simultaneous'
      },
      outcomeDeclarationsXml: [
        `<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
  <defaultValue>
    <value>0</value>
  </defaultValue>
</outcomeDeclaration>`
      ],
      templateDeclarationsXml: [
        `<templateDeclaration identifier="DIFFICULTY" cardinality="single" baseType="integer">
  <defaultValue>
    <value>1</value>
  </defaultValue>
</templateDeclaration>`
      ],
      templateProcessingXml: `<templateProcessing>
  <setTemplateValue identifier="DIFFICULTY">
    <baseValue baseType="integer">2</baseValue>
  </setTemplateValue>
</templateProcessing>`,
      outcomeProcessingXml: `<outcomeProcessing>
  <setOutcomeValue identifier="SCORE">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>`,
      testFeedback: [
        {
          identifier: 'feedback-1',
          outcomeIdentifier: 'SCORE',
          showHide: 'show',
          access: 'atEnd',
          xml: `<testFeedback identifier="feedback-1" outcomeIdentifier="SCORE" showHide="show" access="atEnd">
  <div class="feedback">
    <h2>Results</h2>
    <p>Score: <printedVariable identifier="SCORE"/></p>
  </div>
</testFeedback>`
        }
      ],
      sections: [
        {
          id: 's1',
          identifier: 'section-1',
          title: 'Section 1',
          visible: true,
          fixed: false,
          shuffle: false,
          itemRefs: [
            {
              identifier: 'item-1',
              href: 'items/item-1.xml',
              required: true,
              weight: 2.0
            }
          ]
        }
      ],
      timeLimits: {
        maxTime: 3600,
        allowLateSubmission: false
      }
    };

    const plugin = new PieToQti2Plugin();
    const result = await plugin.transform({ content: pieAssessment }, { logger: console });
    const qtiXml = result.items[0].content;

    // Verify XML structure
    expect(qtiXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(qtiXml).toContain('<assessmentTest');
    expect(qtiXml).toContain('xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"');
    expect(qtiXml).toContain('</assessmentTest>');

    // Verify all content preserved
    expect(qtiXml).toContain('navigationMode="nonlinear"');
    expect(qtiXml).toContain('submissionMode="simultaneous"');
    expect(qtiXml).toContain('maxTime="3600"');
    expect(qtiXml).toContain('identifier="SCORE"');
    expect(qtiXml).toContain('identifier="DIFFICULTY"');
    expect(qtiXml).toContain('<printedVariable identifier="SCORE"/>');
  });
});
