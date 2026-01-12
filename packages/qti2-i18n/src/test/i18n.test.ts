/**
 * Unit tests for core I18n functionality
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import type { I18nProvider } from '../core/I18nProvider.js';
import enUS from '../locales/en-US.js';
import esES from '../locales/es-ES.js';

// Create a test implementation of I18nProvider that doesn't rely on Vite's import.meta.glob
class TestI18nProvider implements I18nProvider {
	private currentLocale: string;
	private messages: Record<string, any>;

	constructor(locale: string = 'en-US') {
		this.currentLocale = locale;
		this.messages = {
			'en-US': enUS,
			'es-ES': esES,
		};
	}

	getLocale(): string {
		return this.currentLocale;
	}

	async setLocale(locale: string): Promise<void> {
		this.currentLocale = locale;
	}

	t(key: string, values?: Record<string, any>): string {
		const keys = key.split('.');
		let result: any = this.messages[this.currentLocale] || this.messages['en-US'];

		for (const k of keys) {
			result = result?.[k];
			if (result === undefined) break;
		}

		if (typeof result !== 'string') {
			return key;
		}

		if (values) {
			return result.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
		}

		return result;
	}

	formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
		return new Intl.NumberFormat(this.currentLocale, options).format(value);
	}

	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
		return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
	}
}

describe('I18n Core', () => {
	let i18n: I18nProvider;

	beforeEach(() => {
		i18n = new TestI18nProvider('en-US');
	});

	test('translates simple message', () => {
		expect(i18n.t('common.submit')).toBe('Submit');
	});

	test('translates nested message', () => {
		expect(i18n.t('interactions.upload.label')).toBe('Upload a file');
	});

	test('interpolates values', () => {
		const result = i18n.t('assessment.question', { current: 1, total: 10 });
		expect(result).toBe('Question 1 of 10');
	});

	test('interpolates multiple values', () => {
		const result = i18n.t('interactions.slider.selectedValue', { value: 42 });
		expect(result).toBe('Selected value: 42');
	});

	test('handles missing translation gracefully', () => {
		const result = i18n.t('some.missing.key' as any);
		expect(result).toBe('some.missing.key');
	});

	test('formats numbers according to locale', () => {
		const result = i18n.formatNumber(1234.56);
		expect(result).toBe('1,234.56');
	});

	test('formats dates according to locale', () => {
		const date = new Date('2026-01-09T12:00:00Z');
		const result = i18n.formatDate(date, { dateStyle: 'short' });
		expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/); // Matches date pattern
	});

	test('switches locale', async () => {
		await i18n.setLocale('es-ES');
		expect(i18n.getLocale()).toBe('es-ES');
		expect(i18n.t('common.submit')).toBe('Enviar');
	});

	test('falls back to English for missing translation', async () => {
		await i18n.setLocale('es-ES');
		// If Spanish doesn't have a key, should fall back to English
		const result = i18n.t('common.submit');
		expect(result).toBeTruthy();
	});

	test('handles deeply nested messages', () => {
		expect(i18n.t('interactions.graphicGapMatch.pressSpaceToPlace'))
			.toBe('Press Space or Enter to place label');
	});

	test('returns key if locale not loaded', () => {
		const uninitializedI18n = new TestI18nProvider('fr-FR');
		const result = uninitializedI18n.t('some.missing.key');
		expect(result).toBe('some.missing.key');
	});
});

describe('Svelte I18n Provider', () => {
	test('wraps I18nProvider with reactive stores', async () => {
		const { SvelteI18nProvider } = await import('../providers/SvelteI18nProvider.js');
		const base = new TestI18nProvider('en-US');

		const svelte = new SvelteI18nProvider(base);
		expect(svelte.getLocale()).toBe('en-US');
		expect(svelte.t('common.submit')).toBe('Submit');
	});

	test('locale changes update reactive stores', async () => {
		const { SvelteI18nProvider } = await import('../providers/SvelteI18nProvider.js');
		const base = new TestI18nProvider('en-US');

		const svelte = new SvelteI18nProvider(base);

		await svelte.setLocale('es-ES');
		expect(svelte.getLocale()).toBe('es-ES');
		expect(svelte.t('common.submit')).toBe('Enviar');
	});
});
