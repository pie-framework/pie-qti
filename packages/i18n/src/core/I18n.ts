/**
 * Default I18n provider implementation
 *
 * This is the framework's default implementation of the I18nProvider interface.
 * It uses standard dynamic imports for lazy locale loading and provides simple
 * interpolation and pluralization support.
 */

import type { I18nProvider, InterpolationValues, PluralOptions } from './I18nProvider.js';
import type { LocaleCode, FrameworkLocaleCode, MessageKey, LocaleMessages } from './types.js';
import enUS from '../locales/en-US.js';

/**
 * Lazy loaders for the framework locales.
 *
 * An explicit static map rather than a bundler macro: `tsc` emits these
 * `import()` calls verbatim, so the published package evaluates anywhere ESM
 * does — webpack, esbuild, Rollup, Node, or a browser loading the files
 * directly. Every bundler still sees the specifiers statically, so each locale
 * remains its own chunk and a host that only renders English never fetches the
 * others. Adding a locale means adding a line here alongside the file.
 *
 * en-US is a plain static import because it is the fallback for every missing
 * key in every other locale, so it must be resolvable synchronously in the
 * constructor.
 */
const localeLoaders: Record<FrameworkLocaleCode, () => Promise<{ default: LocaleMessages }>> = {
	'en-US': () => Promise.resolve({ default: enUS }),
	'ar-SA': () => import('../locales/ar-SA.js'),
	'es-ES': () => import('../locales/es-ES.js'),
	'fr-FR': () => import('../locales/fr-FR.js'),
	'nl-NL': () => import('../locales/nl-NL.js'),
	'ro-RO': () => import('../locales/ro-RO.js'),
	'th-TH': () => import('../locales/th-TH.js'),
	'zh-CN': () => import('../locales/zh-CN.js'),
};

/**
 * Whether to log missing-translation warnings.
 *
 * `process` does not exist in a plain browser, so the read is guarded rather
 * than bare: an unguarded `process.env.NODE_ENV` throws a ReferenceError on the
 * missing-key path for any consumer that is not running the code through a
 * bundler that substitutes it.
 */
const isDevelopment: boolean =
	typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

/**
 * Right-to-left primary language subtags.
 *
 * Only consulted when `Intl.Locale.prototype.textInfo` is unavailable — it is the
 * authoritative source but shipped late in Safari, and an assessment rendered
 * left-to-right for an Arabic reader is not a graceful degradation.
 */
const RTL_LANGUAGES = new Set([
	'ar', // Arabic
	'ckb', // Central Kurdish
	'dv', // Dhivehi
	'fa', // Persian
	'he',
	'iw', // Hebrew (current and legacy subtags)
	'ks', // Kashmiri
	'ku', // Kurdish
	'nqo', // N'Ko
	'ps', // Pashto
	'sd', // Sindhi
	'syr', // Syriac
	'ug', // Uyghur
	'ur', // Urdu
	'yi', // Yiddish
]);

export class DefaultI18nProvider implements I18nProvider {
	/** Shared across instances: constructing Intl.PluralRules is not cheap */
	private static pluralRules: Map<LocaleCode, Intl.PluralRules> = new Map();

	private currentLocale: LocaleCode;
	private messages: Record<LocaleCode, LocaleMessages>;
	private customMessages: Record<string, LocaleMessages>; // Client-provided translations
	private fallbackLocale: LocaleCode = 'en-US';
	private loadedLocales: Set<LocaleCode> = new Set();

	constructor(locale: LocaleCode = 'en-US', customMessages?: Record<string, LocaleMessages>) {
		// Read persisted locale from localStorage if available
		// This allows locale changes to persist across page reloads
		const storedLocale = typeof localStorage !== 'undefined'
			? localStorage.getItem('pie-qti-locale')
			: null;

		this.currentLocale = (storedLocale as LocaleCode) || locale;
		this.messages = {} as Record<LocaleCode, LocaleMessages>;
		this.customMessages = customMessages || {};

		// en-US is the fallback for every other locale, so it is always present
		this.messages['en-US'] = enUS;
		this.loadedLocales.add('en-US');
	}

	/**
	 * Load locale messages dynamically (framework locales only)
	 * For custom locales, use the customMessages parameter in the constructor or addCustomMessages()
	 */
	async loadLocale(locale: FrameworkLocaleCode): Promise<void> {
		if (this.loadedLocales.has(locale)) {
			return; // Already loaded
		}

		try {
			const loader = localeLoaders[locale];

			if (!loader) {
				throw new Error(`Locale '${locale}' is not a framework locale`);
			}

			const module = await loader();
			this.messages[locale] = module.default;
			this.loadedLocales.add(locale);
		} catch (error) {
			console.error(`[i18n] Failed to load locale '${locale}':`, error);
			throw error;
		}
	}

	/**
	 * Set current locale
	 * For framework locales, loadLocale() should be called first.
	 * For custom locales, translations should be provided via customMessages.
	 */
	setLocale(locale: string): void {
		// Allow setting custom locales even if not in loadedLocales
		// They will use customMessages + fallback to en-US
		if (!this.loadedLocales.has(locale as LocaleCode) && !this.customMessages[locale]) {
			console.warn(`[i18n] Locale '${locale}' not loaded and no custom messages provided. Using fallback locale.`);
		}
		this.currentLocale = locale as LocaleCode;
	}

	/**
	 * Get current locale
	 */
	getLocale(): string {
		return this.currentLocale;
	}

	/**
	 * Translate message key with optional default and/or interpolation
	 * @example t('upload.label') => "Upload a file"
	 * @example t('upload.label', 'Upload') => translated or "Upload" if missing
	 * @example t('upload.selected', { name: 'file.pdf' }) => "Selected: file.pdf"
	 */
	t(key: string, defaultOrValues?: Record<string, any> | string, values?: Record<string, any>): string {
		const message = this.getMessage(key);
		const interpolationValues = typeof defaultOrValues === 'object' && defaultOrValues !== null
			? defaultOrValues
			: values;
		const defaultStr = typeof defaultOrValues === 'string' ? defaultOrValues : undefined;

		if (!message) {
			if (isDevelopment) {
				console.warn(`[i18n] Missing translation: ${key} (locale: ${this.currentLocale})`);
			}
			return defaultStr ?? key;
		}

		if (!interpolationValues) return message;

		// Simple interpolation: replace {key} with values[key]
		return message.replace(/\{(\w+)\}/g, (match, k) => {
			return String(interpolationValues[k] ?? match);
		});
	}

	/**
	 * Pluralization support
	 *
	 * The plural category comes from `Intl.PluralRules` for the active locale, so
	 * locales with more than two forms resolve correctly: Arabic selects between
	 * zero/one/two/few/many/other, Romanian between one/few/other. A locale whose
	 * catalog does not carry the selected category falls back to `.other`.
	 *
	 * @example plural('plurals.files', { count: 1 }) => "1 file selected"
	 * @example plural('plurals.files', { count: 5 }) => "5 files selected"
	 */
	plural(key: string, options: PluralOptions): string {
		const { count } = options;
		const category = this.selectPluralCategory(count);
		const categoryKey = `${key}.${category}`;
		const pluralKey = this.getMessage(categoryKey) !== undefined ? categoryKey : `${key}.other`;
		return this.t(pluralKey, options);
	}

	/**
	 * Select the CLDR plural category for a count in the active locale
	 *
	 * Falls back to the English one/other split if the locale tag is not one
	 * `Intl.PluralRules` accepts — a host may set an arbitrary custom locale code.
	 */
	private selectPluralCategory(count: number): Intl.LDMLPluralRule {
		let rules = DefaultI18nProvider.pluralRules.get(this.currentLocale);

		if (!rules) {
			try {
				rules = new Intl.PluralRules(this.currentLocale);
			} catch {
				return count === 1 ? 'one' : 'other';
			}
			DefaultI18nProvider.pluralRules.set(this.currentLocale, rules);
		}

		return rules.select(count);
	}

	/**
	 * Writing direction of the current locale
	 *
	 * @example getDirection() => 'rtl' for ar-SA, 'ltr' for en-US
	 */
	getDirection(): 'ltr' | 'rtl' {
		try {
			// textInfo is the authoritative CLDR answer where the engine has it
			const textInfo = (new Intl.Locale(this.currentLocale) as { textInfo?: { direction?: string } })
				.textInfo;
			if (textInfo?.direction === 'rtl' || textInfo?.direction === 'ltr') {
				return textInfo.direction;
			}
		} catch {
			// Not a tag Intl.Locale accepts; the subtag check below still works
		}

		const language = this.currentLocale.toLowerCase().split(/[-_]/)[0] ?? '';
		return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
	}

	/**
	 * A view of this provider fixed to another locale
	 *
	 * Catalogs, loaded-locale bookkeeping and custom messages are shared by
	 * reference, so `loadLocale()` through either side is visible to both and no
	 * catalog is parsed twice. This is what lets two players on one page render
	 * different locales from one provider: the locale is per-view, the catalogs
	 * are per-provider.
	 */
	withLocale(locale: LocaleCode): I18nProvider {
		if (locale === this.currentLocale) return this;

		const view = new DefaultI18nProvider(locale, this.customMessages);
		// The constructor prefers a persisted locale; an explicit view must not.
		view.currentLocale = locale;
		view.messages = this.messages;
		view.loadedLocales = this.loadedLocales;
		return view;
	}

	/**
	 * Format number according to locale
	 */
	formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
		return new Intl.NumberFormat(this.currentLocale, options).format(value);
	}

	/**
	 * Format date according to locale
	 */
	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
		return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
	}

	/**
	 * Get nested message by dot notation key
	 * Priority: custom messages > current locale > fallback locale
	 */
	private getMessage(key: string): string | undefined {
		// 1. Try custom messages first (client overrides)
		const customMessage = this.getMessageFromObject(key, this.customMessages[this.currentLocale]);
		if (customMessage !== undefined) return customMessage;

		// 2. Try current locale from framework defaults
		const messages = this.messages[this.currentLocale];
		if (messages) {
			const message = this.getMessageFromObject(key, messages);
			if (message !== undefined) return message;
		}

		// 3. Try custom fallback locale
		const customFallback = this.getMessageFromObject(key, this.customMessages[this.fallbackLocale]);
		if (customFallback !== undefined) return customFallback;

		// 4. Try framework fallback locale
		return this.getMessageFromFallback(key);
	}

	/**
	 * Get message from a specific messages object
	 *
	 * Resolves to a string or nothing. A key that lands on a namespace branch
	 * (`t('common')`) or on a plural sub-object (`t('plurals.items')`) is a miss,
	 * not a hit: returning the branch would put an object where the caller
	 * expects a string, and interpolating one throws.
	 */
	private getMessageFromObject(key: string, messages: any): string | undefined {
		if (!messages) return undefined;

		const parts = key.split('.');
		let current: any = messages;

		for (const part of parts) {
			if (current === null || typeof current !== 'object') return undefined;
			current = current[part];
			if (current === undefined) return undefined;
		}

		return typeof current === 'string' ? current : undefined;
	}

	/**
	 * Get message from fallback locale (framework defaults)
	 */
	private getMessageFromFallback(key: string): string | undefined {
		const messages = this.messages[this.fallbackLocale];
		return this.getMessageFromObject(key, messages);
	}

	/**
	 * Add or update custom messages for a locale
	 * This allows clients to provide their own translations or override defaults
	 */
	addCustomMessages(locale: string, messages: LocaleMessages): void {
		this.customMessages[locale] = this.deepMerge(
			this.customMessages[locale] || {},
			messages
		);
	}

	/**
	 * Deep merge two objects (for merging translation objects)
	 */
	private deepMerge(target: any, source: any): any {
		const result = { ...target };
		for (const key in source) {
			if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(result[key] || {}, source[key]);
			} else {
				result[key] = source[key];
			}
		}
		return result;
	}
}

/**
 * Factory function to create a default i18n provider instance
 * @param locale - Initial locale code (default: 'en-US')
 * @param customMessages - Optional custom translations to add or override framework defaults
 * @returns DefaultI18nProvider instance
 */
export function createDefaultI18nProvider(
	locale: LocaleCode = 'en-US',
	customMessages?: Record<string, LocaleMessages>
): I18nProvider {
	return new DefaultI18nProvider(locale, customMessages);
}

export type { LocaleCode, MessageKey, InterpolationValues, PluralOptions };
