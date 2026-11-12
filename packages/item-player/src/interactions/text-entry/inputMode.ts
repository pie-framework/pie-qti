import type { TextEntryInteractionData } from '../shared/types.js';

/** The code point of `-`, the character a negative answer needs. */
const MINUS = 0x2d;

/**
 * Whether an XSD regular expression cannot match any string containing `-`.
 *
 * Phone number pads offer no minus key, so only a patternMask that provably
 * excludes `-` makes it safe to hand an integer or float response a numeric
 * keyboard; every other answer keeps the default text keyboard (see
 * {@link textEntryInputMode}).
 *
 * The scan reads the pattern structurally: a `-` can come from a literal
 * (escaped or not), a character range whose endpoints straddle it, a wildcard
 * `.`, a negated or complemented class, or a complement or Unicode-category
 * escape (`\D`, `\P`, `\p{Pd}`); the digit, word and space classes (`\d`, `\w`,
 * `\s`) hold no `-`. Anything the scan cannot rule out counts as able to
 * produce a `-`.
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
 *
 * Shared with {@link patternExcludesMinus}'s consumers (inline text entry and
 * extended text), which is why it is exported.
 */
export function classExcludesMinus(pattern: string, open: number): number | undefined {
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
 * The `inputmode` for a text entry bound to a response: a numeric keyboard only
 * for an integer or float response whose authored patternMask proves the answer
 * cannot be negative, since phone number pads offer no minus key (nor an
 * exponent). A declared non-decimal `base` (e.g. 16 or 2) also keeps the text
 * keyboard: number pads cannot type its digits (hex `A`–`F`). Every other
 * response keeps the default text keyboard, which can enter anything the item
 * accepts.
 */
export function textEntryInputMode(
	interaction: Pick<TextEntryInteractionData, 'baseType' | 'patternMask' | 'base'>,
): 'numeric' | 'decimal' | undefined {
	if (interaction.baseType !== 'integer' && interaction.baseType !== 'float') return undefined;
	if (interaction.base !== undefined && interaction.base !== 10) return undefined;
	if (!interaction.patternMask || !patternExcludesMinus(interaction.patternMask)) return undefined;
	return interaction.baseType === 'integer' ? 'numeric' : 'decimal';
}
