/**
 * Sample Items i18n - Multilingual QTI Assessment Items
 *
 * This module provides access to translated versions of sample QTI items.
 * Language files are lazy-loaded on demand for optimal bundle sizes.
 *
 * Available locales: en-US, es-ES, fr-FR, nl-NL, ro-RO, th-TH, zh-CN, ar-SA
 */

import type { LocaleCode } from '@pie-qti/qti2-i18n';
import { getMultilingualItemIds as getItemIds } from './sample-items-i18n/index.js';

// Re-export the lazy-loading API
export {
	loadItemsForLocale,
	getMultilingualItemIds,
	hasMultilingualVariant,
	AVAILABLE_LOCALES,
	type LocalizedItemData,
	type AvailableLocale,
} from './sample-items-i18n/index.js';

/**
 * Get all available locales for multilingual items
 * @returns Array of locale codes
 */
export function getAvailableLocales(): string[] {
	return [
		'en-US',
		'es-ES',
		'fr-FR',
		'nl-NL',
		'ro-RO',
		'th-TH',
		'zh-CN',
		'ar-SA',
	];
}

/**
 * Multilingual Sample Item Structure
 * Used by locale-aware-items.ts for item lookup
 */
export interface MultilingualSampleItem {
	id: string;
	baseId: string;
	locales: Record<LocaleCode, { title: string; description: string; xml: string }>;
}

/**
 * Lazy-loaded cache for multilingual items
 * Only populated when getMultilingualItem() is called
 */
const multilingualItemsCache = new Map<string, MultilingualSampleItem>();

/**
 * Get a multilingual item by ID with lazy-loaded locale data
 *
 * @param itemId - The item identifier
 * @returns MultilingualSampleItem if found, undefined otherwise
 */
export function getMultilingualItem(itemId: string): MultilingualSampleItem | undefined {
	// Check cache first
	if (multilingualItemsCache.has(itemId)) {
		return multilingualItemsCache.get(itemId);
	}

	// For now, return a placeholder that will be populated when locales are loaded
	// The actual XML loading happens in locale-aware-items.ts via loadItemsForLocale()
	const item: MultilingualSampleItem = {
		id: itemId,
		baseId: itemId,
		locales: {} as Record<LocaleCode, { title: string; description: string; xml: string }>,
	};

	multilingualItemsCache.set(itemId, item);
	return item;
}

/**
 * Legacy export for backward compatibility
 * Builds the list of multilingual items from available item IDs
 */
export const MULTILINGUAL_ITEMS: MultilingualSampleItem[] = getItemIds().map((itemId: string) => ({
	id: itemId,
	baseId: itemId,
	locales: {} as Record<LocaleCode, { title: string; description: string; xml: string }>,
}));
