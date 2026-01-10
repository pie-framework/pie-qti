/**
 * Svelte store integration for reactive i18n
 */

import { writable, derived } from 'svelte/store';
import { I18n, type LocaleCode, type MessageKey, type InterpolationValues, type PluralOptions } from './I18n.js';

// Re-export types for convenience
export type { LocaleCode, MessageKey, InterpolationValues, PluralOptions };

// Singleton instance
let i18nInstance: I18n | null = null;

// Writable store for current locale
export const locale = writable<LocaleCode>('en-US');

/**
 * Initialize i18n system
 */
export function initI18n(initialLocale: LocaleCode = 'en-US'): I18n {
	if (!i18nInstance) {
		i18nInstance = new I18n(initialLocale);
	}
	locale.set(initialLocale);
	return i18nInstance;
}

/**
 * Get i18n instance (throw if not initialized)
 */
export function getI18n(): I18n {
	if (!i18nInstance) {
		throw new Error('[i18n] I18n not initialized. Call initI18n() first.');
	}
	return i18nInstance;
}

/**
 * Change locale reactively
 */
export async function setLocale(newLocale: LocaleCode): Promise<void> {
	const i18n = getI18n();
	await i18n.loadLocale(newLocale);
	i18n.setLocale(newLocale);
	locale.set(newLocale);
}

/**
 * Reactive translation function (for use in Svelte components)
 * Re-evaluates when locale changes
 */
export const t = derived(
	locale,
	(_$locale) => (key: MessageKey, values?: InterpolationValues): string => {
		if (!i18nInstance) {
			// During SSR before initialization, return the key as fallback
			return key;
		}
		const i18n = getI18n();
		return i18n.t(key, values);
	}
);

/**
 * Reactive pluralization function
 */
export const plural = derived(
	locale,
	(_$locale) => (key: MessageKey, options: PluralOptions): string => {
		if (!i18nInstance) {
			// During SSR before initialization, return the key as fallback
			return key;
		}
		const i18n = getI18n();
		return i18n.plural(key, options);
	}
);

/**
 * Reactive number formatter
 */
export const formatNumber = derived(
	locale,
	(_$locale) => (value: number, options?: Intl.NumberFormatOptions): string => {
		if (!i18nInstance) {
			// During SSR before initialization, use default formatting
			return value.toString();
		}
		const i18n = getI18n();
		return i18n.formatNumber(value, options);
	}
);

/**
 * Reactive date formatter
 */
export const formatDate = derived(
	locale,
	(_$locale) => (date: Date, options?: Intl.DateTimeFormatOptions): string => {
		if (!i18nInstance) {
			// During SSR before initialization, use default formatting
			return date.toISOString();
		}
		const i18n = getI18n();
		return i18n.formatDate(date, options);
	}
);
