/**
 * Escape plain text for a double-quoted HTML attribute value.
 *
 * Every copy of this escape in the player (presentation plans, the sanitizer's
 * attribute rebuilds, catalog file hrefs, read-aloud attributes) writes the
 * result into a double-quoted attribute, so `"`, `&`, `<` and `>` are exactly
 * the characters that need escaping; `'` cannot break such a value and is left
 * as authored.
 *
 * Attributes read with node-html-parser arrive decoded, so a decoded value is
 * escaped exactly once here; callers that read raw source text with a regex
 * (stimulus docking) keep the value's authored entities and re-escape them,
 * which stays byte-identical to the previous per-file copies.
 */
export function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
