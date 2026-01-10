/**
 * Core I18n class for message translation and locale management
 */

import type {
	LocaleCode,
	MessageKey,
	InterpolationValues,
	PluralOptions,
	LocaleMessages,
} from './types.js';

export class I18n {
	private currentLocale: LocaleCode;
	private messages: Record<LocaleCode, LocaleMessages>;
	private fallbackLocale: LocaleCode = 'en-US';
	private loadedLocales: Set<LocaleCode> = new Set();

	constructor(locale: LocaleCode = 'en-US') {
		this.currentLocale = locale;
		this.messages = {} as Record<LocaleCode, LocaleMessages>;
	}

	/**
	 * Load locale messages dynamically
	 */
	async loadLocale(locale: LocaleCode): Promise<void> {
		if (this.loadedLocales.has(locale)) {
			return; // Already loaded
		}

		try {
			const module = await import(`../locales/${locale}.js`);
			this.messages[locale] = module.default;
			this.loadedLocales.add(locale);
		} catch (error) {
			console.error(`[i18n] Failed to load locale '${locale}':`, error);
			throw error;
		}
	}

	/**
	 * Set current locale (must be loaded first)
	 */
	setLocale(locale: LocaleCode): void {
		if (!this.loadedLocales.has(locale)) {
			console.warn(`[i18n] Locale '${locale}' not loaded. Call loadLocale() first.`);
			return;
		}
		this.currentLocale = locale;
	}

	/**
	 * Get current locale
	 */
	getLocale(): LocaleCode {
		return this.currentLocale;
	}

	/**
	 * Translate message key with optional interpolation
	 * @example t('upload.label') => "Upload a file"
	 * @example t('upload.selected', { name: 'file.pdf' }) => "Selected: file.pdf"
	 */
	t(key: MessageKey, values?: InterpolationValues): string {
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
	plural(key: MessageKey, options: PluralOptions): string {
		const { count } = options;
		const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
		return this.t(pluralKey as MessageKey, options);
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
	 */
	private getMessage(key: string): string | undefined {
		const messages = this.messages[this.currentLocale];
		if (!messages) return undefined;

		const parts = key.split('.');
		let current: any = messages;

		for (const part of parts) {
			current = current[part];
			if (current === undefined) {
				// Try fallback locale
				return this.getMessageFromFallback(key);
			}
		}

		return current;
	}

	/**
	 * Get message from fallback locale
	 */
	private getMessageFromFallback(key: string): string | undefined {
		const messages = this.messages[this.fallbackLocale];
		if (!messages) return undefined;

		const parts = key.split('.');
		let current: any = messages;

		for (const part of parts) {
			current = current[part];
			if (current === undefined) return undefined;
		}

		return current;
	}
}

export type { LocaleCode, MessageKey, InterpolationValues, PluralOptions };
