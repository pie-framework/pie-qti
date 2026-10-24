/**
 * Tests for `scripts/check-physical-css.ts`, the physical-direction CSS check in
 * `check:i18n`.
 */

import { describe, expect, test } from 'bun:test';
import { scanPhysicalCss } from '../scripts/check-physical-css.js';

function lines(file: string, source: string): number[] {
	return scanPhysicalCss(file, source).map((finding) => finding.line);
}

describe('scanPhysicalCss', () => {
	test('flags physical properties and values in CSS', () => {
		const css = ['.a { margin-left: 1rem; }', '.b { padding-right: 0; }', '.c { left: 0; }', '.d { text-align: right; }', '.e { border-top-left-radius: 2px; }'].join('\n');
		expect(lines('/pkg/src/a.css', css)).toEqual([1, 2, 3, 4, 5]);
	});

	test('passes logical properties', () => {
		const css = '.a { margin-inline-start: 1rem; inset-inline-end: 0; text-align: start; border-start-start-radius: 2px; }';
		expect(lines('/pkg/src/a.css', css)).toEqual([]);
	});

	test('flags physical Tailwind utilities in Svelte markup, variants included', () => {
		const svelte = ['<div class="flex ml-2"></div>', '<div class="md:pr-4"></div>', '<div class="ms-2 end-2 text-start"></div>', '<div class:right-0={open}></div>'].join('\n');
		expect(lines('/pkg/src/A.svelte', svelte)).toEqual([1, 2, 4]);
	});

	test('ignores script blocks and comments', () => {
		const svelte = [
			'<script lang="ts">',
			"\tconst style = 'left: 0;';",
			'</script>',
			'<!-- class="ml-2" -->',
			'<style>',
			'\t/* qti-choices-left: left: 0; */',
			'</style>',
		].join('\n');
		expect(lines('/pkg/src/A.svelte', svelte)).toEqual([]);
	});

	test('reads TypeScript CSS only inside template literals', () => {
		const ts = ['interface Side {', '\tleft: boolean;', '}', 'const css = `', '\t.x {', '\t\tmargin-right: 4px;', '\t}', '`;'].join('\n');
		expect(lines('/pkg/src/a.ts', ts)).toEqual([6]);
	});

	test('honours the i18n-physical marker on the line and the line above', () => {
		const css = ['.a { float: left; } /* i18n-physical */', '/* i18n-physical: by spec */', '.b { float: right; }', '.c { float: right; }'].join('\n');
		expect(lines('/pkg/src/a.css', css)).toEqual([4]);
	});

	test('exempts graphic and spatial interactions', () => {
		expect(lines('/pkg/src/plugins/hotspot/Hotspot.svelte', '<div style="left: 4px"></div>')).toEqual([]);
	});
});
