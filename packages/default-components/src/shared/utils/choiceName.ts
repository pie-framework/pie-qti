/**
 * The accessible name of an interactive choice.
 *
 * A choice is named by its authored content — the text `accessibleTextFromHtml`
 * derives from it (visible text, image `alt`, MathML `alttext`, SVG `<title>`).
 * A choice whose content carries no readable text (an image without alt, empty
 * markup) is named by a localized ordinal of its presented position ("Choice
 * 3"), so it still has a name a candidate can use and repeat back.
 *
 * The fallback is never the QTI identifier: identifiers are author-internal,
 * meaningless to candidates, and can leak the answer key (`CORRECT_A`) through
 * a screen reader. The ordinal is 1-based over the order the candidate sees
 * (after shuffle), so it is stable for a rendering and matches what a sighted
 * candidate would count.
 */

import { translate, type I18nProvider } from '@pie-qti/i18n';

export interface ChoiceNameInput {
	i18n: I18nProvider | undefined;
	/**
	 * The choice's authored label: `accessibleTextFromHtml` of its content (for
	 * plain-text choices, the text itself). Empty when there is nothing to read.
	 */
	label: string;
	/** The choice's 1-based position as presented to the candidate (after shuffle). */
	position: number;
}

/**
 * The accessible name of a choice: its authored label, else a localized
 * ordinal (`accessibility.choiceFallback`, "Choice {index}") of the position
 * the candidate sees. Every interactive choice label, announcement and
 * `aria-label` fallback names a choice through this, so no identifier can
 * reach a candidate's screen reader.
 */
export function choiceAccessibleName({ i18n, label, position }: ChoiceNameInput): string {
	return label.trim() || translate(i18n, 'accessibility.choiceFallback', 'Choice {index}', { index: position });
}
