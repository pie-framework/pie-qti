/**
 * Translation completeness tests
 * Ensures all locales have the same keys as the English locale
 */

import { describe, test, expect } from 'bun:test';
import enUS from '../locales/en-US.js';
import esES from '../locales/es-ES.js';
import frFR from '../locales/fr-FR.js';
import deDE from '../locales/de-DE.js';
import ptBR from '../locales/pt-BR.js';

/**
 * Flatten nested object into dot-notation keys
 */
function flattenKeys(obj: any, prefix = ''): string[] {
	let keys: string[] = [];
	for (const key in obj) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
			keys = keys.concat(flattenKeys(obj[key], fullKey));
		} else {
			keys.push(fullKey);
		}
	}
	return keys;
}

describe('Translation Completeness', () => {
	const enKeys = flattenKeys(enUS).sort();

	test('English locale has keys', () => {
		expect(enKeys.length).toBeGreaterThan(0);
	});

	test('Spanish locale has all English keys', () => {
		const esKeys = flattenKeys(esES).sort();

		const missing = enKeys.filter(key => !esKeys.includes(key));
		const extra = esKeys.filter(key => !enKeys.includes(key));

		if (missing.length > 0) {
			console.warn('Missing Spanish translations:', missing);
		}
		if (extra.length > 0) {
			console.warn('Extra Spanish translations:', extra);
		}

		expect(missing).toHaveLength(0);
		expect(extra).toHaveLength(0);
	});

	test('French locale has all English keys', () => {
		const frKeys = flattenKeys(frFR).sort();

		const missing = enKeys.filter(key => !frKeys.includes(key));
		const extra = frKeys.filter(key => !enKeys.includes(key));

		if (missing.length > 0) {
			console.warn('Missing French translations:', missing);
		}
		if (extra.length > 0) {
			console.warn('Extra French translations:', extra);
		}

		expect(missing).toHaveLength(0);
		expect(extra).toHaveLength(0);
	});

	test('German locale has all English keys', () => {
		const deKeys = flattenKeys(deDE).sort();

		const missing = enKeys.filter(key => !deKeys.includes(key));
		const extra = deKeys.filter(key => !enKeys.includes(key));

		if (missing.length > 0) {
			console.warn('Missing German translations:', missing);
		}
		if (extra.length > 0) {
			console.warn('Extra German translations:', extra);
		}

		expect(missing).toHaveLength(0);
		expect(extra).toHaveLength(0);
	});

	test('Portuguese (Brazil) locale has all English keys', () => {
		const ptKeys = flattenKeys(ptBR).sort();

		const missing = enKeys.filter(key => !ptKeys.includes(key));
		const extra = ptKeys.filter(key => !enKeys.includes(key));

		if (missing.length > 0) {
			console.warn('Missing Portuguese translations:', missing);
		}
		if (extra.length > 0) {
			console.warn('Extra Portuguese translations:', extra);
		}

		expect(missing).toHaveLength(0);
		expect(extra).toHaveLength(0);
	});

	test('All locales have consistent structure', () => {
		const locales = [
			{ name: 'Spanish', keys: flattenKeys(esES) },
			{ name: 'French', keys: flattenKeys(frFR) },
			{ name: 'German', keys: flattenKeys(deDE) },
			{ name: 'Portuguese', keys: flattenKeys(ptBR) },
		];

		for (const locale of locales) {
			expect(locale.keys.length).toBe(enKeys.length);
		}
	});
});

describe('Translation Quality', () => {
	test('No placeholder variables are missing in translations', () => {
		const enKeys = flattenKeys(enUS);
		const locales = [
			{ name: 'Spanish', obj: esES },
			{ name: 'French', obj: frFR },
			{ name: 'German', obj: deDE },
			{ name: 'Portuguese', obj: ptBR },
		];

		function getValue(obj: any, key: string): string {
			const parts = key.split('.');
			let current = obj;
			for (const part of parts) {
				current = current[part];
				if (current === undefined) return '';
			}
			return current;
		}

		function extractPlaceholders(text: string): string[] {
			const matches = text.match(/\{(\w+)\}/g);
			return matches ? matches : [];
		}

		const errors: string[] = [];

		for (const key of enKeys) {
			const enValue = getValue(enUS, key);
			if (typeof enValue !== 'string') continue;

			const enPlaceholders = extractPlaceholders(enValue).sort();

			for (const locale of locales) {
				const translatedValue = getValue(locale.obj, key);
				if (typeof translatedValue !== 'string') continue;

				const translatedPlaceholders = extractPlaceholders(translatedValue).sort();

				if (JSON.stringify(enPlaceholders) !== JSON.stringify(translatedPlaceholders)) {
					errors.push(
						`${locale.name} - Key "${key}": Expected placeholders ${JSON.stringify(enPlaceholders)} but found ${JSON.stringify(translatedPlaceholders)}`
					);
				}
			}
		}

		if (errors.length > 0) {
			console.error('Placeholder mismatches found:');
			errors.forEach(err => console.error('  -', err));
		}

		expect(errors).toHaveLength(0);
	});
});
