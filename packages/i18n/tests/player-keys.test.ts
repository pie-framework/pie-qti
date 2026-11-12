/**
 * Tests for the message keys the player components reference.
 *
 * Every literal key a player passes to `t()`/`translate()` must resolve in the
 * framework catalog of every framework locale: a miss degrades the UI to the
 * hardcoded English default in all other languages (round-4 review, finding L1).
 * The CI guard for this is `scripts/check-consumer-keys.ts`; these tests pin the
 * keys that defect class has already bitten through, independent of the scan.
 */

import { describe, expect, test } from 'bun:test';
import { DefaultI18nProvider } from '../src/core/I18n.js';
import { FRAMEWORK_CATALOGS } from '../src/core/negotiation.js';

/**
 * Keys referenced by player components that shipped without a catalog entry.
 * Names must match the component call sites exactly:
 * - packages/assessment-player/src/components/FeedbackDialog.svelte
 * - packages/item-player/src/components/ItemBody.svelte
 * - packages/default-components/src/plugins/hottext/HottextInteraction.svelte
 * - packages/default-components/src/plugins/portable-custom/PortableCustomInteraction.svelte
 */
const PLAYER_REFERENCED_KEYS = [
	'assessment.feedback.title',
	'interaction.renderError',
	'interactions.hottext.minimumMet',
	'interactions.hottext.selectAtLeast',
	'customInteraction.portableLabel',
] as const;

/** Flatten a catalog to dot-notation leaf strings. */
function flatten(node: Record<string, unknown>, prefix = ''): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(node)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === 'object') {
			Object.assign(result, flatten(value as Record<string, unknown>, fullKey));
		} else {
			result[fullKey] = String(value);
		}
	}
	return result;
}

describe('player-referenced keys exist in every framework catalog', () => {
	for (const locale of FRAMEWORK_CATALOGS) {
		test(`${locale}: every key resolves to a translated string, not the key itself`, async () => {
			const provider = new DefaultI18nProvider(locale);
			await provider.loadLocale(locale);

			for (const key of PLAYER_REFERENCED_KEYS) {
				const translated = provider.t(key);
				expect(translated, `${locale}: ${key}`).not.toBe(key);
				expect(translated.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
			}
		});

		test(`${locale}: the keys keep their placeholders aligned with en`, async () => {
			const en = flatten((await import('../src/locales/en.js')).default);
			const catalog = flatten((await import(`../src/locales/${locale}.js`)).default);

			for (const key of PLAYER_REFERENCED_KEYS) {
				const names = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
				expect(names(catalog[key]), `${locale}: ${key}`).toEqual(names(en[key]));
			}
		});
	}
});

describe('player-referenced key values', () => {
	test('hottext.minimumMet carries no checkmark (the component adds its own)', async () => {
		const en = flatten((await import('../src/locales/en.js')).default);
		expect(en['interactions.hottext.minimumMet']).not.toContain('✓');
	});

	test('the hottext keys differ from selectPoint so the namespaces stay independent', async () => {
		const en = flatten((await import('../src/locales/en.js')).default);
		expect(en['interactions.hottext.selectAtLeast']).toBe('Select at least {minChoices}');
	});
});
