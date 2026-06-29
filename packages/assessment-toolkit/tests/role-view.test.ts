import { describe, expect, test } from 'bun:test';
import { filterQtiRoleVisible, isQtiViewVisibleForRole, normalizeQtiViewTokens } from '../src/index.js';

describe('QTI role view helpers', () => {
  test('normalizes comma-separated and whitespace-separated view tokens', () => {
    expect(normalizeQtiViewTokens(['candidate,scorer', ' proctor tutor ', 'author,testConstructor'])).toEqual([
      'candidate',
      'scorer',
      'proctor',
      'tutor',
      'author',
      'testConstructor',
    ]);
  });

  test('shows candidate-visible content to candidates', () => {
    expect(isQtiViewVisibleForRole(['candidate'], 'candidate')).toBe(true);
    expect(isQtiViewVisibleForRole(['candidate scorer'], 'candidate')).toBe(true);
  });

  test('shows missing or empty view content to all roles', () => {
    expect(isQtiViewVisibleForRole(undefined, 'candidate')).toBe(true);
    expect(isQtiViewVisibleForRole([], 'scorer')).toBe(true);
    expect(isQtiViewVisibleForRole(['  ', ','], 'author')).toBe(true);
  });

  test('hides candidate-only content from scorers', () => {
    expect(isQtiViewVisibleForRole(['candidate'], 'scorer')).toBe(false);
  });

  test('filters scorer-only blocks for scorer role', () => {
    const blocks = [
      { identifier: 'candidate', view: ['candidate'] },
      { identifier: 'scorer', view: ['scorer'] },
      { identifier: 'both', view: ['candidate,scorer'] },
      { identifier: 'all' },
    ];

    expect(filterQtiRoleVisible(blocks, 'scorer').map((block) => block.identifier)).toEqual([
      'scorer',
      'both',
      'all',
    ]);
  });
});
