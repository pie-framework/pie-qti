import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	mapDaisyThemeToQtiVariables,
	mapResolvedDaisyThemeToQtiVariables,
	type DaisyThemeTokens,
} from '../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeCss = readFileSync(resolve(__dirname, '../src/bridge.css'), 'utf8');

function bridgeVariables() {
	return [...bridgeCss.matchAll(/(--pie-qti-[\w-]+)\s*:/g)].map((match) => match[1]).sort();
}

describe('DaisyUI bridge mapping', () => {
	test('keeps static CSS and JS fallback mapping in sync', () => {
		expect(Object.keys(mapDaisyThemeToQtiVariables({})).sort()).toEqual(bridgeVariables());
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
});
