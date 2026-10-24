/**
 * Type definitions for i18n system
 */

import type en from '../locales/en.js';
import type { FrameworkCatalogCode } from './negotiation.js';

/**
 * Locale tags with a framework catalog.
 *
 * Catalogs are keyed by language (`FrameworkCatalogCode`: `en`, `es`, `ar`,
 * `zh-Hans` …). The region-qualified tags are kept as members because hosts
 * pass them; negotiation resolves each to its language's catalog, as it does
 * any other tag (`es-MX`, `ar_EG`). Clients provide translations for other
 * locales via the customMessages parameter.
 */
export type FrameworkLocaleCode =
	| FrameworkCatalogCode
	| 'en-US' // English (United States)
	| 'es-ES' // Spanish (Spain)
	| 'fr-FR' // French (France)
	| 'nl-NL' // Dutch (Netherlands)
	| 'ro-RO' // Romanian (Romania)
	| 'th-TH' // Thai (Thailand)
	| 'zh-CN' // Chinese (Simplified, China)
	| 'ar-SA'; // Arabic (Saudi Arabia)

// Allow any locale code (clients can provide custom locales)
export type LocaleCode = FrameworkLocaleCode | (string & {});

// Utility type to extract nested keys as dot-notation strings
type NestedKeyOfHelper<ObjectType extends object> = {
	[Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
		? `${Key}` | `${Key}.${NestedKeyOfHelper<ObjectType[Key]>}`
		: `${Key}`;
}[keyof ObjectType & (string | number)];

// Message key generated from the English catalog structure
export type MessageKey = NestedKeyOfHelper<typeof en>;

// Interpolation values for dynamic message content
export interface InterpolationValues {
	[key: string]: string | number;
}

// Pluralization options
export interface PluralOptions {
	count: number;
	[key: string]: string | number;
}

// Locale message structure
export type LocaleMessages = Record<string, any>;
