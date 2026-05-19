import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
	sideEffects?: unknown;
};

describe('player-elements package metadata', () => {
	test('keeps the register entrypoint side-effectful for package consumers', () => {
		expect(packageJson.sideEffects).toContain('./dist/register.js');
	});
});
