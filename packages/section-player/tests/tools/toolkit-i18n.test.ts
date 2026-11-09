import { describe, expect, mock, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MessageCatalog } from '@pie-players/pie-players-shared/i18n';
import { createToolkitI18n, type GeneratedCatalogTier } from '../../src/tools/toolkit-i18n.js';

const PLAY = 'tools.textToSpeech.inline.playA11y';

function catalogPlaying(label: string): MessageCatalog {
	return { tools: { textToSpeech: { inline: { playA11y: label } } } };
}

/** A generated tier serving `catalogs`, counting its imports and catalog loads. */
function fakeTier(catalogs: Record<string, MessageCatalog>) {
	const loadGeneratedCatalog = mock(async (locale: string) => {
		const catalog = catalogs[locale];
		if (!catalog) throw new Error(`No generated i18n catalog for locale: ${locale}`);
		return catalog;
	});
	const tier: GeneratedCatalogTier = { GENERATED_LOCALES: Object.keys(catalogs), loadGeneratedCatalog };
	const importTier = mock(async () => tier);
	return { importTier, loadGeneratedCatalog };
}

describe('toolkit i18n: English from the bundled tier', () => {
	test('no locale and English render English without importing the generated tier', async () => {
		const { importTier } = fakeTier({ 'nl-NL': catalogPlaying('Voorlezen starten') });
		const toolkit = createToolkitI18n(importTier);
		for (const locale of [undefined, '', 'en', 'en-US', 'en_US']) {
			const provider = await toolkit.providerFor(locale);
			expect(provider.getLocale()).toBe('en-US');
			expect(provider.t(PLAY)).toBe('Play reading');
		}
		expect(importTier).not.toHaveBeenCalled();
	});

	test('a pseudo-locale keeps its own tag and direction over English, never a real catalog', async () => {
		const { importTier } = fakeTier({ ar: catalogPlaying('تشغيل القراءة') });
		const toolkit = createToolkitI18n(importTier);
		const rtl = await toolkit.providerFor('ar-XB');
		expect(rtl.getLocale()).toBe('ar-XB');
		expect(rtl.getDirection?.()).toBe('rtl');
		expect(rtl.t(PLAY)).toBe('Play reading');
		const expanded = await toolkit.providerFor('en-XA');
		expect(expanded.t(PLAY)).toBe('Play reading');
		expect(importTier).not.toHaveBeenCalled();
	});

	test('a regional English the generated tier ships comes from that tier', async () => {
		const { importTier, loadGeneratedCatalog } = fakeTier({ 'en-GB': catalogPlaying('Play the reading aloud') });
		const provider = await createToolkitI18n(importTier).providerFor('en-GB');
		expect(provider.getLocale()).toBe('en-GB');
		expect(provider.t(PLAY)).toBe('Play the reading aloud');
		// Keys the regional catalog omits fall back to the bundled English.
		expect(provider.t('tools.textToSpeech.inline.pauseA11y')).toBe('Pause reading');
		expect(loadGeneratedCatalog.mock.calls).toEqual([['en-GB']]);
	});
});

describe('toolkit i18n: other locales from the generated tier, lazily', () => {
	test('a generated locale loads its catalog before the provider is handed over', async () => {
		const { importTier, loadGeneratedCatalog } = fakeTier({ 'nl-NL': catalogPlaying('Voorlezen starten') });
		const provider = await createToolkitI18n(importTier).providerFor('nl-NL');
		expect(provider.getLocale()).toBe('nl-NL');
		expect(provider.t(PLAY)).toBe('Voorlezen starten');
		expect(loadGeneratedCatalog.mock.calls).toEqual([['nl-NL']]);
	});

	test('the tier is imported once and each catalog loaded once, shared by every tool bar', async () => {
		const { importTier, loadGeneratedCatalog } = fakeTier({
			'nl-NL': catalogPlaying('Voorlezen starten'),
			es: catalogPlaying('Reproducir la lectura'),
		});
		const toolkit = createToolkitI18n(importTier);
		const [dutch, bareDutch, belgianDutch] = await Promise.all([
			toolkit.providerFor('nl-NL'),
			toolkit.providerFor('nl'),
			toolkit.providerFor('nl-BE'),
		]);
		const spanish = await toolkit.providerFor('es-MX');
		for (const provider of [dutch, bareDutch, belgianDutch]) expect(provider.t(PLAY)).toBe('Voorlezen starten');
		expect(spanish.t(PLAY)).toBe('Reproducir la lectura');
		// Each tool bar keeps its own locale: loading Spanish left the Dutch bars Dutch.
		expect(dutch.getLocale()).toBe('nl-NL');
		expect(dutch.t(PLAY)).toBe('Voorlezen starten');
		expect(importTier).toHaveBeenCalledTimes(1);
		expect(loadGeneratedCatalog.mock.calls).toEqual([['nl-NL'], ['es']]);
	});

	test('a locale no tier ships renders English under its own tag', async () => {
		const { loadGeneratedCatalog, importTier } = fakeTier({ 'nl-NL': catalogPlaying('Voorlezen starten') });
		const provider = await createToolkitI18n(importTier).providerFor('xx-YY');
		expect(provider.getLocale()).toBe('xx-YY');
		expect(provider.t(PLAY)).toBe('Play reading');
		expect(loadGeneratedCatalog).not.toHaveBeenCalled();
	});

	test('a failed catalog load still hands over a provider, rendering English', async () => {
		const tier: GeneratedCatalogTier = {
			GENERATED_LOCALES: ['nl-NL'],
			loadGeneratedCatalog: async () => {
				throw new Error('chunk failed to load');
			},
		};
		const provider = await createToolkitI18n(async () => tier).providerFor('nl-NL');
		expect(provider.t(PLAY)).toBe('Play reading');
	});

	test('without the generated tier tool bars render English, and the next request retries the import', async () => {
		const { importTier: workingImport } = fakeTier({ 'nl-NL': catalogPlaying('Voorlezen starten') });
		let attempts = 0;
		const flakyImport = async () => {
			attempts += 1;
			if (attempts === 1) throw new Error('offline');
			return workingImport();
		};
		const toolkit = createToolkitI18n(flakyImport);
		const offline = await toolkit.providerFor('nl-NL');
		expect(offline.getLocale()).toBe('nl-NL');
		expect(offline.t(PLAY)).toBe('Play reading');
		const online = await toolkit.providerFor('nl-NL');
		expect(online.t(PLAY)).toBe('Voorlezen starten');
		expect(attempts).toBe(2);
	});
});

describe('toolkit i18n: the published generated tier', () => {
	test('serves Dutch, and every other locale the package ships, through the same lazy path', async () => {
		const toolkit = createToolkitI18n();
		const dutch = await toolkit.providerFor('nl-NL');
		expect(dutch.t(PLAY)).toBe('Voorlezen starten');
		expect(dutch.t('tools.textToSpeech.name')).toBe('Voorlezen');

		const arabic = await toolkit.providerFor('ar');
		expect(arabic.getDirection?.()).toBe('rtl');
		expect(arabic.t(PLAY)).toBe('تشغيل القراءة');

		for (const [locale, resolved] of [
			['es', 'es'],
			['fr', 'fr'],
			['ro', 'ro'],
			['th', 'th-TH'],
			['zh-Hans', 'zh'],
		] as const) {
			const provider = await toolkit.providerFor(locale);
			expect(provider.getLocale()).toBe(resolved);
			expect(provider.t(PLAY)).not.toBe('Play reading');
		}
	});
});

describe('toolkit i18n: the generated tier stays a dynamic import', () => {
	const sourceRoot = fileURLToPath(new URL('../../src', import.meta.url));
	const sources = (readdirSync(sourceRoot, { recursive: true }) as string[])
		.filter((file) => /\.(ts|svelte)$/.test(file))
		.map((file) => ({ file, text: readFileSync(join(sourceRoot, file), 'utf8') }));

	test('no source imports @pie-players/pie-i18n-generated statically', () => {
		const references = sources.flatMap(({ file, text }) =>
			Array.from(text.matchAll(/(.{0,40})['"]@pie-players\/pie-i18n-generated['"]/g), (match) => ({
				file,
				before: match[1] ?? '',
			})),
		);
		// One reference, and it is `import('…')`: a static import would ship the tier's loader map
		// in every bundle with a tool bar.
		expect(references.map(({ file }) => file)).toEqual([join('tools', 'toolkit-i18n.ts')]);
		for (const { before } of references) expect(before).toMatch(/\bimport\(\s*$/);
	});
});
