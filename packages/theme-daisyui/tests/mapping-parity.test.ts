import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	type DaisyThemeTokens,
	mapDaisyThemeToQtiVariables,
	mapResolvedDaisyThemeToQtiVariables,
} from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeCss = readFileSync(resolve(__dirname, '../src/bridge.css'), 'utf8');

function bridgeDeclarations(): Record<string, string> {
	const withoutComments = bridgeCss.replace(/\/\*[\s\S]*?\*\//g, '');
	return Object.fromEntries(
		[...withoutComments.matchAll(/(--pie-qti-[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
	);
}

function bridgeVariables() {
	return [...bridgeCss.matchAll(/(--pie-qti-[\w-]+)\s*:/g)].map((match) => match[1]).sort();
}

describe('DaisyUI bridge mapping', () => {
	test('keeps static CSS and JS fallback mapping in sync', () => {
		expect(Object.keys(mapDaisyThemeToQtiVariables({})).sort()).toEqual(bridgeVariables());
	});

	test('keeps static CSS and JS fallback values in sync', () => {
		expect(mapDaisyThemeToQtiVariables({})).toEqual(bridgeDeclarations());
	});

	test('resolved mapping omits missing DaisyUI tokens', () => {
		const tokens: DaisyThemeTokens = {
			base100: '#ffffff',
			primary: '#146eb3',
		};

		expect(mapResolvedDaisyThemeToQtiVariables(tokens)).toEqual({
			'--pie-qti-base-100': '#ffffff',
			'--pie-qti-focus': '#146eb3',
			'--pie-qti-primary': '#146eb3',
		});
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
