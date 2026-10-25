/**
 * XML Schema regular expressions in JavaScript.
 *
 * QTI's `patternMatch` and `patternMask` take XSD patterns (XML Schema Part 2,
 * appendix F). Two of their rules differ from JavaScript's: a pattern matches
 * the whole string, and `\d` is any Unicode decimal digit. The translation
 * covers those two; every other construct is passed to JavaScript as written.
 */

/**
 * The pattern's source with `\d` and `\D` widened to Unicode decimal digits.
 * The result needs the `u` or `v` flag.
 */
export function xsdPatternSource(pattern: string): string {
	let out = '';
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i];
		if (char !== '\\' || i + 1 >= pattern.length) {
			out += char;
			continue;
		}
		const next = pattern[++i];
		out += next === 'd' ? '\\p{Nd}' : next === 'D' ? '\\P{Nd}' : `\\${next}`;
	}
	return out;
}

/**
 * Compiles an XSD pattern to a `RegExp` that matches the whole string, or
 * `null` when the pattern does not compile. A pattern JavaScript rejects under
 * the `u` flag (an identity escape such as `\-` outside a class) compiles
 * without it, with ASCII `\d`, so content that matched before still does.
 */
export function xsdPatternToRegExp(pattern: string, flags = ''): RegExp | null {
	try {
		return new RegExp(`^(?:${xsdPatternSource(pattern)})$`, `${flags}u`);
	} catch {
		try {
			return new RegExp(`^(?:${pattern})$`, flags);
		} catch {
			return null;
		}
	}
}
