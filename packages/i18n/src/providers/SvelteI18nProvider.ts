/**
 * Svelte-specific I18n provider.
 *
 * Wraps any I18nProvider. `setLocale()` loads the catalog the locale negotiates
 * to and switches the wrapped provider. Persisting the locale to localStorage
 * and reloading the page afterwards are opt-in (`SvelteI18nProviderOptions`):
 * a host that turns on reload gets every component re-rendered in the new
 * locale without reactive stores; a host that does not re-renders itself.
 */

import type { I18nProvider, PluralOptions } from '../core/I18nProvider.js';
import type { LocaleCode, LocaleMessages } from '../core/types.js';

/** The localStorage key `persistLocale` writes by default. */
export const DEFAULT_LOCALE_STORAGE_KEY = 'pie-qti-locale';

export interface SvelteI18nProviderOptions {
	/**
	 * Write the locale to localStorage on `setLocale()`. Off by default. The
	 * provider never reads it back: a host that persists reads the key at startup
	 * and passes the value as the locale, so the host stays the only locale driver.
	 */
	persistLocale?: boolean;
	/** localStorage key for `persistLocale`. Defaults to `'pie-qti-locale'`. */
	storageKey?: string;
	/** Reload the page after `setLocale()`. Off by default. */
	reloadOnLocaleChange?: boolean;
}

export class SvelteI18nProvider implements I18nProvider {
	private provider: I18nProvider;
	private options: SvelteI18nProviderOptions;

	constructor(provider: I18nProvider, options: SvelteI18nProviderOptions = {}) {
		this.provider = provider;
		this.options = options;
	}

	getLocale(): string {
		return this.provider.getLocale();
	}

	async setLocale(locale: string): Promise<void> {
		// DefaultI18nProvider negotiates the tag and resolves without loading when
		// no framework catalog serves it, so only a failed module load lands here.
		if ('loadLocale' in this.provider && typeof this.provider.loadLocale === 'function') {
			try {
				await this.provider.loadLocale(locale);
			} catch {
				console.debug(`[i18n] Locale '${locale}' failed to load; rendering through the fallback locale`);
			}
		}

		const result = this.provider.setLocale(locale);
		if (result instanceof Promise) {
			await result;
		}

		if (this.options.persistLocale && typeof localStorage !== 'undefined') {
			localStorage.setItem(this.options.storageKey ?? DEFAULT_LOCALE_STORAGE_KEY, locale);
		}

		if (this.options.reloadOnLocaleChange && typeof window !== 'undefined') {
			window.location.reload();
		}
	}

	t(key: string, defaultOrValues?: Record<string, any> | string, values?: Record<string, any>): string {
		return this.provider.t(key, defaultOrValues, values);
	}

	plural(key: string, options: PluralOptions): string {
		return this.provider.plural?.(key, options) ?? this.provider.t(key, options);
	}

	getDirection(): 'ltr' | 'rtl' {
		return this.provider.getDirection?.() ?? 'ltr';
	}

	/**
	 * A locale-scoped view of the wrapped provider, with its `ready` intact.
	 *
	 * The view does not inherit persistence or reload-on-setLocale: a
	 * per-element locale override exists precisely to avoid page-wide effects.
	 */
	withLocale(locale: string): I18nProvider {
		const view = this.provider.withLocale?.(locale);
		return view ?? this.provider;
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
 * @param options - Opt-in persistence and reload behaviour
 */
export function createSvelteI18nProvider(
	provider: I18nProvider,
	options?: SvelteI18nProviderOptions
): SvelteI18nProvider {
	return new SvelteI18nProvider(provider, options);
}

/**
 * Helper function to create a Svelte provider with the default implementation,
 * its locale's catalog already loaded
 * @param locale - Initial locale tag; the host owns it (no storage is read)
 * @param customMessages - Optional custom translations to add or override framework defaults
 * @param options - Opt-in persistence and reload behaviour
 */
export async function createDefaultSvelteI18nProvider(
	locale: LocaleCode = 'en-US',
	customMessages?: Record<string, LocaleMessages>,
	options?: SvelteI18nProviderOptions
): Promise<SvelteI18nProvider> {
	const { DefaultI18nProvider } = await import('../core/I18n.js');
	const provider = new DefaultI18nProvider(locale, customMessages);

	try {
		await provider.loadLocale(locale);
	} catch {
		console.debug(`[i18n] Locale '${locale}' failed to load; rendering through the fallback locale`);
	}

	return createSvelteI18nProvider(provider, options);
}
