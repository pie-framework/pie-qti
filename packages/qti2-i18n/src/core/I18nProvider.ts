/**
 * Framework-agnostic i18n provider interface
 *
 * This interface defines the contract for internationalization services.
 * Users can provide their own implementations (ICU MessageFormat, i18next, etc.)
 * or use the default implementation provided by the framework.
 */

export interface I18nProvider {
	/**
	 * Get the current locale code (e.g., 'en-US', 'fr-FR')
	 */
	getLocale(): string;

	/**
	 * Set the current locale and optionally load locale messages
	 * @param locale - BCP 47 locale code
	 */
	setLocale(locale: string): Promise<void> | void;

	/**
	 * Translate a message key with optional default and/or interpolation
	 * @param key - Message key (e.g., 'common.submit', 'assessment.question')
	 * @param defaultOrValues - Optional default string or interpolation values
	 * @param values - Optional interpolation values (if second arg is default string)
	 * @returns Translated message, default, or key if not found
	 */
	t(key: string, defaultOrValues?: Record<string, any> | string, values?: Record<string, any>): string;

	/**
	 * Optional: Pluralization support
	 * @param key - Base message key
	 * @param options - Options including count and interpolation values
	 * @returns Pluralized and translated message
	 */
	plural?(key: string, options: { count: number; [key: string]: any }): string;

	/**
	 * Optional: Format number according to locale
	 * @param value - Number to format
	 * @param options - Intl.NumberFormat options
	 * @returns Formatted number string
	 */
	formatNumber?(value: number, options?: Intl.NumberFormatOptions): string;

	/**
	 * Optional: Format date according to locale
	 * @param date - Date to format
	 * @param options - Intl.DateTimeFormat options
	 * @returns Formatted date string
	 */
	formatDate?(date: Date, options?: Intl.DateTimeFormatOptions): string;
}

/**
 * Interpolation values for dynamic message content
 */
export interface InterpolationValues {
	[key: string]: string | number;
}

/**
 * Pluralization options
 */
export interface PluralOptions {
	count: number;
	[key: string]: string | number;
}
