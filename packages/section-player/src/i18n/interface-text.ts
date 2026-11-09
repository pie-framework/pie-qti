import { type I18nProvider, translate } from '@pie-qti/i18n';

/**
 * Interface text for a candidate-facing label: the host provider's translation of `key`,
 * else the English `fallback`.
 *
 * `translate` covers a provider that hands the default back. The `I18nProvider` contract
 * also lets a provider answer a key it cannot serve with the key itself, and a section
 * renders under whatever provider its host composes. Composed into a name, that key would
 * read as text ("Passage — assessment.collapsePassage"). A key is never a translation, so
 * it counts as a miss here too, as it already does for `translatePlural`.
 */
export function interfaceText(
	i18n: I18nProvider | undefined,
	key: string,
	fallback: string,
	values?: Record<string, unknown>,
): string {
	const message = translate(i18n, key, fallback, values);
	return message === key ? translate(undefined, key, fallback, values) : message;
}
