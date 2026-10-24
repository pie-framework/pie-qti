import { DefaultI18nProvider, PSEUDO_LOCALE_EXPANDED, PSEUDO_LOCALE_RTL, pseudoLocalize } from '@pie-qti/i18n';
import en from '@pie-qti/i18n/locales/en.js';

/**
 * The interface locale a smoke route takes from `?locale=`, as a provider with
 * its catalog loaded, or undefined when the URL names none. The pseudo-locales
 * `en-XA` and `ar-XB` render bracketed, accented, lengthened English, so the RTL
 * matrix can see untranslated strings and clipping.
 */
export async function localeProviderFromUrl(url: URL = new URL(window.location.href)): Promise<DefaultI18nProvider | undefined> {
	const locale = url.searchParams.get('locale');
	if (!locale) return undefined;
	const pseudo = pseudoLocalize(en);
	const provider = new DefaultI18nProvider(locale, { [PSEUDO_LOCALE_EXPANDED]: pseudo, [PSEUDO_LOCALE_RTL]: pseudo });
	await provider.loadLocale(locale);
	return provider;
}
