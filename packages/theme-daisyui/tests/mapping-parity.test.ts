import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCustomPropertyBlocks } from '../../theme/tests/support/wcag-contrast';
import {
	type DaisyThemeTokens,
	mapDaisyThemeToQtiVariables,
	mapResolvedDaisyThemeToQtiVariables,
} from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeCss = readFileSync(resolve(__dirname, '../src/bridge.css'), 'utf8');

const bridgeBlocks = parseCustomPropertyBlocks(bridgeCss).filter((block) => block.selectors.includes('[data-theme]'));
const conditions = [...new Set(bridgeBlocks.flatMap((block) => (block.supports ? [block.supports] : [])))];

/** Collapse formatting whitespace so multi-line CSS values compare with single-line JS ones. */
function normalizeCss(value: string): string {
	return value.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

function normalizeAll(variables: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, normalizeCss(value)]));
}

/** What an engine passing exactly `supported` computes from bridge.css: later blocks win. */
function bridgeDeclarations(supported: ReadonlySet<string>): Record<string, string> {
	const applied = bridgeBlocks.filter((block) => block.supports === null || supported.has(block.supports));
	return normalizeAll(Object.assign({}, ...applied.map((block) => block.declarations)));
}

function subsets<T>(items: readonly T[]): T[][] {
	return items.reduce<T[][]>((all, item) => [...all, ...all.map((subset) => [...subset, item])], [[]]);
}

function tierName(condition: string): string {
	if (condition.includes('light-dark(')) return 'relative colour + light-dark()';
	if (condition.includes('(from ')) return 'relative colour';
	if (condition.includes('color-mix(')) return 'color-mix()';
	return condition;
}

describe('DaisyUI bridge mapping', () => {
	test('bridge.css has a base block and progressive @supports tiers', () => {
		expect(bridgeBlocks.filter((block) => block.supports === null)).toHaveLength(1);
		expect(conditions.map(tierName)).toEqual(['color-mix()', 'relative colour', 'relative colour + light-dark()']);
	});

	for (const supported of subsets(conditions)) {
		const label = supported.length === 0 ? 'no @supports tier' : supported.map(tierName).join(', ');
		test(`static CSS and JS mapping agree in an engine passing: ${label}`, () => {
			const set = new Set(supported);
			const queried: string[] = [];
			const js = mapDaisyThemeToQtiVariables(
				{},
				{
					supports: (condition) => {
						queried.push(condition);
						return set.has(condition);
					},
				},
			);
			expect(normalizeAll(js)).toEqual(bridgeDeclarations(set));
			// The JS feature tests are the stylesheet's own @supports conditions.
			for (const condition of queried) expect(conditions).toContain(condition);
		});
	}

	test('without CSS.supports (SSR, tests), the JS mapping is the base block', () => {
		expect(normalizeAll(mapDaisyThemeToQtiVariables({}))).toEqual(bridgeDeclarations(new Set()));
	});

	test('resolved mapping omits missing DaisyUI tokens', () => {
		const tokens: DaisyThemeTokens = {
			base100: '#ffffff',
			primary: '#146eb3',
		};

		expect(mapResolvedDaisyThemeToQtiVariables(tokens, { supports: () => false })).toEqual({
			'--pie-qti-base-100': '#ffffff',
			'--pie-qti-focus': '#146eb3',
			'--pie-qti-primary': '#146eb3',
		});
	});

	test('resolved mapping derives focus and text-on-fill from the resolved fills when supported', () => {
		const tokens: DaisyThemeTokens = { primary: '#146eb3', primaryContent: '#ffffff', baseContent: '#1f2937' };
		const all = mapResolvedDaisyThemeToQtiVariables(tokens, { supports: () => true });
		const expected = mapDaisyThemeToQtiVariables(tokens, { supports: () => true });
		expect(all['--pie-qti-focus']).toBe(expected['--pie-qti-focus']);
		expect(all['--pie-qti-primary-content']).toBe(expected['--pie-qti-primary-content']);
		expect(all['--pie-qti-focus']).toStartWith('light-dark(color(from #146eb3 srgb-linear ');
		expect(all['--pie-qti-primary-content']).toStartWith('color(from #146eb3 srgb-linear ');

		const colorMixOnly = mapResolvedDaisyThemeToQtiVariables(tokens, {
			supports: (condition) => condition.startsWith('(color: color-mix('),
		});
		expect(colorMixOnly['--pie-qti-focus']).toBe('color-mix(in oklab, #146eb3 45%, #1f2937)');
		expect(colorMixOnly['--pie-qti-primary-content']).toBe('#ffffff');
	});

	test('maps DaisyUI radius tokens to the shape tokens', () => {
		const tokens: DaisyThemeTokens = { radiusBox: '1rem', radiusField: '0.375rem' };

		expect(mapResolvedDaisyThemeToQtiVariables(tokens)).toEqual({
			'--pie-qti-radius': '1rem',
			'--pie-qti-radius-sm': '0.375rem',
		});
		expect(mapDaisyThemeToQtiVariables(tokens)).toMatchObject({
			'--pie-qti-radius': '1rem',
			'--pie-qti-radius-sm': '0.375rem',
		});
	});
});
