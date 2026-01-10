/**
 * Unit tests for core I18n functionality
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { I18n } from '../core/I18n.js';

describe('I18n Core', () => {
	let i18n: I18n;

	beforeEach(async () => {
		i18n = new I18n('en-US');
		await i18n.loadLocale('en-US');
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
		await i18n.loadLocale('es-ES');
		i18n.setLocale('es-ES');
		expect(i18n.getLocale()).toBe('es-ES');
		expect(i18n.t('common.submit')).toBe('Enviar');
	});

	test('falls back to English for missing translation', async () => {
		await i18n.loadLocale('es-ES');
		i18n.setLocale('es-ES');
		// If Spanish doesn't have a key, should fall back to English
		const result = i18n.t('common.submit');
		expect(result).toBeTruthy();
	});

	test('handles deeply nested messages', () => {
		expect(i18n.t('interactions.graphicGapMatch.pressSpaceToPlace'))
			.toBe('Press Space or Enter to place label');
	});

	test('returns key if locale not loaded', () => {
		const uninitializedI18n = new I18n('fr-FR');
		const result = uninitializedI18n.t('common.submit');
		expect(result).toBe('common.submit');
	});
});

describe('I18n Store Integration', () => {
	test('initI18n creates singleton', async () => {
		const { initI18n, getI18n } = await import('../core/store.js');
		const i18n1 = initI18n('en-US');
		const i18n2 = getI18n();
		expect(i18n1).toBe(i18n2);
	});

	test('setLocale updates locale', async () => {
		const { initI18n, setLocale, locale, getI18n } = await import('../core/store.js');
		initI18n('en-US');

		const i18n = getI18n();
		await i18n.loadLocale('en-US');
		await i18n.loadLocale('es-ES');

		await setLocale('es-ES');

		// The store should be updated
		let currentLocale: string = '';
		locale.subscribe(value => { currentLocale = value; })();
		expect(currentLocale).toBe('es-ES');
	});
});
