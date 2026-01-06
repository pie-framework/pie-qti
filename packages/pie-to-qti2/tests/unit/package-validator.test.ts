/**
 * Package Validator Tests
 *
 * Tests for IMS Content Package validation utilities
 */

import { describe, expect, test } from 'bun:test';
import { generateManifest } from '../../src/generators/manifest-generator.js';
import type { ManifestInput } from '../../src/types/manifest.js';
import {
  validateGeneratedManifest,
  validateManifestInput,
  validatePackage,
} from '../../src/utils/package-validator.js';

describe('Package Validator', () => {
  describe('validateManifestInput', () => {
    test('should validate valid input with items only', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should validate valid input with items and passages', () => {
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
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should validate valid input with assessments', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
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

      const result = validateManifestInput(input);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should error on missing items', () => {
      const input: ManifestInput = {
        items: [],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('NO_ITEMS');
    });

    test('should error on duplicate item IDs', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
          {
            id: 'item-1', // Duplicate
            filePath: 'items/item-1-copy.xml',
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      const duplicateError = result.errors.find(e => e.code === 'DUPLICATE_ITEM_ID');
      expect(duplicateError).toBeTruthy();
    });

    test('should error on missing item file path', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: '',
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      const missingPathError = result.errors.find(e => e.code === 'MISSING_ITEM_PATH');
      expect(missingPathError).toBeTruthy();
    });

    test('should error on missing passage dependency', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
            dependencies: ['passage-nonexistent'],
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      const missingDepError = result.errors.find(e => e.code === 'MISSING_PASSAGES');
      expect(missingDepError).toBeTruthy();
    });

    test('should error on referencing non-existent passage', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
            dependencies: ['passage-nonexistent'],
          },
        ],
        passages: [
          {
            id: 'passage-1',
            filePath: 'passages/passage-1.xml',
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      const missingDepError = result.errors.find(e => e.code === 'MISSING_PASSAGE_DEPENDENCY');
      expect(missingDepError).toBeTruthy();
      expect(missingDepError?.message).toContain('passage-nonexistent');
    });

    test('should error on missing assessment item dependency', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
        ],
        assessments: [
          {
            id: 'test-1',
            filePath: 'assessments/test-1.xml',
            dependencies: ['item-nonexistent'],
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      const missingDepError = result.errors.find(e => e.code === 'MISSING_ITEM_DEPENDENCY');
      expect(missingDepError).toBeTruthy();
      expect(missingDepError?.message).toContain('item-nonexistent');
    });

    test('should warn on assessment with no items', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
        ],
        assessments: [
          {
            id: 'test-empty',
            filePath: 'assessments/test-empty.xml',
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(true);
      const noItemsWarning = result.warnings.find(w => w.code === 'ASSESSMENT_NO_ITEMS');
      expect(noItemsWarning).toBeTruthy();
    });

    test('should warn on invalid package ID characters', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
        ],
        options: {
          packageId: 'package with spaces',
        },
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(true);
      const invalidIdWarning = result.warnings.find(w => w.code === 'INVALID_PACKAGE_ID_CHARS');
      expect(invalidIdWarning).toBeTruthy();
    });

    test('should error on duplicate passage IDs', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
        ],
        passages: [
          {
            id: 'passage-1',
            filePath: 'passages/passage-1.xml',
          },
          {
            id: 'passage-1', // Duplicate
            filePath: 'passages/passage-1-copy.xml',
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      const duplicateError = result.errors.find(e => e.code === 'DUPLICATE_PASSAGE_ID');
      expect(duplicateError).toBeTruthy();
    });

    test('should error on duplicate assessment IDs', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
        ],
        assessments: [
          {
            id: 'test-1',
            filePath: 'assessments/test-1.xml',
            dependencies: ['item-1'],
          },
          {
            id: 'test-1', // Duplicate
            filePath: 'assessments/test-1-copy.xml',
            dependencies: ['item-1'],
          },
        ],
      };

      const result = validateManifestInput(input);

      expect(result.valid).toBe(false);
      const duplicateError = result.errors.find(e => e.code === 'DUPLICATE_ASSESSMENT_ID');
      expect(duplicateError).toBeTruthy();
    });
  });

  describe('validateGeneratedManifest', () => {
    test('should validate valid manifest XML', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
          },
        ],
      };

      const manifestXml = generateManifest(input);
      const result = validateGeneratedManifest(manifestXml);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should error on missing XML declaration', () => {
      const badXml = '<manifest>...</manifest>';

      const result = validateGeneratedManifest(badXml);

      expect(result.valid).toBe(false);
      const missingDeclError = result.errors.find(e => e.code === 'MISSING_XML_DECLARATION');
      expect(missingDeclError).toBeTruthy();
    });

    test('should error on missing manifest root', () => {
      const badXml = '<?xml version="1.0"?><root>...</root>';

      const result = validateGeneratedManifest(badXml);

      expect(result.valid).toBe(false);
      const missingRootError = result.errors.find(e => e.code === 'MISSING_MANIFEST_ROOT');
      expect(missingRootError).toBeTruthy();
    });

    test('should error on missing required namespaces', () => {
      const badXml = '<?xml version="1.0"?><manifest>...</manifest>';

      const result = validateGeneratedManifest(badXml);

      expect(result.valid).toBe(false);
      const missingNsError = result.errors.find(e => e.code === 'MISSING_NAMESPACE');
      expect(missingNsError).toBeTruthy();
    });

    test('should error on missing organizations element', () => {
      const badXml = `<?xml version="1.0"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <resources></resources>
</manifest>`;

      const result = validateGeneratedManifest(badXml);

      expect(result.valid).toBe(false);
      const missingOrgError = result.errors.find(e => e.code === 'MISSING_ORGANIZATIONS');
      expect(missingOrgError).toBeTruthy();
    });

    test('should error on missing resources element', () => {
      const badXml = `<?xml version="1.0"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <organizations/>
</manifest>`;

      const result = validateGeneratedManifest(badXml);

      expect(result.valid).toBe(false);
      const missingResError = result.errors.find(e => e.code === 'MISSING_RESOURCES');
      expect(missingResError).toBeTruthy();
    });

    test('should warn on no resources', () => {
      const emptyXml = `<?xml version="1.0"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <organizations/>
  <resources></resources>
</manifest>`;

      const result = validateGeneratedManifest(emptyXml);

      expect(result.valid).toBe(true);
      const noResWarning = result.warnings.find(w => w.code === 'NO_RESOURCES');
      expect(noResWarning).toBeTruthy();
    });
  });

  describe('validatePackage (comprehensive)', () => {
    test('should validate complete valid package', () => {
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

      const result = validatePackage(input);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should catch input errors before generation', () => {
      const input: ManifestInput = {
        items: [
          {
            id: 'item-1',
            filePath: 'items/item-1.xml',
            dependencies: ['passage-nonexistent'],
          },
        ],
      };

      const result = validatePackage(input);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
