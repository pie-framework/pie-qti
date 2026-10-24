import { describe, expect, test } from 'bun:test';
import { DefaultI18nProvider, type I18nProvider } from '@pie-qti/i18n';
import { PieQtiItemPlayerElement } from '../../src/element-class.js';

/**
 * A provider whose views stay loading until the test settles them. Every
 * render resolves the element's provider through `withLocale()`, so the calls
 * count renders.
 */
function deferredProvider(options: { readyOnEveryView?: boolean } = {}) {
	// One load per locale, shared by every view over it, as DefaultI18nProvider does.
	const loads = new Map<string, { promise: Promise<void>; resolve: () => void }>();
	const settled = new Set<string>();
	const load = (locale: string) => {
		let entry = loads.get(locale);
		if (!entry) {
			let resolve = () => {};
			const promise = new Promise<void>((r) => {
				resolve = () => {
					settled.add(locale);
					r();
				};
			});
			entry = { promise, resolve };
			loads.set(locale, entry);
		}
		return entry.promise;
	};
	const requests: string[] = [];
	const base = new DefaultI18nProvider('en-US');
	const provider: I18nProvider = {
		getLocale: () => 'en-US',
		setLocale: () => {},
		t: (key) => base.t(key),
		withLocale(locale) {
			requests.push(locale);
			let ready: Promise<void> | undefined;
			if (options.readyOnEveryView || !settled.has(locale)) {
				ready = settled.has(locale) ? Promise.resolve() : load(locale);
			}
			return { ...provider, getLocale: () => locale, ready };
		},
	};
	return {
		provider,
		requests,
		settle: async (locale: string) => {
			loads.get(locale)?.resolve();
			await Promise.resolve();
			await Promise.resolve();
		},
	};
}

describe('<pie-qti-item-player> locale catalog loading', () => {
	test('a view still loading its catalog re-renders once when ready settles', async () => {
		const { provider, requests, settle } = deferredProvider();
		const element = new PieQtiItemPlayerElement();
		element.i18n = provider;
		element.locale = 'fr-FR';
		element.disabled = true; // a render in between, over the same load
		expect(requests).toEqual(['fr-FR', 'fr-FR']);

		await settle('fr-FR');
		expect(requests).toEqual(['fr-FR', 'fr-FR', 'fr-FR']);
	});

	test('a locale changed before the load settles drops the stale re-render', async () => {
		const { provider, requests, settle } = deferredProvider();
		const element = new PieQtiItemPlayerElement();
		element.i18n = provider;
		element.locale = 'fr-FR';
		element.locale = 'es-ES';

		await settle('fr-FR');
		expect(requests).toEqual(['fr-FR', 'es-ES']);

		await settle('es-ES');
		expect(requests).toEqual(['fr-FR', 'es-ES', 'es-ES']);
	});

	test('a provider that sets ready on every view does not loop', async () => {
		const { provider, requests, settle } = deferredProvider({ readyOnEveryView: true });
		const element = new PieQtiItemPlayerElement();
		element.i18n = provider;
		element.locale = 'nl-NL';

		await settle('nl-NL');
		await settle('nl-NL');
		expect(requests).toEqual(['nl-NL', 'nl-NL']);
	});
});
