/**
 * Tests for the missing-key warning on `DefaultI18nProvider.t`.
 *
 * The warning used to be gated on `NODE_ENV === 'development'`, so production
 * builds — where a missing key silently degrades the UI to its English default
 * or echoes the key — never signalled anything (round-4 review, finding L2).
 * It is now unconditional; these tests pin that.
 */

import { describe, expect, test, afterEach } from 'bun:test';
import { DefaultI18nProvider } from '../src/core/I18n.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
	process.env.NODE_ENV = originalNodeEnv;
	console.warn = originalWarn;
});

const originalWarn = console.warn;

describe('missing-key warning', () => {
	test('warns in production builds, not only under NODE_ENV=development', () => {
		process.env.NODE_ENV = 'production';
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => warnings.push(args);

		const i18n = new DefaultI18nProvider('en-US');
		const text = i18n.t('no.such.key', 'Fallback text');

		expect(text).toBe('Fallback text');
		expect(warnings.length).toBe(1);
		expect(String(warnings[0][0])).toContain('no.such.key');
	});

	test('warns when no default is given, and echoes the key', () => {
		process.env.NODE_ENV = 'production';
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => warnings.push(args);

		const i18n = new DefaultI18nProvider('en-US');
		const text = i18n.t('no.such.key');

		expect(text).toBe('no.such.key');
		expect(warnings.length).toBe(1);
	});

	test('does not warn for keys a catalog carries', () => {
		process.env.NODE_ENV = 'production';
		const warnings: unknown[][] = [];
		console.warn = (...args: unknown[]) => warnings.push(args);

		const i18n = new DefaultI18nProvider('en-US');
		i18n.t('common.submit');

		expect(warnings.length).toBe(0);
	});
});
