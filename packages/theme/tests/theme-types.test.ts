import { describe, expect, test } from 'bun:test';
import { normalizeQtiThemeVariables } from '../src/theme-types';

describe('normalizeQtiThemeVariables', () => {
	test('keeps only non-empty PIE QTI CSS variables', () => {
		expect(
			normalizeQtiThemeVariables({
				'--pie-qti-primary': ' #146eb3 ',
				'--pie-primary': '#000000',
				'--pie-qti-border-width': 2,
				'--pie-qti-empty': '   ',
			}),
		).toEqual({
			'--pie-qti-border-width': '2',
			'--pie-qti-primary': '#146eb3',
		});
	});

	test('returns an empty map for non-object input', () => {
		expect(normalizeQtiThemeVariables(null)).toEqual({});
		expect(normalizeQtiThemeVariables('not variables')).toEqual({});
	});
});
