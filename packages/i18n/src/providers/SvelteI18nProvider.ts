/**
 * Svelte-specific I18n provider with reactive stores
 *
 * This provider wraps any I18nProvider implementation and exposes Svelte stores
 * for reactive updates when the locale changes. Use this in Svelte applications
 * that need automatic re-rendering on locale changes.
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { I18nProvider, PluralOptions } from '../core/I18nProvider.js';
import type { LocaleCode, FrameworkLocaleCode, LocaleMessages } from '../core/types.js';

export class SvelteI18nProvider implements I18nProvider {
	private provider: I18nProvider;
	private localeStore = writable<string>('en-US');

	// Expose reactive store for Svelte components
	// @deprecated Locale changes now trigger page refresh. Use i18n.t() directly instead.
	// Kept for backwards compatibility.
	public locale: Readable<string> = { subscribe: this.localeStore.subscribe };

	// @deprecated No longer needed - locale changes trigger page refresh.
	// Use i18n.t() directly with $derived instead.
	// Kept for backwards compatibility.
	public t$ = derived(
		this.localeStore,
		() => (key: string, values?: Record<string, any>): string => {
			return this.provider.t(key, values);
		}
	);

	// @deprecated No longer needed - locale changes trigger page refresh.
	// Use i18n.plural() directly with $derived instead.
	// Kept for backwards compatibility.
	public plural$ = derived(
		this.localeStore,
		() => (key: string, options: PluralOptions): string => {
			return this.provider.plural?.(key, options) ?? this.provider.t(key, options);
		}
	);

	// @deprecated No longer needed - locale changes trigger page refresh.
	// Use i18n.formatNumber() directly with $derived instead.
	// Kept for backwards compatibility.
	public formatNumber$ = derived(
		this.localeStore,
		() => (value: number, options?: Intl.NumberFormatOptions): string => {
			if (this.provider.formatNumber) {
				return this.provider.formatNumber(value, options);
			}
			return new Intl.NumberFormat(this.provider.getLocale(), options).format(value);
		}
	);

	// @deprecated No longer needed - locale changes trigger page refresh.
	// Use i18n.formatDate() directly with $derived instead.
	// Kept for backwards compatibility.
	public formatDate$ = derived(
		this.localeStore,
		() => (date: Date, options?: Intl.DateTimeFormatOptions): string => {
			if (this.provider.formatDate) {
				return this.provider.formatDate(date, options);
			}
			return new Intl.DateTimeFormat(this.provider.getLocale(), options).format(date);
		}
	);

	constructor(provider: I18nProvider) {
		this.provider = provider;
		this.localeStore.set(provider.getLocale());
	}

	getLocale(): string {
		return this.provider.getLocale();
	}

	async setLocale(locale: string): Promise<void> {
		// Load the locale if using DefaultI18nProvider (only for framework locales)
		if ('loadLocale' in this.provider && typeof this.provider.loadLocale === 'function') {
			// Only load framework locales; custom locales should be provided via customMessages
			try {
				await this.provider.loadLocale(locale as FrameworkLocaleCode);
			} catch (error) {
				// If framework locale doesn't exist, assume it's a custom locale
				console.debug(`[i18n] Locale '${locale}' not available as framework locale, assuming custom locale`);
			}
		}

		const result = this.provider.setLocale(locale);
		if (result instanceof Promise) {
			await result;
		}
		this.localeStore.set(locale);

		// Store locale in localStorage for persistence across page loads
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('pie-qti-locale', locale);
		}

		// Trigger page reload to apply new locale
		// This simplifies the codebase significantly by eliminating the need for
		// complex reactivity patterns in every component
		if (typeof window !== 'undefined') {
			window.location.reload();
		}
	}

	t(key: string, values?: Record<string, any>): string {
		return this.provider.t(key, values);
	}

	plural(key: string, options: PluralOptions): string {
		return this.provider.plural?.(key, options) ?? this.provider.t(key, options);
	}

	formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
		if (this.provider.formatNumber) {
			return this.provider.formatNumber(value, options);
		}
		return new Intl.NumberFormat(this.provider.getLocale(), options).format(value);
	}

	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
		if (this.provider.formatDate) {
			return this.provider.formatDate(date, options);
		}
		return new Intl.DateTimeFormat(this.provider.getLocale(), options).format(date);
	}
}

/**
 * Factory function to create a Svelte i18n provider
 * @param provider - Base I18nProvider to wrap
 * @returns SvelteI18nProvider instance with reactive stores
 */
export function createSvelteI18nProvider(provider: I18nProvider): SvelteI18nProvider {
	return new SvelteI18nProvider(provider);
}

/**
 * Helper function to create a Svelte provider with the default implementation
 * @param locale - Initial locale code (ignored if locale is stored in localStorage)
 * @param customMessages - Optional custom translations to add or override framework defaults
 * @returns SvelteI18nProvider instance
 */
export async function createDefaultSvelteI18nProvider(
	locale: LocaleCode = 'en-US',
	customMessages?: Record<string, LocaleMessages>
): Promise<SvelteI18nProvider> {
	const { DefaultI18nProvider } = await import('../core/I18n.js');

	// DefaultI18nProvider constructor reads from localStorage automatically
	// Pass the locale parameter as fallback if nothing in localStorage
	const provider = new DefaultI18nProvider(locale, customMessages);

	// Get the actual locale that will be used (either from localStorage or fallback)
	const actualLocale = provider.getLocale() as FrameworkLocaleCode;

	// Load the locale if it's not en-US (en-US is already loaded eagerly)
	if (actualLocale !== 'en-US') {
		try {
			await provider.loadLocale(actualLocale);
		} catch (error) {
			// If framework locale doesn't exist, assume it's a custom locale
			console.debug(`[i18n] Locale '${actualLocale}' not available as framework locale, assuming custom locale`);
		}
	}

	return createSvelteI18nProvider(provider);
}
