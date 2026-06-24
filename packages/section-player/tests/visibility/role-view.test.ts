import { describe, expect, test } from 'bun:test';
import { isQtiViewVisibleForRole, normalizeQtiViewTokens } from '../../src/index.js';

describe('normalizeQtiViewTokens', () => {
  test('normalizes comma and space separated view tokens', () => {
    expect(normalizeQtiViewTokens(['candidate,scorer', ' proctor tutor ', 'author,testConstructor'])).toEqual([
      'candidate',
      'scorer',
      'proctor',
      'tutor',
      'author',
      'testConstructor',
    ]);
  });
});

describe('isQtiViewVisibleForRole', () => {
  test('shows content with an empty view to any role', () => {
    expect(isQtiViewVisibleForRole(undefined, 'candidate')).toBe(true);
    expect(isQtiViewVisibleForRole([], 'scorer')).toBe(true);
    expect(isQtiViewVisibleForRole(['  ', ','], 'proctor')).toBe(true);
  });

  test('hides content when the role is not listed in view tokens', () => {
    expect(isQtiViewVisibleForRole(['candidate scorer'], 'proctor')).toBe(false);
  });
});
