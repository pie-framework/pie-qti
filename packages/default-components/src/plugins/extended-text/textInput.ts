import type { ExtendedTextInteractionData } from '@pie-qti/item-player';
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

/** The code point of `-`, the character a negative answer needs. */
const MINUS = 0x2d;

/**
 * Whether an XSD regular expression cannot match any string containing `-`.
 *
 * Phone number pads offer no minus key, so only a patternMask that provably
 * excludes `-` makes it safe to hand a numeric response a numeric keyboard.
 * The scan reads the pattern structurally: a `-` can come from a literal
 * (escaped or not), a character range whose endpoints straddle it, a wildcard
 * `.`, a negated or complemented class, or a complement or Unicode-category
 * escape (`\D`, `\P`, `\p{Pd}`); the digit, word and space classes (`\d`, `\w`,
 * `\s`) hold no `-`. Anything the scan cannot rule out counts as able to
 * produce a `-`. The same rule rules the item player's inline text entry
 * (`textEntryInputMode` in `@pie-qti/item-player`).
 */
export function patternExcludesMinus(pattern: string): boolean {
	let index = 0;
	while (index < pattern.length) {
		const char = pattern[index];
		if (char === '\\') {
			const escaped = pattern[index + 1];
			// A trailing backslash matches nothing: keep the text keyboard.
			if (escaped === undefined) return false;
			if ('dsw'.includes(escaped)) {
				index += 2;
				continue;
			}
			if ('DSWP'.includes(escaped) || escaped === 'p' || escaped === '-') return false;
			index += 2;
			continue;
		}
		if (char === '[') {
			const after = classExcludesMinus(pattern, index);
			if (after === undefined) return false;
			index = after;
			continue;
		}
		// A wildcard matches `-`; a literal `-` matches itself. Quantifiers, groups,
		// anchors and ordinary letters or digits never introduce one.
		if (char === '-' || char === '.') return false;
		index += 1;
	}
	return true;
}

/**
 * The index just past a character class that cannot match `-`, or `undefined`
 * when the class is unbalanced or holds a member or range that can.
 */
function classExcludesMinus(pattern: string, open: number): number | undefined {
	let index = open + 1;
	// A negated class matches everything its members do not, `-` included.
	if (pattern[index] === '^') return undefined;
	while (index < pattern.length && pattern[index] !== ']') {
		let member: number;
		const char = pattern[index];
		if (char === '\\') {
			const escaped = pattern[index + 1];
			if (escaped === undefined) return undefined;
			// Classes (`\d`, `\w`, `\s`) hold no `-`; ranges from them are out of scope.
			if ('dsw'.includes(escaped)) {
				index += 2;
				continue;
			}
			if ('DSWP'.includes(escaped) || escaped === 'p') return undefined;
			member = escaped.charCodeAt(0);
			index += 2;
		} else {
			member = char.codePointAt(0) as number;
			index += 1;
		}
		if (member === MINUS) return undefined;
		// A range `a-b`, unless the `-` is itself a member (`[a-]`, handled above
		// on the next turn) or the class closes after it.
		if (pattern[index] === '-' && pattern[index + 1] !== ']') {
			index += 1;
			const next = pattern[index];
			if (next === undefined) return undefined;
			let end: number;
			if (next === '\\') {
				const escaped = pattern[index + 1];
				if (escaped === undefined || 'DSWP'.includes(escaped) || escaped === 'p') return undefined;
				if ('dsw'.includes(escaped)) return undefined;
				end = escaped.charCodeAt(0);
				index += 2;
			} else {
				end = next.codePointAt(0) as number;
				index += 1;
			}
			if (member <= MINUS && MINUS <= end) return undefined;
		}
	}
	// Unbalanced: the class never closes.
	if (index >= pattern.length) return undefined;
	return index + 1;
}

/**
 * The virtual keyboard a numeric response needs: digits for an integer, digits
 * and a decimal separator for a float or a numeric record. A base above 10
 * writes digits as letters, so it keeps the text keyboard (`undefined`).
 *
 * A numeric keyboard is only safe when the authored patternMask proves the
 * answer cannot be negative: phone number pads offer no minus key (nor an
 * exponent), so every other response keeps the default text keyboard.
 */
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
