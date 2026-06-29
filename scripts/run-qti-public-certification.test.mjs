import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const scriptSource = readFileSync(new URL('./run-qti-public-certification.mjs', import.meta.url), 'utf8');

describe('public certification runner', () => {
	test('prebuilds browser demo workspace packages used by certification e2e routes', () => {
		const requiredFilters = [
			'@acme/likert-scale-plugin',
			'@pie-qti/player-elements',
			'@pie-qti/theme-daisyui',
			'@pie-qti/web-component-loaders',
		];

		for (const packageName of requiredFilters) {
			expect(scriptSource).toContain(`'--filter=${packageName}'`);
		}
	});
});
