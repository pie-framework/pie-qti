/**
 * Type definitions for i18n system
 */

import type enUS from '../locales/en-US.js';

// Supported locale codes (BCP 47 format)
export type LocaleCode =
	| 'en-US' | 'en-GB' | 'en-AU' | 'en-CA'
	| 'es-ES' | 'fr-FR' | 'de-DE' | 'pt-BR'
	| 'nl-NL' | 'it-IT' | 'pl-PL' | 'ro-RO'
	| 'cs-CZ' | 'hu-HU' | 'tr-TR' | 'uk-UA'
	| 'fi-FI' | 'sv-SE' | 'da-DK' | 'nb-NO'
	| 'th-TH' | 'zh-CN' | 'ar-SA' | 'ja-JP' | 'ko-KR' | 'hi-IN';

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
