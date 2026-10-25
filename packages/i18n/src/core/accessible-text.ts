/**
 * Helpers for the accessible names and live-region messages components compose.
 *
 * A message is never assembled from translated fragments: word order, list
 * joining and sentence punctuation differ by language. Each key is a whole
 * phrase or a whole sentence with named placeholders, and a label built from
 * several states joins complete sentences, each of which carries its own
 * punctuation in its translation (`accessibility.sentence` turns a bare label
 * into one).
 */

import type { I18nProvider } from './I18nProvider.js';

type Values = Record<string, unknown>;

function interpolate(message: string, values?: Values): string {
	if (!values) return message;
	return message.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

/**
 * Translate `key`, or interpolate the English `fallback` when the component was
 * mounted without a provider.
 */
export function translate(i18n: I18nProvider | undefined, key: string, fallback: string, values?: Values): string {
	return i18n ? i18n.t(key, fallback, values) : interpolate(fallback, values);
}

/**
 * Pluralize the plural group `key` for `count`, or pick from the English
 * `fallback` forms when the component was mounted without a provider.
 */
export function translatePlural(
	i18n: I18nProvider | undefined,
	key: string,
	fallback: { one: string; other: string },
	count: number,
	values?: Record<string, string | number>,
): string {
	if (i18n?.plural) return i18n.plural(key, { ...values, count });
	const form = count === 1 ? 'one' : 'other';
	return translate(i18n, `${key}.${form}`, fallback[form], { ...values, count });
}

/** Join complete sentences, skipping the conditions that did not apply. */
export function joinSentences(...sentences: Array<string | false | null | undefined>): string {
	return sentences.filter((sentence): sentence is string => !!sentence).join(' ');
}

/** A conjunction list in the provider's locale: "A, B and C", "A، B وC". */
export function formatList(i18n: I18nProvider | undefined, items: string[]): string {
	try {
		return new Intl.ListFormat(i18n?.getLocale().replace(/_/g, '-') || 'en', { type: 'conjunction' }).format(items);
	} catch {
		return items.join(', ');
	}
}

/**
 * True while an input method editor is composing, when Escape and Enter belong
 * to the IME (cancel or commit the candidate) and a handler must not act on
 * them. `keyCode` 229 covers engines that end composition before the event.
 */
export function isImeComposing(event: KeyboardEvent): boolean {
	return event.isComposing || event.keyCode === 229;
}
