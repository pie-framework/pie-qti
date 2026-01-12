/**
 * Default I18n provider implementation
 *
 * This is the framework's default implementation of the I18nProvider interface.
 * It uses Vite's dynamic imports for lazy locale loading and provides simple
 * interpolation and pluralization support.
 */

import type { I18nProvider, InterpolationValues, PluralOptions } from './I18nProvider.js';
import type { LocaleCode, FrameworkLocaleCode, MessageKey, LocaleMessages } from './types.js';

// Use Vite's glob import to load all locales dynamically
// Load en-US eagerly (default/fallback locale), others lazily
// @ts-expect-error - import.meta.glob is a Vite feature, not standard TypeScript
const eagerLocales = import.meta.glob('../locales/en-US.ts', { eager: true });
// @ts-expect-error - import.meta.glob is a Vite feature, not standard TypeScript
const lazyLocales = import.meta.glob('../locales/*.ts', { eager: false });

// Combine both for lookup
const localeModules = { ...lazyLocales };

export class DefaultI18nProvider implements I18nProvider {
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

		// Load en-US eagerly from the eager imports to ensure immediate availability
		const enUSModule = eagerLocales['../locales/en-US.ts'] as any;
		if (enUSModule) {
			this.messages['en-US'] = enUSModule.default;
			this.loadedLocales.add('en-US');
		}
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
			const modulePath = `../locales/${locale}.ts`;
			const loader = localeModules[modulePath];

			if (!loader) {
				throw new Error(`Locale '${locale}' not found in available modules`);
			}

			const module = await loader();
			this.messages[locale] = (module as any).default;
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
	 * Translate message key with optional interpolation
	 * @example t('upload.label') => "Upload a file"
	 * @example t('upload.selected', { name: 'file.pdf' }) => "Selected: file.pdf"
	 */
	t(key: string, values?: Record<string, any>): string {
		const message = this.getMessage(key);
		if (!message) {
			if (process.env.NODE_ENV === 'development') {
				console.warn(`[i18n] Missing translation: ${key} (locale: ${this.currentLocale})`);
			}
			return key; // Fallback to key itself
		}

		if (!values) return message;

		// Simple interpolation: replace {key} with values[key]
		return message.replace(/\{(\w+)\}/g, (match, key) => {
			return String(values[key] ?? match);
		});
	}

	/**
	 * Pluralization support
	 * @example plural('upload.fileCount', { count: 1 }) => "1 file selected"
	 * @example plural('upload.fileCount', { count: 5 }) => "5 files selected"
	 */
	plural(key: string, options: PluralOptions): string {
		const { count } = options;
		const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
		return this.t(pluralKey, options);
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
	 */
	private getMessageFromObject(key: string, messages: any): string | undefined {
		if (!messages) return undefined;

		const parts = key.split('.');
		let current: any = messages;

		for (const part of parts) {
			current = current[part];
			if (current === undefined) return undefined;
		}

		return current;
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
