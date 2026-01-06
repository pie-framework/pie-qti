/**
 * BaseId Support Tests
 *
 * Tests for baseId handling in passage generation
 */

import { describe, expect, test } from 'bun:test';
import type { PieModel } from '@pie-framework/transform-types';
import { generatePassageFile, generatePassageXml } from '../../src/generators/passage-generator.js';
import type { ResolvedPassage } from '../../src/types/passages.js';

describe('BaseId Support', () => {
  test('should use baseId as QTI identifier when present (PIE model)', () => {
    const passage: PieModel = {
      id: 'internal-id-123',
      baseId: 'stable-public-id-abc',
      element: '@pie-element/passage',
      passages: [
        {
          title: 'Test Passage',
          text: '<p>Content</p>',
        },
      ],
    };

    const xml = generatePassageXml(passage);

    // Should use baseId as identifier
    expect(xml).toContain('identifier="stable-public-id-abc"');
    expect(xml).not.toContain('identifier="internal-id-123"');

    // Should include metadata
    expect(xml).toContain('<qti-metadata>');
    expect(xml).toContain('name="sourceSystemId" value="pie"');
    expect(xml).toContain('name="externalId" value="stable-public-id-abc"');
  });

  test('should fallback to id when baseId not present (PIE model)', () => {
    const passage: PieModel = {
      id: 'passage-xyz',
      element: '@pie-element/passage',
      passages: [
        {
          title: 'Test Passage',
          text: '<p>Content</p>',
        },
      ],
    };

    const xml = generatePassageXml(passage);

    // Should use id as identifier
    expect(xml).toContain('identifier="passage-xyz"');

    // Metadata should use id
    expect(xml).toContain('name="externalId" value="passage-xyz"');
  });

  test('should use baseId as QTI identifier when present (Resolved passage)', () => {
    const passage: ResolvedPassage = {
      id: 'internal-id-456',
      baseId: 'stable-public-id-def',
      externalId: 'external-system-789',
      title: 'Test Passage',
      content: '<p>Resolved content</p>',
    };

    const xml = generatePassageXml(passage);

    // Should use baseId as identifier
    expect(xml).toContain('identifier="stable-public-id-def"');
    expect(xml).not.toContain('identifier="internal-id-456"');

    // Metadata
    expect(xml).toContain('name="sourceSystemId" value="pie"');
    expect(xml).toContain('name="externalId" value="stable-public-id-def"');
  });

  test('should use baseId for file naming', () => {
    const passage: ResolvedPassage = {
      id: 'internal-id-789',
      baseId: 'stable-file-name',
      title: 'Test',
      content: '<p>Content</p>',
    };

    const file = generatePassageFile(passage);

    // File path should use baseId
    expect(file.id).toBe('stable-file-name');
    expect(file.filePath).toBe('passages/stable-file-name.xml');

    // XML should use baseId
    expect(file.xml).toContain('identifier="stable-file-name"');
  });

  test('should use id for file naming when baseId absent', () => {
    const passage: ResolvedPassage = {
      id: 'passage-normal-id',
      title: 'Test',
      content: '<p>Content</p>',
    };

    const file = generatePassageFile(passage);

    // File path should use id
    expect(file.id).toBe('passage-normal-id');
    expect(file.filePath).toBe('passages/passage-normal-id.xml');

    // XML should use id
    expect(file.xml).toContain('identifier="passage-normal-id"');
  });

  test('should preserve metadata fields in QTI output', () => {
    const passage: ResolvedPassage = {
      id: 'id-1',
      baseId: 'base-1',
      externalId: 'ext-1',
      title: 'Metadata Test',
      content: '<p>Content</p>',
    };

    const xml = generatePassageXml(passage);

    // Check metadata structure
    expect(xml).toContain('<qti-metadata>');
    expect(xml).toContain('</qti-metadata>');

    // Source system is always "pie"
    expect(xml).toContain('<qti-metadata-field name="sourceSystemId" value="pie"/>');

    // ExternalId matches identifier (baseId when present)
    expect(xml).toContain('<qti-metadata-field name="externalId" value="base-1"/>');
  });

  test('should handle special characters in baseId', () => {
    const passage: ResolvedPassage = {
      id: 'id-1',
      baseId: 'passage-with-special-&-<>-chars',
      title: 'Test',
      content: '<p>Content</p>',
    };

    const xml = generatePassageXml(passage);

    // Should escape special characters
    expect(xml).toContain('identifier="passage-with-special-&amp;-&lt;&gt;-chars"');
    expect(xml).toContain('name="externalId" value="passage-with-special-&amp;-&lt;&gt;-chars"');
  });

  test('should generate consistent metadata structure', () => {
    const passage: ResolvedPassage = {
      id: 'test-id',
      baseId: 'test-base-id',
      title: 'Metadata Structure Test',
      content: '<p>Testing</p>',
    };

    const xml = generatePassageXml(passage);

    // Verify metadata is well-formed
    const metadataMatch = xml.match(/<qti-metadata>([\s\S]*?)<\/qti-metadata>/);
    expect(metadataMatch).toBeTruthy();

    if (metadataMatch) {
      const metadataContent = metadataMatch[1];

      // Should contain exactly 2 fields
      const fieldMatches = metadataContent.match(/<qti-metadata-field/g);
      expect(fieldMatches).toHaveLength(2);

      // Fields should be properly formatted
      expect(metadataContent).toContain('name="sourceSystemId"');
      expect(metadataContent).toContain('name="externalId"');
    }
  });
});
