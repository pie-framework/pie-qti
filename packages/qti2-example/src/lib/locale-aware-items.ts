/**
 * Locale-Aware Sample Items
 *
 * Provides utilities to get sample items in the user's selected locale.
 * Falls back gracefully when translations aren't available.
 */

import type { LocaleCode } from '@pie-qti/qti2-i18n';
import { SAMPLE_ITEMS, type SampleItem } from './sample-items.js';
import {
	loadItemsForLocale,
	hasMultilingualVariant as hasMultilingualVariantImport,
	getMultilingualItemIds,
} from './sample-items-i18n.js';

/**
 * Mapping from regular sample item IDs to multilingual base IDs
 * This maps item IDs to their i18n variants when they exist.
 * If an item has no mapping, the function will check if a multilingual
 * version exists with the same ID.
 */
const MULTILINGUAL_MAPPINGS: Record<string, string> = {
	'capital-cities': 'capital-cities',
	'drawing-interaction': 'drawing-interaction',
	'extended-text': 'extended-text',
	'graphic-gap-match-solar-system': 'graphic-gap-match-solar-system',
	'graphic-order': 'graphic-order',
	'hotspot-interaction': 'hotspot-interaction',
	'hottext-multiple': 'hottext-multiple',
	'hottext-single': 'hottext-single',
	'hottext-interaction-single': 'hottext-single', // Legacy alias
	'inline-choice': 'inline-choice',
	'match-interaction': 'match-interaction',
	'order-interaction': 'order-interaction',
	'partial-credit': 'partial-credit',
	'simple-choice': 'simple-choice',
	'slider-interaction': 'slider-interaction',
	'text-entry': 'text-entry',
};

/**
 * Get sample item XML in the specified locale, with fallback to English
 *
 * @param itemId - Sample item identifier
 * @param locale - Desired locale code (e.g., 'es-ES', 'fr-FR')
 * @returns Promise resolving to QTI XML content in the requested locale, or English if not available
 */
export async function getItemXmlForLocale(itemId: string, locale: LocaleCode): Promise<string> {
	// Check if this item has multilingual variants
	const multilingualBaseId = MULTILINGUAL_MAPPINGS[itemId];

	if (multilingualBaseId) {
		try {
			console.log(
				`[LocaleAwareItems] Item ${itemId} has multilingual support. Requested locale: ${locale}`
			);

			// Lazy-load the items for this locale
			const items = await loadItemsForLocale(locale);

			// Try to find the item
			if (items[multilingualBaseId]) {
				console.log(`[LocaleAwareItems] ✓ Exact match found for ${locale}`);
				return items[multilingualBaseId].xml;
			}

			// Try language-only match (e.g., 'es' for 'es-ES')
			const language = locale.split('-')[0];

			// Try common language variants
			const variants = [
				`${language}-${language.toUpperCase()}`, // e.g., 'es-ES'
				`${language}-US`, // e.g., 'en-US'
			];

			for (const variant of variants) {
				try {
					const variantItems = await loadItemsForLocale(variant as LocaleCode);
					if (variantItems[multilingualBaseId]) {
						console.log(`[LocaleAwareItems] ✓ Language match found: ${variant} for ${locale}`);
						return variantItems[multilingualBaseId].xml;
					}
				} catch {
					// Variant not available, continue
				}
			}

			// Fall back to en-US
			console.log(`[LocaleAwareItems] → Falling back to en-US for ${locale}`);
			const enUsItems = await loadItemsForLocale('en-US');
			if (enUsItems[multilingualBaseId]) {
				return enUsItems[multilingualBaseId].xml;
			}
		} catch (error) {
			console.warn(`[LocaleAwareItems] Error loading multilingual item for ${locale}:`, error);
		}
	}

	// No multilingual variant found, return the original English version
	console.log(`[LocaleAwareItems] Item ${itemId} has no multilingual support, using default`);
	const sampleItem = SAMPLE_ITEMS.find((item) => item.id === itemId);
	return sampleItem?.xml || '';
}

/**
 * Get available locales for a specific item
 *
 * @param itemId - Sample item identifier
 * @returns Array of locale codes available for this item
 */
export function getAvailableLocalesForItem(itemId: string): LocaleCode[] {
	const multilingualBaseId = MULTILINGUAL_MAPPINGS[itemId];

	if (multilingualBaseId && hasMultilingualVariantImport(multilingualBaseId)) {
		// Return all available locales for multilingual items
		return ['en-US', 'es-ES', 'fr-FR', 'nl-NL', 'ro-RO', 'th-TH', 'zh-CN', 'ar-SA'];
	}

	// Only English available
	return ['en-US'];
}

/**
 * Check if an item has multilingual variants
 *
 * @param itemId - Sample item identifier
 * @returns true if the item has translations available
 */
export function hasMultilingualVariants(itemId: string): boolean {
	return itemId in MULTILINGUAL_MAPPINGS;
}

/**
 * Get all sample items with their multilingual status
 *
 * @returns Array of sample items with multilingual information
 */
export function getSampleItemsWithI18nInfo(): Array<
	SampleItem & {
		hasTranslations: boolean;
		availableLocales: LocaleCode[];
	}
> {
	return SAMPLE_ITEMS.map((item) => ({
		...item,
		hasTranslations: hasMultilingualVariants(item.id),
		availableLocales: getAvailableLocalesForItem(item.id),
	}));
}
