import type { ExtendedTextInteractionData } from '@pie-qti/item-player';

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
 * Phone number pads may offer no minus sign; see the extended text PRD.
 */
export function responseInputMode(
	interaction: Pick<ExtendedTextInteractionData, 'baseType' | 'base' | 'cardinality'>,
): 'numeric' | 'decimal' | undefined {
	if (Number.isFinite(interaction.base) && interaction.base > 10) return undefined;
	if (interaction.cardinality === 'record' || interaction.baseType === 'float') return 'decimal';
	if (interaction.baseType === 'integer') return 'numeric';
	return undefined;
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
