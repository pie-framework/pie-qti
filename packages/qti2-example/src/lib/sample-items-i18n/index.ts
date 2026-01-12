/**
 * Sample Items i18n Index - Lazy Loading
 *
 * This module provides lazy-loaded access to locale-specific sample item data.
 * Language files are only loaded when needed, reducing initial bundle size.
 *
 * Each locale file contains translations of 10 QTI assessment items.
 */

import type { LocaleCode } from '@pie-qti/qti2-i18n';

export interface LocalizedItemData {
	title: string;
	description: string;
	xml: string;
}

/**
 * All available locales for multilingual sample items
 */
export const AVAILABLE_LOCALES = [
	'en-US',
	'es-ES',
	'fr-FR',
	'nl-NL',
	'ro-RO',
	'th-TH',
	'zh-CN',
	'ar-SA',
] as const;

export type AvailableLocale = (typeof AVAILABLE_LOCALES)[number];

/**
 * Cache for loaded locale data to avoid re-fetching
 */
const localeCache = new Map<string, Record<string, LocalizedItemData>>();

/**
 * Lazy-load items for a specific locale
 * Uses dynamic imports for automatic code-splitting by Vite
 *
 * @param locale - The locale code (e.g., 'es-ES', 'fr-FR')
 * @returns Promise resolving to a Record of item IDs to localized data
 */
export async function loadItemsForLocale(
	locale: AvailableLocale | LocaleCode
): Promise<Record<string, LocalizedItemData>> {
	// Check cache first
	if (localeCache.has(locale)) {
		return localeCache.get(locale)!;
	}

	// Dynamic import based on locale
	// Vite will automatically code-split these into separate chunks
	let items: Record<string, LocalizedItemData>;

	switch (locale) {
		case 'en-US':
			items = (await import('./en-US.js')).ITEMS_EN_US;
			break;
		case 'es-ES':
			items = (await import('./es-ES.js')).ITEMS_ES_ES;
			break;
		case 'fr-FR':
			items = (await import('./fr-FR.js')).ITEMS_FR_FR;
			break;
		case 'nl-NL':
			items = (await import('./nl-NL.js')).ITEMS_NL_NL;
			break;
		case 'ro-RO':
			items = (await import('./ro-RO.js')).ITEMS_RO_RO;
			break;
		case 'th-TH':
			items = (await import('./th-TH.js')).ITEMS_TH_TH;
			break;
		case 'zh-CN':
			items = (await import('./zh-CN.js')).ITEMS_ZH_CN;
			break;
		case 'ar-SA':
			items = (await import('./ar-SA.js')).ITEMS_AR_SA;
			break;
		default:
			throw new Error(`Unsupported locale for multilingual items: ${locale}`);
	}

	// Cache for future use
	localeCache.set(locale, items);
	return items;
}

/**
 * Get list of item IDs that have multilingual support
 * This is synchronous and returns the same list for all locales
 */
export function getMultilingualItemIds(): string[] {
	return [
		'capital-cities',
		'drawing-interaction',
		'extended-text',
		'graphic-gap-match-solar-system',
		'graphic-order',
		'hotspot-interaction',
		'hottext-multiple',
		'hottext-single',
		'inline-choice',
		'match-interaction',
		'order-interaction',
		'partial-credit',
		'simple-choice',
		'slider-interaction',
		'text-entry',
	];
}

/**
 * Check if an item ID has multilingual variants
 */
export function hasMultilingualVariant(itemId: string): boolean {
	return getMultilingualItemIds().includes(itemId);
}
