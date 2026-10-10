/**
 * BaseId Support Tests
 *
 * Tests for baseId handling in passage generation
 */

import { describe, expect, test } from 'bun:test';
import type { PieModel } from '@pie-qti/transform-types';
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

  test('should emit no qti-metadata, which QTI 2.2 does not define', () => {
    const passage: ResolvedPassage = {
      id: 'id-1',
      baseId: 'base-1',
      externalId: 'ext-1',
      title: 'Metadata Test',
      content: '<p>Content</p>',
    };

    const xml = generatePassageXml(passage);

    expect(xml).toContain('identifier="base-1"');
    expect(xml).not.toContain('qti-metadata');
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
  });
});
