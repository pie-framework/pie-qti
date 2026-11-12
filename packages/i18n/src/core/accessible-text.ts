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

/**
 * Fill `{name}` placeholders: the one interpolation every message goes through,
 * translated or fallback. Numbers take `formatNumber`, which a provider points
 * at its locale's digits. A value that was not supplied leaves its placeholder
 * visible: a legible authoring bug beats a silent blank.
 */
export function interpolate(
	message: string,
	values?: Values,
	formatNumber: (value: number) => string = String,
): string {
	if (!values) return message;
	return message.replace(/\{(\w+)\}/g, (match, key) => {
		const value = values[key];
		return typeof value === 'number' ? formatNumber(value) : String(value ?? match);
	});
}

/**
 * Translate `key`, or interpolate the English `fallback` when the component was
 * mounted without a provider or no catalog carries the key.
 *
 * `I18nProvider` is a host extension point, so a default handed back verbatim
 * is filled here: placeholders never reach a candidate, whichever provider runs.
 *
 * `key` stays `string` rather than `MessageKey`: components pass keys held in
 * string-typed structures (label tables, wrapper helpers), and hosts pass keys
 * from their own `customMessages` catalogs. Literal-key correctness is enforced
 * by the `check-consumer-keys` scan in `check:i18n`, and at runtime by the
 * provider's unconditional missing-key warning.
 */
export function translate(i18n: I18nProvider | undefined, key: string, fallback: string, values?: Values): string {
	if (!i18n) return interpolate(fallback, values);
	const message = i18n.t(key, fallback, values);
	return message === fallback ? interpolate(fallback, values, i18n.formatNumber?.bind(i18n)) : message;
}

/**
 * Pluralize the plural group `key` for `count`, or pick from the English
 * `fallback` forms when the component was mounted without a provider or no
 * catalog carries the group.
 */
export function translatePlural(
	i18n: I18nProvider | undefined,
	key: string,
	fallback: { one: string; other: string },
	count: number,
	values?: Record<string, string | number>,
): string {
	const message = i18n?.plural?.(key, { ...values, count });
	// A provider answers a miss with the key it looked up, never with a sentence.
	const missed = message === undefined || message === key || message.startsWith(`${key}.`);
	if (!missed) return message;
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
