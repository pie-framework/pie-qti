/**
 * Unit tests for core I18n functionality
 *
 * These exercise DefaultI18nProvider itself, not a stand-in. An earlier version
 * of this file used a hand-rolled TestI18nProvider because the real class was
 * unloadable outside Vite; the provider now uses standard dynamic imports, so
 * the tests bind to the shipped behaviour instead of a re-implementation of it.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { DefaultI18nProvider, createDefaultI18nProvider } from '../src/core/I18n.js';
import { SvelteI18nProvider } from '../src/providers/SvelteI18nProvider.js';

const LOCALE_STORAGE_KEY = 'pie-qti-locale';

/** Install a minimal localStorage; Bun's runtime has no DOM globals. */
function stubLocalStorage(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	const stub = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
	};
	(globalThis as any).localStorage = stub;
	return store;
}

function clearGlobalStubs() {
	delete (globalThis as any).localStorage;
	delete (globalThis as any).window;
}

describe('DefaultI18nProvider — lookup and interpolation', () => {
	let i18n: DefaultI18nProvider;

	beforeEach(() => {
		i18n = new DefaultI18nProvider('en-US');
	});

	test('translates a simple message', () => {
		expect(i18n.t('common.submit')).toBe('Submit');
	});

	test('translates a nested message', () => {
		expect(i18n.t('interactions.upload.label')).toBe('Upload a file');
	});

	test('translates a deeply nested message', () => {
		expect(i18n.t('interactions.graphicGapMatch.pressSpaceToPlace')).toBe(
			'Press Space or Enter to place label'
		);
	});

	test('interpolates multiple values', () => {
		expect(i18n.t('assessment.question', { current: 1, total: 10 })).toBe('Question 1 of 10');
	});

	test('interpolates a single value', () => {
		expect(i18n.t('interactions.slider.selectedValue', { value: 42 })).toBe('Selected value: 42');
	});

	test('leaves the placeholder in place when a value is not supplied', () => {
		// Deliberate: a visible {total} is a legible authoring bug, an empty
		// string is a silent one.
		expect(i18n.t('assessment.question', { current: 1 })).toBe('Question 1 of {total}');
	});

	test('returns the key when the translation is missing', () => {
		expect(i18n.t('some.missing.key')).toBe('some.missing.key');
	});

	test('returns the supplied default when the translation is missing', () => {
		expect(i18n.t('some.missing.key', 'Fallback text')).toBe('Fallback text');
	});

	test('prefers the translation over the supplied default', () => {
		expect(i18n.t('common.submit', 'Fallback text')).toBe('Submit');
	});

	test('interpolates when both a default and values are supplied', () => {
		expect(i18n.t('assessment.question', 'Q', { current: 2, total: 3 })).toBe('Question 2 of 3');
	});

	test('does not treat a namespace object as a message', () => {
		expect(i18n.t('common')).toBe('common');
	});

	test('createDefaultI18nProvider returns a working provider', () => {
		expect(createDefaultI18nProvider('en-US').t('common.submit')).toBe('Submit');
	});
});

describe('DefaultI18nProvider — fallback chain', () => {
	// Priority: custom[current] > framework[current] > custom[en-US] > framework[en-US]
	const custom = {
		'es-ES': { common: { submit: 'Custom ES' } },
		'en-US': { probe: { customOnly: 'Custom EN' } },
	};

	test('1. custom messages for the current locale win over the framework catalog', async () => {
		const i18n = new DefaultI18nProvider('es-ES', custom);
		await i18n.loadLocale('es-ES');
		expect(i18n.t('common.submit')).toBe('Custom ES');
	});

	test('2. the framework catalog for the current locale is used when no custom message exists', async () => {
		const i18n = new DefaultI18nProvider('es-ES');
		await i18n.loadLocale('es-ES');
		expect(i18n.t('common.submit')).toBe('Enviar');
	});

	test('3. custom en-US messages serve keys the current locale lacks', async () => {
		const i18n = new DefaultI18nProvider('es-ES', custom);
		await i18n.loadLocale('es-ES');
		expect(i18n.t('probe.customOnly')).toBe('Custom EN');
	});

	test('4. the framework en-US catalog is the last resort', () => {
		// A host-supplied locale with no catalog at all: every key resolves via en-US.
		const i18n = new DefaultI18nProvider('de-DE');
		expect(i18n.t('common.submit')).toBe('Submit');
	});

	test('a missing key still returns the key after exhausting the chain', async () => {
		const i18n = new DefaultI18nProvider('es-ES', custom);
		await i18n.loadLocale('es-ES');
		expect(i18n.t('probe.nowhere')).toBe('probe.nowhere');
	});
});

describe('DefaultI18nProvider — locale loading', () => {
	test('en-US is available without loading, since it backs every fallback', () => {
		const i18n = new DefaultI18nProvider('en-US');
		expect(i18n.t('common.submit')).toBe('Submit');
	});

	test('loadLocale installs the catalog for a framework locale', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		await i18n.loadLocale('es-ES');
		i18n.setLocale('es-ES');
		expect(i18n.t('common.submit')).toBe('Enviar');
	});

	test('loadLocale is idempotent — a second call is served from cache', async () => {
		const i18n = new DefaultI18nProvider('es-ES');
		await i18n.loadLocale('es-ES');
		await i18n.loadLocale('es-ES');
		expect(i18n.t('common.submit')).toBe('Enviar');
	});

	test('loadLocale rejects for a locale the framework does not ship', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		expect(i18n.loadLocale('xx-XX' as any)).rejects.toThrow(
			/Locale 'xx-XX' is not a framework locale/
		);
	});

	test('every locale in the loader map actually loads', async () => {
		const locales = ['ar-SA', 'es-ES', 'fr-FR', 'nl-NL', 'ro-RO', 'th-TH', 'zh-CN'] as const;
		for (const locale of locales) {
			const i18n = new DefaultI18nProvider('en-US');
			await i18n.loadLocale(locale);
			i18n.setLocale(locale);
			expect(i18n.t('common.submit')).toBeTruthy();
			expect(i18n.t('common.submit')).not.toBe('common.submit');
		}
	});

	test('setLocale switches the active locale', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		await i18n.loadLocale('es-ES');
		i18n.setLocale('es-ES');
		expect(i18n.getLocale()).toBe('es-ES');
	});

	test('an unloaded locale falls through to en-US rather than rendering keys', () => {
		const i18n = new DefaultI18nProvider('en-US');
		i18n.setLocale('fr-FR'); // never loaded
		expect(i18n.t('common.submit')).toBe('Submit');
	});
});

describe('DefaultI18nProvider — custom messages', () => {
	test('constructor customMessages override framework translations', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'en-US': { common: { submit: 'Send it' } },
		});
		expect(i18n.t('common.submit')).toBe('Send it');
	});

	test('keys absent from customMessages still resolve from the framework catalog', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'en-US': { common: { submit: 'Send it' } },
		});
		expect(i18n.t('common.cancel')).toBe('Cancel');
	});

	test('addCustomMessages deep-merges into existing custom messages', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'en-US': { common: { submit: 'First' }, probe: { keep: 'Kept' } },
		});

		i18n.addCustomMessages('en-US', { common: { cancel: 'Second' } });

		expect(i18n.t('common.submit')).toBe('First'); // sibling survives the merge
		expect(i18n.t('common.cancel')).toBe('Second'); // added inside the same branch
		expect(i18n.t('probe.keep')).toBe('Kept'); // unrelated branch survives
	});

	test('addCustomMessages overwrites a leaf at the same path', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'en-US': { common: { submit: 'First' } },
		});
		i18n.addCustomMessages('en-US', { common: { submit: 'Second' } });
		expect(i18n.t('common.submit')).toBe('Second');
	});

	test('addCustomMessages works for a locale with no prior custom messages', () => {
		const i18n = new DefaultI18nProvider('en-US');
		i18n.addCustomMessages('en-US', { probe: { fresh: 'Fresh' } });
		expect(i18n.t('probe.fresh')).toBe('Fresh');
	});

	test('custom messages interpolate like framework messages', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'en-US': { probe: { greet: 'Hello {name}' } },
		});
		expect(i18n.t('probe.greet', { name: 'Ada' })).toBe('Hello Ada');
	});
});

describe('DefaultI18nProvider — pluralization', () => {
	test('English selects one/other', () => {
		const i18n = new DefaultI18nProvider('en-US');
		expect(i18n.plural('plurals.items', { count: 1 })).toBe('1 item');
		expect(i18n.plural('plurals.items', { count: 0 })).toBe('0 items');
		expect(i18n.plural('plurals.items', { count: 5 })).toBe('5 items');
	});

	test('Arabic selects all six CLDR categories, not just one/other', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		await i18n.loadLocale('ar-SA');
		i18n.setLocale('ar-SA');

		const arabic = (await import('../src/locales/ar-SA.js')).default;
		const items = arabic.plurals.items;

		// zero / one / two / few (3–10) / many (11–99) / other (100, 101, …)
		expect(i18n.plural('plurals.items', { count: 0 })).toBe(items.zero.replace('{count}', '0'));
		expect(i18n.plural('plurals.items', { count: 1 })).toBe(items.one);
		expect(i18n.plural('plurals.items', { count: 2 })).toBe(items.two);
		expect(i18n.plural('plurals.items', { count: 3 })).toBe(items.few.replace('{count}', '3'));
		expect(i18n.plural('plurals.items', { count: 11 })).toBe(items.many.replace('{count}', '11'));
		expect(i18n.plural('plurals.items', { count: 100 })).toBe(
			items.other.replace('{count}', '100')
		);

		// The six forms are genuinely distinct, so a one/other implementation
		// could not have produced the results above.
		const rendered = new Set(
			[0, 1, 2, 3, 11, 100].map((count) => i18n.plural('plurals.items', { count }))
		);
		expect(rendered.size).toBe(6);
	});

	test('every plurals.* key resolves for every framework locale', async () => {
		const locales = ['en-US', 'ar-SA', 'es-ES', 'fr-FR', 'nl-NL', 'ro-RO', 'th-TH', 'zh-CN'] as const;
		const enUS = (await import('../src/locales/en-US.js')).default;
		const keys = Object.keys(enUS.plurals);

		for (const locale of locales) {
			const i18n = new DefaultI18nProvider('en-US');
			await i18n.loadLocale(locale);
			i18n.setLocale(locale);

			for (const key of keys) {
				for (const count of [0, 1, 2, 3, 11, 100]) {
					const result = i18n.plural(`plurals.${key}`, { count });
					expect(result).not.toContain(`plurals.${key}`); // never a raw key
					expect(result).not.toContain('{count}'); // always interpolated
				}
			}
		}
	});

	test('a category the catalog lacks falls back to .other', () => {
		// Polish 'few' applies to 2; the catalog below only defines 'other'.
		const i18n = new DefaultI18nProvider('pl-PL', {
			'pl-PL': { probe: { thing: { other: '{count} rzeczy' } } },
		});
		expect(i18n.plural('probe.thing', { count: 2 })).toBe('2 rzeczy');
	});

	test('an unparseable locale tag degrades to the one/other split', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'not a locale': { probe: { thing: { one: 'single', other: 'plural' } } },
		});
		i18n.setLocale('not a locale');
		expect(i18n.plural('probe.thing', { count: 1 })).toBe('single');
		expect(i18n.plural('probe.thing', { count: 7 })).toBe('plural');
	});

	test('plural passes interpolation values through', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'en-US': { probe: { thing: { one: '{count} thing for {who}', other: '{count} things for {who}' } } },
		});
		expect(i18n.plural('probe.thing', { count: 3, who: 'Ada' })).toBe('3 things for Ada');
	});
});

describe('locale catalogs — no ICU MessageFormat', () => {
	// The runtime interpolates `{name}` only; an ICU argument would render its own
	// source text to users. The transform.* namespace used to carry six of them.
	const FRAMEWORK_LOCALES = [
		'en-US',
		'ar-SA',
		'es-ES',
		'fr-FR',
		'nl-NL',
		'ro-RO',
		'th-TH',
		'zh-CN',
	] as const;

	function* walk(node: any, path: string[] = []): Generator<[string, string]> {
		for (const [key, value] of Object.entries(node)) {
			if (typeof value === 'string') yield [[...path, key].join('.'), value];
			else if (value && typeof value === 'object') yield* walk(value, [...path, key]);
		}
	}

	for (const locale of FRAMEWORK_LOCALES) {
		test(`${locale} carries no ICU plural or select arguments`, async () => {
			const catalog = (await import(`../src/locales/${locale}.js`)).default;
			const offenders = [...walk(catalog)].filter(
				([, value]) => /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/.test(value)
			);
			expect(offenders).toEqual([]);
		});
	}

	test('the converted transform.* keys resolve through plural()', async () => {
		const i18n = new DefaultI18nProvider('en-US');

		expect(i18n.plural('transform.samples.itemCount', { count: 1 })).toBe('1 item');
		expect(i18n.plural('transform.samples.itemCount', { count: 4 })).toBe('4 items');
		expect(i18n.plural('transform.transformed.warnings', { count: 1 })).toBe('1 warning');
		expect(i18n.plural('transform.transformed.warnings', { count: 3 })).toBe('3 warnings');
		expect(i18n.plural('transform.detail.browseItemsDescription', { count: 1 })).toBe(
			'Browse and preview 1 QTI item found in this session'
		);
		expect(i18n.plural('transform.detail.browseItemsDescription', { count: 9 })).toBe(
			'Browse and preview 9 QTI items found in this session'
		);
	});

	test('transform.transformed.summary composes from its plural parts', () => {
		const i18n = new DefaultI18nProvider('en-US');
		const items = i18n.plural('transform.transformed.summaryItems', { count: 1 });
		const assessments = i18n.plural('transform.transformed.summaryAssessments', { count: 2 });

		expect(i18n.t('transform.transformed.summary', { items, duration: '1.2s' })).toBe(
			'1 item transformed in 1.2s'
		);
		expect(
			i18n.t('transform.transformed.summaryWithAssessments', {
				items,
				assessments,
				duration: '1.2s',
			})
		).toBe('1 item + 2 assessments transformed in 1.2s');
	});

	test('the Arabic transform.* forms are reachable, not dead data', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		await i18n.loadLocale('ar-SA');
		i18n.setLocale('ar-SA');

		const arabic = (await import('../src/locales/ar-SA.js')).default;
		const itemCount = arabic.transform.samples.itemCount;

		expect(i18n.plural('transform.samples.itemCount', { count: 2 })).toBe(itemCount.two);
		expect(i18n.plural('transform.samples.itemCount', { count: 11 })).toBe(
			itemCount.many.replace('{count}', '11')
		);
	});
});

describe('DefaultI18nProvider — Intl formatting', () => {
	test('formats numbers for the active locale', () => {
		expect(new DefaultI18nProvider('en-US').formatNumber(1234.56)).toBe('1,234.56');
	});

	test('number formatting follows the locale', () => {
		const i18n = new DefaultI18nProvider('en-US');
		i18n.setLocale('nl-NL');
		expect(i18n.formatNumber(1234.56)).toBe('1.234,56');
	});

	test('formats dates for the active locale', () => {
		const result = new DefaultI18nProvider('en-US').formatDate(new Date('2026-01-09T12:00:00Z'), {
			dateStyle: 'short',
			timeZone: 'UTC',
		});
		expect(result).toBe('1/9/26');
	});
});

describe('DefaultI18nProvider — writing direction', () => {
	test('reports rtl for right-to-left locales', () => {
		for (const locale of ['ar-SA', 'ar', 'he-IL', 'fa-IR', 'ur-PK', 'ckb-IQ']) {
			const i18n = new DefaultI18nProvider('en-US');
			i18n.setLocale(locale);
			expect(i18n.getDirection()).toBe('rtl');
		}
	});

	test('reports ltr for left-to-right locales', () => {
		for (const locale of ['en-US', 'es-ES', 'fr-FR', 'nl-NL', 'ro-RO', 'th-TH', 'zh-CN']) {
			const i18n = new DefaultI18nProvider('en-US');
			i18n.setLocale(locale);
			expect(i18n.getDirection()).toBe('ltr');
		}
	});

	test('an unparseable locale tag still resolves by primary subtag', () => {
		const i18n = new DefaultI18nProvider('en-US');
		i18n.setLocale('ar_SA invalid');
		expect(i18n.getDirection()).toBe('rtl');
	});

	test('an unknown locale defaults to ltr rather than throwing', () => {
		const i18n = new DefaultI18nProvider('en-US');
		i18n.setLocale('qq-ZZ');
		expect(i18n.getDirection()).toBe('ltr');
	});
});

describe('DefaultI18nProvider — withLocale', () => {
	test('returns a view fixed to the requested locale', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		await i18n.loadLocale('es-ES');

		const view = i18n.withLocale('es-ES');

		expect(view.getLocale()).toBe('es-ES');
		expect(view.t('common.submit')).toBe('Enviar');
	});

	test('the view does not disturb the parent locale', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		await i18n.loadLocale('es-ES');

		i18n.withLocale('es-ES');

		expect(i18n.getLocale()).toBe('en-US');
		expect(i18n.t('common.submit')).toBe('Submit');
	});

	test('two views render different locales side by side', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		await i18n.loadLocale('es-ES');
		await i18n.loadLocale('ar-SA');

		const spanish = i18n.withLocale('es-ES');
		const arabic = i18n.withLocale('ar-SA');

		expect(spanish.t('common.submit')).toBe('Enviar');
		expect(arabic.getDirection?.()).toBe('rtl');
		expect(spanish.getDirection?.()).toBe('ltr');
	});

	test('catalogs are shared, so loading through a view is visible to the parent', async () => {
		const i18n = new DefaultI18nProvider('en-US');
		const view = i18n.withLocale('es-ES') as DefaultI18nProvider;

		await view.loadLocale('es-ES');
		i18n.setLocale('es-ES');

		expect(i18n.t('common.submit')).toBe('Enviar');
	});

	test('a view for the active locale is the provider itself', () => {
		const i18n = new DefaultI18nProvider('en-US');
		expect(i18n.withLocale('en-US')).toBe(i18n);
	});

	test('a persisted locale does not override an explicit view', () => {
		stubLocalStorage({ [LOCALE_STORAGE_KEY]: 'ar-SA' });
		try {
			const i18n = new DefaultI18nProvider('en-US');
			expect(i18n.getLocale()).toBe('ar-SA'); // constructor honours storage
			expect(i18n.withLocale('es-ES').getLocale()).toBe('es-ES'); // the view does not
		} finally {
			clearGlobalStubs();
		}
	});

	test('custom messages carry into the view', () => {
		const i18n = new DefaultI18nProvider('en-US', {
			'es-ES': { common: { submit: 'Custom ES' } },
		});
		expect(i18n.withLocale('es-ES').t('common.submit')).toBe('Custom ES');
	});
});

describe('DefaultI18nProvider — localStorage', () => {
	afterEach(clearGlobalStubs);

	test('a stored locale overrides the constructor argument', () => {
		stubLocalStorage({ [LOCALE_STORAGE_KEY]: 'es-ES' });
		expect(new DefaultI18nProvider('en-US').getLocale()).toBe('es-ES');
	});

	test('the constructor argument is used when nothing is stored', () => {
		stubLocalStorage();
		expect(new DefaultI18nProvider('fr-FR').getLocale()).toBe('fr-FR');
	});

	test('construction does not throw where localStorage is absent', () => {
		clearGlobalStubs();
		expect(new DefaultI18nProvider('en-US').getLocale()).toBe('en-US');
	});
});

describe('SvelteI18nProvider', () => {
	afterEach(clearGlobalStubs);

	test('delegates lookup to the wrapped provider', () => {
		const svelte = new SvelteI18nProvider(new DefaultI18nProvider('en-US'));
		expect(svelte.getLocale()).toBe('en-US');
		expect(svelte.t('common.submit')).toBe('Submit');
	});

	test('setLocale loads the catalog and switches locale', async () => {
		const svelte = new SvelteI18nProvider(new DefaultI18nProvider('en-US'));
		await svelte.setLocale('es-ES');
		expect(svelte.getLocale()).toBe('es-ES');
		expect(svelte.t('common.submit')).toBe('Enviar');
	});

	test('setLocale persists the locale and reloads the page', async () => {
		const store = stubLocalStorage();
		let reloads = 0;
		(globalThis as any).window = { location: { reload: () => void reloads++ } };

		const svelte = new SvelteI18nProvider(new DefaultI18nProvider('en-US'));
		await svelte.setLocale('es-ES');

		expect(store.get(LOCALE_STORAGE_KEY)).toBe('es-ES');
		expect(reloads).toBe(1);
	});

	test('setLocale tolerates a custom locale with no framework catalog', async () => {
		const svelte = new SvelteI18nProvider(
			new DefaultI18nProvider('en-US', { 'de-AT': { common: { submit: 'Abschicken' } } })
		);
		await svelte.setLocale('de-AT');
		expect(svelte.t('common.submit')).toBe('Abschicken');
	});

	test('delegates plural, formatNumber and formatDate', () => {
		const svelte = new SvelteI18nProvider(new DefaultI18nProvider('en-US'));
		expect(svelte.plural('plurals.items', { count: 2 })).toBe('2 items');
		expect(svelte.formatNumber(1234.56)).toBe('1,234.56');
		expect(svelte.formatDate(new Date('2026-01-09T12:00:00Z'), { dateStyle: 'short', timeZone: 'UTC' })).toBe(
			'1/9/26'
		);
	});

	test('delegates getDirection and withLocale', async () => {
		const base = new DefaultI18nProvider('en-US');
		await base.loadLocale('ar-SA');
		const svelte = new SvelteI18nProvider(base);

		expect(svelte.getDirection()).toBe('ltr');
		expect(svelte.withLocale('ar-SA').getDirection?.()).toBe('rtl');
		expect(svelte.getLocale()).toBe('en-US'); // the view left the parent alone
	});

	test('a locale-scoped view does not reload the page', async () => {
		stubLocalStorage();
		let reloads = 0;
		(globalThis as any).window = { location: { reload: () => void reloads++ } };

		const svelte = new SvelteI18nProvider(new DefaultI18nProvider('en-US'));
		svelte.withLocale('es-ES');

		expect(reloads).toBe(0);
	});

	test('falls back to the wrapped provider when it cannot make a view', () => {
		const bare = {
			getLocale: () => 'en-US',
			setLocale: () => {},
			t: (key: string) => `t:${key}`,
		};
		const svelte = new SvelteI18nProvider(bare);
		expect(svelte.withLocale('es-ES')).toBe(bare);
		expect(svelte.getDirection()).toBe('ltr');
	});

	test('falls back to t() when the wrapped provider has no plural()', () => {
		const bare = {
			getLocale: () => 'en-US',
			setLocale: () => {},
			t: (key: string) => `t:${key}`,
		};
		expect(new SvelteI18nProvider(bare).plural('plurals.items', { count: 2 })).toBe(
			't:plurals.items'
		);
	});
});
