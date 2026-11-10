/**
 * Shared stroke icons: the check, close and info path data is declared once in
 * shared/components/icons.ts and rendered through Icon.svelte. No component
 * carries its own inline copy, and every usage keeps its own part name and
 * classes, so what renders stays identical.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ICON_CHECK, ICON_CLOSE, ICON_INFO } from '../../src/shared/components/icons.js';

describe('shared stroke icons', () => {
	const SHARED_PATHS = [ICON_CHECK, ICON_CLOSE, ICON_INFO];

	test('no component inlines a shared icon path', () => {
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) walk(path);
				else if (path.endsWith('.svelte')) {
					const source = readFileSync(path, 'utf8');
					for (const shared of SHARED_PATHS) {
						if (source.includes(`d="${shared}"`) || source.includes(`d='${shared}'`)) offenders.push(path);
					}
				}
			}
		};
		walk('src/plugins');
		walk('src/shared/components');
		expect(offenders).toEqual([]);
	});

	test('every icon usage names its interaction-specific part', () => {
		const usages: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) walk(path);
				else if (path.endsWith('.svelte')) {
					const source = readFileSync(path, 'utf8');
					for (const match of source.matchAll(/<Icon\b[^>]*>/g)) {
						usages.push(match[0]);
					}
				}
			}
		};
		walk('src/plugins');
		for (const usage of usages) {
			expect(usage, usage).toMatch(/part="/);
			expect(usage, usage).toMatch(/class="/);
		}
		expect(usages.length).toBeGreaterThanOrEqual(9);
	});
});
