/**
 * Type definitions for i18n system
 */

import type enUS from '../locales/en-US.js';

// Framework-provided locale codes (BCP 47 format)
// The framework provides a minimal set of locales. Clients can provide their own
// translations for additional locales via the customMessages parameter.
export type FrameworkLocaleCode =
	| 'en-US'  // English (United States)
	| 'es-ES'  // Spanish (Spain)
	| 'fr-FR'  // French (France)
	| 'nl-NL'  // Dutch (Netherlands)
	| 'ro-RO'  // Romanian (Romania)
	| 'th-TH'; // Thai (Thailand)

// Allow any locale code (clients can provide custom locales)
export type LocaleCode = FrameworkLocaleCode | (string & {});

// Utility type to extract nested keys as dot-notation strings
type NestedKeyOfHelper<ObjectType extends object> = {
	[Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
		? `${Key}` | `${Key}.${NestedKeyOfHelper<ObjectType[Key]>}`
		: `${Key}`;
}[keyof ObjectType & (string | number)];

// Message key generated from English locale structure
export type MessageKey = NestedKeyOfHelper<typeof enUS>;

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
