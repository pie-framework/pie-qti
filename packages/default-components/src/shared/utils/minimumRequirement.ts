import { translatePlural, type I18nProvider } from '@pie-qti/i18n';

/** A minimum an interaction's response must reach before it counts as complete. */
export interface MinimumHintOptions {
	i18n: I18nProvider | undefined;
	/** The authored minimum (minChoices, minAssociations); 0, absent or invalid means none. */
	minimum: number | null | undefined;
	/** How many the response holds now: selections, associations, ordered items. */
	count: number;
	/** The author's `data-min-selections-message`, which wins over the localized default. */
	authored?: string | null;
	/** The plural group of the localized default; `{count}` is the minimum. */
	key: string;
	/** English forms used when no catalog carries `key`. */
	fallback: { one: string; other: string };
}

/**
 * What an interaction states while its response is below an authored minimum — the same
 * minimum response validation enforces before an answer counts as complete — so a candidate
 * learns what is missing on the question itself, not only from a refused submit (WCAG 3.3.2,
 * 3.3.3). Empty when there is no minimum or the response meets it.
 */
export function minimumHint({ i18n, minimum, count, authored, key, fallback }: MinimumHintOptions): string {
	const required = Number(minimum ?? 0);
	if (!Number.isFinite(required) || required <= 0 || count >= required) return '';
	return authored?.trim() || translatePlural(i18n, key, fallback, required);
}

/** Space-separated `aria-describedby` ids, without the empty ones; undefined when none remain. */
export function describedByIds(...ids: Array<string | null | undefined | false>): string | undefined {
	const joined = ids.filter((id): id is string => !!id).join(' ');
	return joined || undefined;
}

/**
 * The choices of a pairing interaction (match, associate) whose authored `matchMin` the pairs do
 * not reach yet, in authored order: a pair "a b" uses both of its choices, as response validation
 * counts them.
 */
export function choicesShortOfMatchMin<T extends { identifier: string; matchMin?: number }>(
	choices: readonly T[],
	pairs: readonly string[],
): T[] {
	return choices.filter((choice) => {
		const required = Number(choice.matchMin ?? 0);
		if (!Number.isFinite(required) || required <= 0) return false;
		const uses = pairs.filter((pair) => pair.split(' ').includes(choice.identifier)).length;
		return uses < required;
	});
}
