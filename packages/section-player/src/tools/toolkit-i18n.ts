import {
	BUNDLED_LOCALES,
	createPieI18n,
	type I18nProvider,
	type I18nServiceApi,
	loadBundledCatalog,
	type MessageCatalog,
	normalizeLanguageTag,
	PSEUDO_LOCALE_EXPANDED,
	PSEUDO_LOCALE_RTL,
} from '@pie-players/pie-players-shared/i18n';
import { warnOnce } from '@pie-qti/qti-common';

/** What a tool bar uses of `@pie-players/pie-i18n-generated`. */
export interface GeneratedCatalogTier {
	readonly GENERATED_LOCALES: readonly string[];
	loadGeneratedCatalog(locale: string): Promise<MessageCatalog>;
}

/**
 * The generated catalog tier, imported when a tool bar first needs a locale the bundled tier
 * does not ship.
 *
 * This dynamic import is the package's only reference in the section player, and it has to stay
 * dynamic: imported statically, the tier's loader map would ship in every bundle that renders a
 * tool bar, and an English page would fetch it. Behind it, each locale's catalog is a lazy chunk
 * of its own, fetched only for a tool bar in that locale.
 */
export function importGeneratedCatalogTier(): Promise<GeneratedCatalogTier> {
	return import('@pie-players/pie-i18n-generated');
}

/**
 * The requests the bundled tier serves on its own, normalized: its tags (`en-US` alone) and their
 * bare languages. The generated tier keeps its English variants regional (`en-GB`, `en-AU`) so that
 * a bare `en` resolves to the bundled catalog; a regional request goes through both tiers.
 */
const BUNDLED_TAGS = new Set(
	BUNDLED_LOCALES.flatMap((tag) => {
		const normalized = normalizeLanguageTag(tag);
		return [normalized, normalized.split('-')[0] ?? normalized];
	}),
);

/**
 * The pseudo-locales (`en-XA`, `ar-XB`) name transformed English, not a language, so the
 * generated tier must not serve one: it would widen `ar-XB` to its Arabic catalog and stamp `ar`.
 * The bundled tier renders English for both: `ar-XB` under its own tag, right-to-left, and `en-XA`
 * as `en-US`, which it widens to.
 */
const PSEUDO_TAGS = new Set([PSEUDO_LOCALE_EXPANDED, PSEUDO_LOCALE_RTL].map((tag) => normalizeLanguageTag(tag)));

/** The interface providers section tool bars hand the pie-players toolkit. */
export interface ToolkitI18n {
	/**
	 * The provider for a tool bar in `locale`, with that locale's toolkit catalog resident.
	 *
	 * English comes from the bundled tier at once. Any other locale waits for the generated tier
	 * and its catalog, so the toolkit never renders English under another locale's `lang`. A
	 * locale neither tier ships renders English under its own tag. Never rejects: without the
	 * generated tier the tool bar still renders, in English.
	 */
	providerFor(locale: string | undefined): Promise<I18nProvider>;
}

/**
 * Toolkit providers composed the way pie-players documents for its catalog tiers: the bundled
 * loader first, so a reviewed catalog wins over a generated one for the same tag, and the
 * generated tier for every other locale it ships. The generated tier is imported once, on first
 * need, and every tool bar shares each catalog once it is loaded.
 */
export function createToolkitI18n(
	importTier: () => Promise<GeneratedCatalogTier> = importGeneratedCatalogTier,
): ToolkitI18n {
	let tier: Promise<GeneratedCatalogTier> | undefined;
	const generatedTier = (): Promise<GeneratedCatalogTier> => {
		if (!tier) {
			const attempt = importTier();
			tier = attempt;
			// A failed import is not kept: the next locale request tries again.
			attempt.catch(() => {
				if (tier === attempt) tier = undefined;
			});
		}
		return tier;
	};

	const loadCatalog = (locale: string): Promise<MessageCatalog> =>
		loadBundledCatalog(locale).catch(() => generatedTier().then((generated) => generated.loadGeneratedCatalog(locale)));

	// Two base providers, each built once and each caching the catalogs it loads: the bundled tier
	// alone, for English, and the composed tiers for every other locale. A tool bar gets a view
	// fixed to its own locale, so tool bars in different locales never change each other's, while
	// sharing every catalog.
	let bundled: I18nServiceApi | undefined;
	const bundledProvider = (): I18nServiceApi => {
		bundled ??= createPieI18n();
		return bundled;
	};
	let composed: Promise<I18nServiceApi> | undefined;
	const composedProvider = (): Promise<I18nServiceApi> => {
		if (!composed) {
			const attempt = generatedTier().then((generated) =>
				createPieI18n({ availableLocales: [...BUNDLED_LOCALES, ...generated.GENERATED_LOCALES], loadCatalog }),
			);
			composed = attempt;
			attempt.catch(() => {
				if (composed === attempt) composed = undefined;
			});
		}
		return composed;
	};

	return {
		async providerFor(locale) {
			const tag = locale?.trim();
			// No locale, English or a pseudo-locale: the bundled catalog serves it, and nothing is fetched.
			if (!tag) return bundledProvider();
			const normalized = normalizeLanguageTag(tag);
			if (BUNDLED_TAGS.has(normalized) || PSEUDO_TAGS.has(normalized)) return bundledProvider().withLocale(tag);

			let base: I18nServiceApi;
			try {
				base = await composedProvider();
			} catch (error) {
				warnOnce(
					'section-player:toolkit-generated-catalogs',
					`Tool bars render in English: the toolkit's generated locale catalogs did not load (${String(error)}).`,
				);
				return bundledProvider().withLocale(tag);
			}
			const view = base.withLocale(tag);
			// Load the catalog before the toolkit renders, so it never shows English under this
			// locale's `lang`. The toolkit switches the provider to its `locale` itself and reports a
			// failed load through its own error channel, rendering English meanwhile, so a failure
			// here needs no handling of its own.
			await Promise.resolve(view.setLocale(tag)).catch(() => undefined);
			return view;
		},
	};
}

/** The page's toolkit providers: one generated-tier import and one catalog cache for every tool bar. */
export const toolkitI18n: ToolkitI18n = createToolkitI18n();
