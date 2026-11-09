import type { ExtendedTextInteractionData } from '@pie-qti/item-player';
import { patternExcludesMinus } from '@pie-qti/item-player';
import { translate, type I18nProvider } from '@pie-qti/i18n';

/**
 * Text-field helpers for the extended text interaction: writing assistance,
 * the mobile keyboard, and the character count behind the QTI counters.
 */

/** Whether a `spellcheck` prop grants spelling help: `true`, `"true"`, or the bare attribute. */
export function isSpellcheckAllowed(value: unknown): boolean {
	if (value === true || value === '') return true;
	return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

/**
 * Writing-assistance attributes for a candidate's text field. Spell check and
 * autocorrect follow the grant, so spelling and writing items give every
 * candidate the same help; automatic capitalization stays off either way,
 * since capitalization is itself assessed in writing.
 */
export interface WritingAssistanceAttributes {
	spellcheck: 'true' | 'false';
	autocorrect: 'on' | 'off';
	autocapitalize: 'off';
}

export function writingAssistance(allowSpellcheck: boolean): WritingAssistanceAttributes {
	return {
		spellcheck: allowSpellcheck ? 'true' : 'false',
		autocorrect: allowSpellcheck ? 'on' : 'off',
		autocapitalize: 'off',
	};
}

/**
 * The virtual keyboard a numeric response needs: digits for an integer, digits
 * and a decimal separator for a float or a numeric record. A base above 10
 * writes digits as letters, so it keeps the text keyboard (`undefined`).
 *
 * A numeric keyboard is only safe when the authored patternMask proves the
 * answer cannot be negative: phone number pads offer no minus key (nor an
 * exponent), so every other response keeps the default text keyboard. The
 * pattern scan is the item player's `patternExcludesMinus`, re-exported here
 * because this interaction owns the extended-text keyboard rules.
 */
export { patternExcludesMinus } from '@pie-qti/item-player';

export function responseInputMode(
	interaction: Pick<ExtendedTextInteractionData, 'baseType' | 'base' | 'cardinality' | 'patternMask'>,
): 'numeric' | 'decimal' | undefined {
	if (Number.isFinite(interaction.base) && interaction.base > 10) return undefined;
	if (interaction.baseType !== 'integer' && interaction.baseType !== 'float' && interaction.cardinality !== 'record') {
		return undefined;
	}
	if (!interaction.patternMask || !patternExcludesMinus(interaction.patternMask)) return undefined;
	return interaction.baseType === 'float' || interaction.cardinality === 'record' ? 'decimal' : 'numeric';
}

const HTML_ENTITY = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi;

/**
 * The characters a candidate typed, as the counters show them: rich text
 * (`xhtml`) counts its text without markup, an entity counts as one character,
 * and a character outside the Basic Multilingual Plane counts once.
 */
export function characterCount(value: string, format: string): number {
	const text = format === 'xhtml' ? value.replace(/<[^>]*>/g, '').replace(HTML_ENTITY, '_') : value;
	return Array.from(text).length;
}

/** Whether an edit took the count from below `expectedLength` to at or above it. */
export function reachedExpectedLength(before: number, after: number, expectedLength: number): boolean {
	return expectedLength > 0 && before < expectedLength && after >= expectedLength;
}

/**
 * The message for a response that does not match the interaction's pattern mask: the author's
 * own message when there is one, else a localized sentence. The mask itself is an XSD regular
 * expression, which no candidate can be expected to read, so it is never shown.
 */
export function patternMaskMessage(
	i18n: I18nProvider | undefined,
	interaction: Pick<ExtendedTextInteractionData, 'patternMaskMessage'>,
): string {
	return (
		interaction.patternMaskMessage?.trim() ||
		translate(i18n, 'interactions.extendedText.patternMismatch', 'This answer is not in the expected format.')
	);
}
