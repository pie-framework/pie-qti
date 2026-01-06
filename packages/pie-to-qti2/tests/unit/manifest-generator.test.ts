/**
 * Manifest Generator Tests
 *
 * Tests IMS Content Package manifest generation
 */

import { describe, expect, test } from 'bun:test';
import {
  buildManifest,
  generateAssessmentManifest,
  generateBatchManifest,
  generateManifest,
  generateSingleItemManifest,
} from '../../src/generators/manifest-generator.js';
import type { ManifestInput } from '../../src/types/manifest.js';

describe('Manifest Generator', () => {
  test('should generate basic manifest for single item', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have XML declaration
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');

    // Should have manifest root with namespaces
    expect(xml).toContain('<manifest');
    expect(xml).toContain('xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"');
    expect(xml).toContain('xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2"');

    // Should have resources section
    expect(xml).toContain('<resources>');
    expect(xml).toContain('</resources>');

    // Should have item resource
    expect(xml).toContain('identifier="item-1"');
    expect(xml).toContain('type="imsqti_item_xmlv2p2"');
    expect(xml).toContain('href="items/item-1.xml"');

    // Should have file entry
    expect(xml).toContain('<file href="items/item-1.xml"/>');
  });

  test('should generate manifest with passage dependencies', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
          dependencies: ['passage-abc'],
        },
      ],
      passages: [
        {
          id: 'passage-abc',
          filePath: 'passages/passage-abc.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have passage resource
    expect(xml).toContain('identifier="passage-abc"');
    expect(xml).toContain('href="passages/passage-abc.xml"');

    // Should have dependency declaration
    expect(xml).toContain('<dependency identifierref="passage-abc"/>');
  });

  test('should generate manifest for multiple items', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
        },
        {
          id: 'item-2',
          filePath: 'items/item-2.xml',
        },
        {
          id: 'item-3',
          filePath: 'items/item-3.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have all three items
    expect(xml).toContain('identifier="item-1"');
    expect(xml).toContain('identifier="item-2"');
    expect(xml).toContain('identifier="item-3"');
  });

  test('should handle shared passages (deduplication)', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
          dependencies: ['passage-shared'],
        },
        {
          id: 'item-2',
          filePath: 'items/item-2.xml',
          dependencies: ['passage-shared'],
        },
      ],
      passages: [
        {
          id: 'passage-shared',
          filePath: 'passages/passage-shared.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Passage should appear only once
    const passageMatches = xml.match(/identifier="passage-shared"/g);
    expect(passageMatches).toBeTruthy();
    expect(passageMatches!.length).toBe(1); // Only in passage resource, not duplicated

    // Both items should reference it
    const dependencyMatches = xml.match(/identifierref="passage-shared"/g);
    expect(dependencyMatches).toBeTruthy();
    expect(dependencyMatches!.length).toBe(2); // Referenced by both items
  });

  test('should include custom metadata', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
        },
      ],
      options: {
        metadata: {
          title: 'Test Package',
          description: 'A test content package',
        },
      },
    };

    const xml = generateManifest(input);

    // Should have metadata section
    expect(xml).toContain('<metadata>');
    expect(xml).toContain('</metadata>');
    expect(xml).toContain('<schema>IMS Content</schema>');
  });

  test('should use custom package ID', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
        },
      ],
      options: {
        packageId: 'custom-package-id',
      },
    };

    const xml = generateManifest(input);

    // Should use custom ID
    expect(xml).toContain('<manifest identifier="custom-package-id"');
  });

  test('should escape XML special characters', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-with-&-<>-chars',
          filePath: 'items/item-with-special.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should escape special chars
    expect(xml).toContain('identifier="item-with-&amp;-&lt;&gt;-chars"');
  });

  test('should include empty organizations section', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have empty organizations (QTI items don't require navigation)
    expect(xml).toContain('<organizations/>');
  });

  test('should order passages before items in resources', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
          dependencies: ['passage-abc'],
        },
      ],
      passages: [
        {
          id: 'passage-abc',
          filePath: 'passages/passage-abc.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Passage resource should appear before item resource
    const passageIndex = xml.indexOf('identifier="passage-abc"');
    const itemIndex = xml.indexOf('identifier="item-1"');

    expect(passageIndex).toBeLessThan(itemIndex);
  });

  test('should handle item with multiple passage dependencies', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
          dependencies: ['passage-1', 'passage-2', 'passage-3'],
        },
      ],
      passages: [
        {
          id: 'passage-1',
          filePath: 'passages/passage-1.xml',
        },
        {
          id: 'passage-2',
          filePath: 'passages/passage-2.xml',
        },
        {
          id: 'passage-3',
          filePath: 'passages/passage-3.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have all passage resources
    expect(xml).toContain('identifier="passage-1"');
    expect(xml).toContain('identifier="passage-2"');
    expect(xml).toContain('identifier="passage-3"');

    // Should have all dependencies
    expect(xml).toContain('identifierref="passage-1"');
    expect(xml).toContain('identifierref="passage-2"');
    expect(xml).toContain('identifierref="passage-3"');
  });

  test('buildManifest should create structured manifest object', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
          dependencies: ['passage-abc'],
        },
      ],
      passages: [
        {
          id: 'passage-abc',
          filePath: 'passages/passage-abc.xml',
        },
      ],
    };

    const manifest = buildManifest(input);

    // Should have identifier
    expect(manifest.identifier).toBeTruthy();

    // Should have resources
    expect(manifest.resources.length).toBe(2); // 1 passage + 1 item

    // First resource should be passage
    expect(manifest.resources[0].identifier).toBe('passage-abc');
    expect(manifest.resources[0].type).toBe('imsqti_item_xmlv2p2');

    // Second resource should be item with dependency
    expect(manifest.resources[1].identifier).toBe('item-1');
    expect(manifest.resources[1].dependencies).toBeTruthy();
    expect(manifest.resources[1].dependencies![0].identifierref).toBe('passage-abc');
  });

  test('generateSingleItemManifest convenience function', () => {
    const passagePaths = new Map<string, string>();
    passagePaths.set('passage-1', 'passages/passage-1.xml');

    const xml = generateSingleItemManifest(
      'item-abc',
      'items/item-abc.xml',
      ['passage-1'],
      passagePaths,
      { packageId: 'test-pkg' }
    );

    // Should have item
    expect(xml).toContain('identifier="item-abc"');

    // Should have passage
    expect(xml).toContain('identifier="passage-1"');

    // Should have dependency
    expect(xml).toContain('identifierref="passage-1"');

    // Should use custom package ID
    expect(xml).toContain('<manifest identifier="test-pkg"');
  });

  test('generateBatchManifest convenience function', () => {
    const items = [
      { id: 'item-1', filePath: 'items/item-1.xml', dependencies: ['passage-shared'] },
      { id: 'item-2', filePath: 'items/item-2.xml', dependencies: ['passage-shared'] },
    ];

    const passages = [
      { id: 'passage-shared', filePath: 'passages/passage-shared.xml' },
    ];

    const xml = generateBatchManifest(items, passages);

    // Should have both items
    expect(xml).toContain('identifier="item-1"');
    expect(xml).toContain('identifier="item-2"');

    // Should have shared passage once
    const passageMatches = xml.match(/identifier="passage-shared"/g);
    expect(passageMatches!.length).toBe(1);

    // Both items should depend on it
    const dependencyMatches = xml.match(/identifierref="passage-shared"/g);
    expect(dependencyMatches!.length).toBe(2);
  });

  test('should handle item without dependencies', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'standalone-item',
          filePath: 'items/standalone.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should not have dependency element
    expect(xml).not.toContain('<dependency');

    // Should have item resource
    expect(xml).toContain('identifier="standalone-item"');
  });

  test('should handle additional files for resources', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-with-images',
          filePath: 'items/item-1.xml',
          files: ['images/photo.jpg', 'styles/custom.css'],
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have main file
    expect(xml).toContain('<file href="items/item-1.xml"/>');

    // Should have additional files
    expect(xml).toContain('<file href="images/photo.jpg"/>');
    expect(xml).toContain('<file href="styles/custom.css"/>');
  });

  test('should generate manifest with assessment resource', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
        },
        {
          id: 'item-2',
          filePath: 'items/item-2.xml',
        },
      ],
      assessments: [
        {
          id: 'test-1',
          filePath: 'assessments/test-1.xml',
          dependencies: ['item-1', 'item-2'],
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have assessment resource
    expect(xml).toContain('identifier="test-1"');
    expect(xml).toContain('type="imsqti_assessment_xmlv2p2"');
    expect(xml).toContain('href="assessments/test-1.xml"');

    // Should have item dependencies
    expect(xml).toContain('identifierref="item-1"');
    expect(xml).toContain('identifierref="item-2"');
  });

  test('should order resources correctly (passages, items, assessments)', () => {
    const input: ManifestInput = {
      items: [
        {
          id: 'item-1',
          filePath: 'items/item-1.xml',
          dependencies: ['passage-1'],
        },
      ],
      passages: [
        {
          id: 'passage-1',
          filePath: 'passages/passage-1.xml',
        },
      ],
      assessments: [
        {
          id: 'test-1',
          filePath: 'assessments/test-1.xml',
          dependencies: ['item-1'],
        },
      ],
    };

    const xml = generateManifest(input);

    // Get positions
    const passageIndex = xml.indexOf('identifier="passage-1"');
    const itemIndex = xml.indexOf('identifier="item-1"');
    const assessmentIndex = xml.indexOf('identifier="test-1"');

    // Verify order: passages < items < assessments
    expect(passageIndex).toBeLessThan(itemIndex);
    expect(itemIndex).toBeLessThan(assessmentIndex);
  });

  test('generateAssessmentManifest convenience function', () => {
    const items = [
      { id: 'item-1', filePath: 'items/item-1.xml', dependencies: ['passage-1'] },
      { id: 'item-2', filePath: 'items/item-2.xml' },
    ];

    const passages = [
      { id: 'passage-1', filePath: 'passages/passage-1.xml' },
    ];

    const xml = generateAssessmentManifest(
      'final-exam',
      'assessments/final-exam.xml',
      items,
      passages,
      { packageId: 'final-exam-pkg' }
    );

    // Should have assessment
    expect(xml).toContain('identifier="final-exam"');
    expect(xml).toContain('type="imsqti_assessment_xmlv2p2"');

    // Should have both items
    expect(xml).toContain('identifier="item-1"');
    expect(xml).toContain('identifier="item-2"');

    // Should have passage
    expect(xml).toContain('identifier="passage-1"');

    // Assessment should depend on items
    expect(xml).toContain('identifierref="item-1"');
    expect(xml).toContain('identifierref="item-2"');

    // Use custom package ID
    expect(xml).toContain('<manifest identifier="final-exam-pkg"');
  });

  test('should handle assessment without items', () => {
    const input: ManifestInput = {
      items: [],
      assessments: [
        {
          id: 'empty-test',
          filePath: 'assessments/empty-test.xml',
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have assessment
    expect(xml).toContain('identifier="empty-test"');
    expect(xml).toContain('type="imsqti_assessment_xmlv2p2"');

    // Should not have dependencies
    expect(xml).not.toContain('<dependency');
  });

  test('should handle multiple assessments', () => {
    const input: ManifestInput = {
      items: [
        { id: 'item-1', filePath: 'items/item-1.xml' },
        { id: 'item-2', filePath: 'items/item-2.xml' },
      ],
      assessments: [
        {
          id: 'test-a',
          filePath: 'assessments/test-a.xml',
          dependencies: ['item-1'],
        },
        {
          id: 'test-b',
          filePath: 'assessments/test-b.xml',
          dependencies: ['item-2'],
        },
      ],
    };

    const xml = generateManifest(input);

    // Should have both assessments
    expect(xml).toContain('identifier="test-a"');
    expect(xml).toContain('identifier="test-b"');

    // Should have correct dependencies
    const testABlock = xml.substring(
      xml.indexOf('identifier="test-a"'),
      xml.indexOf('</resource>', xml.indexOf('identifier="test-a"'))
    );
    const testBBlock = xml.substring(
      xml.indexOf('identifier="test-b"'),
      xml.indexOf('</resource>', xml.indexOf('identifier="test-b"'))
    );

    expect(testABlock).toContain('identifierref="item-1"');
    expect(testABlock).not.toContain('identifierref="item-2"');

    expect(testBBlock).toContain('identifierref="item-2"');
    expect(testBBlock).not.toContain('identifierref="item-1"');
  });
});
