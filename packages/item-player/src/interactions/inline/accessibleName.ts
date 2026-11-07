import { translate, type I18nProvider } from '@pie-qti/i18n';
import type { InlineInteractionPosition } from '../../presentation/itemPresentationPlan.js';

interface NameableInlineInteraction {
	readonly accessibility?: { readonly label?: string };
	readonly title?: string;
}

/**
 * The accessible name of an inline interaction: its authored label (`aria-labelledby`,
 * `aria-label`, then `title`), else its position among the item's inline interactions in
 * document order ("Blank 2 of 4").
 *
 * Never the response identifier. Identifiers are author data (`RESPONSE_3`, or worse
 * `CAPITAL_PARIS`): they mean nothing to a candidate and can hint at the answer, and an
 * accessible name exposes them to screen-reader users only, which makes the item unequal.
 */
export function inlineInteractionLabel(
	i18n: I18nProvider | undefined,
	interaction: NameableInlineInteraction,
	position: InlineInteractionPosition
): string {
	const authored = interaction.accessibility?.label?.trim() || interaction.title?.trim();
	if (authored) return authored;
	return translate(i18n, 'interactions.inline.blankLabel', 'Blank {index} of {count}', {
		index: position.index,
		count: position.count,
	});
}

/**
 * The message for a text entry whose answer does not match its pattern mask: the author's own
 * message when there is one, else a localized sentence that names the expected format by the
 * item's placeholder hint when it has one. The pattern mask itself is an XSD regular expression,
 * which no candidate can be expected to read, so it is never shown.
 */
export function textEntryPatternMessage(
	i18n: I18nProvider | undefined,
	interaction: { readonly patternMaskMessage?: string | null; readonly placeholderText?: string }
): string {
	const authored = interaction.patternMaskMessage?.trim();
	if (authored) return authored;
	const hint = interaction.placeholderText?.trim();
	return hint
		? translate(
				i18n,
				'interactions.inline.patternMismatchWithHint',
				'This answer is not in the expected format. Use this format: {hint}',
				{ hint }
			)
		: translate(i18n, 'interactions.inline.patternMismatch', 'This answer is not in the expected format.');
}
