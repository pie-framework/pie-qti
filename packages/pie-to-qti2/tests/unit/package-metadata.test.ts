import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as {
  sideEffects?: unknown;
};

describe('pie-to-qti2 package metadata', () => {
  test('keeps built-in generator registration side-effectful for package consumers', () => {
    expect(packageJson.sideEffects).toContain('./dist/generators/index.js');
  });
});
