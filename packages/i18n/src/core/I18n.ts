/**
 * Default I18n provider implementation
 *
 * This is the framework's default implementation of the I18nProvider interface.
 * It uses standard dynamic imports for lazy locale loading and provides simple
 * interpolation and pluralization support.
 */

import type { I18nProvider, InterpolationValues, PluralOptions } from './I18nProvider.js';
import type { LocaleCode, MessageKey, LocaleMessages } from './types.js';
import { languageDirection } from './direction.js';
import { normalizeLanguageTag } from './language-tags.js';
import {
	FRAMEWORK_CATALOGS,
	type FrameworkCatalogCode,
	localeLookupSequence,
	resolveFrameworkLocale,
	stepServes,
} from './negotiation.js';
import en from '../locales/en.js';

/**
 * Lazy loaders for the framework catalogs, keyed by language.
 *
 * An explicit static map rather than a bundler macro: `tsc` emits these
 * `import()` calls verbatim, so the published package evaluates anywhere ESM
 * does — webpack, esbuild, Rollup, Node, or a browser loading the files
 * directly. Every bundler still sees the specifiers statically, so each locale
 * remains its own chunk and a host that only renders English never fetches the
 * others. Adding a locale means adding a line here alongside the file and its
 * key in `FRAMEWORK_CATALOGS`.
 *
 * `en` is a plain static import because it is the fallback for every missing
 * key in every other locale, so it must be resolvable synchronously in the
 * constructor.
 */
const localeLoaders: Record<FrameworkCatalogCode, () => Promise<{ default: LocaleMessages }>> = {
	en: () => Promise.resolve({ default: en }),
	ar: () => import('../locales/ar.js'),
	es: () => import('../locales/es.js'),
	fr: () => import('../locales/fr.js'),
	nl: () => import('../locales/nl.js'),
	ro: () => import('../locales/ro.js'),
	th: () => import('../locales/th.js'),
	'zh-Hans': () => import('../locales/zh-Hans.js'),
};

/** Catalog keys by their normalized form, which is what a lookup step is. */
const catalogsByStep = new Map<string, FrameworkCatalogCode>(
	FRAMEWORK_CATALOGS.map((code) => [normalizeLanguageTag(code), code])
);

/**
 * The locale every lookup falls back to. Walked like any other tag, so custom
 * messages keyed `en-US` and the framework `en` catalog both serve it.
 */
const FALLBACK_LOCALE = 'en-US';

/**
 * A tag `Intl` accepts for the active locale: POSIX separators and suffixes
 * are rewritten (`ar_SA` → `ar-SA`), and a tag `Intl` still rejects formats as
 * English rather than throwing.
 */
function intlLocale(tag: string): string {
	const candidate = tag.trim().replace(/_/g, '-').split(/[.@]/)[0];
	try {
		return Intl.getCanonicalLocales(candidate)[0] ?? FALLBACK_LOCALE;
	} catch {
		return FALLBACK_LOCALE;
	}
}

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

export class DefaultI18nProvider implements I18nProvider {
	/** Shared across instances: constructing Intl.PluralRules is not cheap */
	private static pluralRules: Map<string, Intl.PluralRules> = new Map();

	private currentLocale: LocaleCode;
	private messages: Partial<Record<FrameworkCatalogCode, LocaleMessages>>;
	private customMessages: Record<string, LocaleMessages>; // Client-provided translations
	private loadedLocales: Set<FrameworkCatalogCode> = new Set();
	private pendingLoads: Map<FrameworkCatalogCode, Promise<void>> = new Map();

	/**
	 * Settles once the catalog for this provider's locale is loaded. Set only on
	 * a `withLocale()` view created before that catalog was resident; the view
	 * starts the load itself. Never rejects: a failed load is logged and the view
	 * keeps rendering through the English fallback.
	 */
	ready?: Promise<void>;

	/**
	 * @param locale - Active locale; any BCP 47 or POSIX tag. The host owns this
	 *   value: the provider reads no storage and persists nothing.
	 * @param customMessages - Host translations by locale tag, consulted before
	 *   the framework catalogs.
	 */
	constructor(locale: LocaleCode = 'en-US', customMessages?: Record<string, LocaleMessages>) {
		this.currentLocale = locale;
		this.messages = {};
		this.customMessages = customMessages || {};

		// en is the fallback for every other locale, so it is always present
		this.messages.en = en;
		this.loadedLocales.add('en');
	}

	/**
	 * Load the framework catalog that serves a locale tag.
	 *
	 * The tag is negotiated (`es-MX` loads `es`, `zh-CN` loads `zh-Hans`). A tag
	 * no framework catalog serves resolves without loading anything: it renders
	 * from custom messages and the English fallback. Rejects only when a catalog
	 * module fails to load.
	 */
	async loadLocale(locale: LocaleCode): Promise<void> {
		const code = resolveFrameworkLocale(locale);
		if (!code || this.loadedLocales.has(code)) return;

		let pending = this.pendingLoads.get(code);
		if (!pending) {
			pending = localeLoaders[code]()
				.then((module) => {
					this.messages[code] = module.default;
					this.loadedLocales.add(code);
				})
				.finally(() => {
					this.pendingLoads.delete(code);
				});
			this.pendingLoads.set(code, pending);
		}

		try {
			await pending;
		} catch (error) {
			console.error(`[i18n] Failed to load locale '${locale}':`, error);
			throw error;
		}
	}

	/**
	 * Whether every catalog a locale needs is resident: true for a tag no
	 * framework catalog serves, since there is nothing to load.
	 */
	isLocaleLoaded(locale: LocaleCode): boolean {
		const code = resolveFrameworkLocale(locale);
		return !code || this.loadedLocales.has(code);
	}

	/**
	 * Set current locale
	 * For framework locales, loadLocale() should be called first.
	 * For custom locales, translations should be provided via customMessages.
	 */
	setLocale(locale: string): void {
		const hasCustom = Object.keys(this.customMessages).some((tag) => localeLookupSequence(locale).includes(normalizeLanguageTag(tag)));
		if (!this.isLocaleLoaded(locale) && !hasCustom) {
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
			rules = new Intl.PluralRules(intlLocale(this.currentLocale));
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
		return languageDirection(this.currentLocale);
	}

	/**
	 * A view of this provider fixed to another locale
	 *
	 * Catalogs, loaded-locale bookkeeping and custom messages are shared by
	 * reference, so `loadLocale()` through either side is visible to both and no
	 * catalog is parsed twice. This is what lets two players on one page render
	 * different locales from one provider: the locale is per-view, the catalogs
	 * are per-provider.
	 *
	 * When the catalog its locale negotiates to is not resident, the view loads
	 * it and `ready` settles when that load does; until then it renders through
	 * the English fallback. A view over a resident catalog has no `ready`.
	 */
	withLocale(locale: LocaleCode): DefaultI18nProvider {
		if (locale === this.currentLocale && this.isLocaleLoaded(locale)) return this;

		const view = new DefaultI18nProvider(locale, this.customMessages);
		view.messages = this.messages;
		view.loadedLocales = this.loadedLocales;
		view.pendingLoads = this.pendingLoads;
		if (!view.isLocaleLoaded(locale)) {
			// loadLocale() has already logged a failure; the view falls back to English.
			view.ready = view.loadLocale(locale).catch(() => {});
		}
		return view;
	}

	/**
	 * Format number according to locale
	 */
	formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
		return new Intl.NumberFormat(intlLocale(this.currentLocale), options).format(value);
	}

	/**
	 * Format date according to locale
	 */
	formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
		return new Intl.DateTimeFormat(intlLocale(this.currentLocale), options).format(date);
	}

	/**
	 * Get nested message by dot notation key
	 *
	 * Walks the active locale's negotiation sequence, then the English fallback's.
	 * At each step custom messages come before the framework catalog, so for
	 * `es-MX` the order is custom `es-MX`, custom `es`, framework `es`, custom
	 * `en-US`, custom `en`, framework `en`.
	 */
	private getMessage(key: string): string | undefined {
		return this.lookupMessage(key, this.currentLocale) ?? this.lookupMessage(key, FALLBACK_LOCALE);
	}

	private lookupMessage(key: string, locale: string): string | undefined {
		const customTags = Object.keys(this.customMessages);

		for (const step of localeLookupSequence(locale)) {
			for (const tag of customTags) {
				if (normalizeLanguageTag(tag) !== step || !stepServes(locale, step, tag)) continue;
				const custom = this.getMessageFromObject(key, this.customMessages[tag]);
				if (custom !== undefined) return custom;
			}

			const code = catalogsByStep.get(step);
			if (code && stepServes(locale, step, code)) {
				const message = this.getMessageFromObject(key, this.messages[code]);
				if (message !== undefined) return message;
			}
		}

		return undefined;
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
