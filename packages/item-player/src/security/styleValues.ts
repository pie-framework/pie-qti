/** A canonical, declaration-safe CSS pixel length. */
export type CssPixelLength = `${number}px`;

const UNSIGNED_DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
const MAX_AUTHORED_PIXEL_LENGTH = 100_000;

function parseUnsignedDecimal(value: unknown, allowPixelSuffix: boolean): number | null {
	if (typeof value === 'number') {
		return Number.isFinite(value) && value >= 0 ? value : null;
	}
	if (typeof value !== 'string') return null;

	let token = value.trim();
	if (allowPixelSuffix && token.toLowerCase().endsWith('px')) {
		token = token.slice(0, -2).trim();
	}
	if (!UNSIGNED_DECIMAL.test(token)) return null;

	const parsed = Number(token);
	return Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_AUTHORED_PIXEL_LENGTH
		? parsed
		: null;
}

/**
 * Normalize an authored palette width to one complete CSS value.
 *
 * Palette widths are a player extension expressed in pixels. Restricting the
 * grammar to a non-negative decimal with an optional `px` suffix prevents an
 * authored value from terminating the width declaration and introducing a
 * second declaration such as `background-image: url(...)`.
 */
export function normalizeCssPixelLength(value: unknown): CssPixelLength | null {
	const parsed = parseUnsignedDecimal(value, true);
	return parsed === null ? null : (`${parsed}px` as CssPixelLength);
}

/**
 * Normalize QTI image/object width and height attributes to a positive pixel
 * count without a unit. Callers can safely append `px` in a style value.
 *
 * QTI dimensions use the integer-like HTML width/height attribute shape, so
 * unit-bearing values are rejected. Decimal values remain accepted for
 * compatibility and are emitted in canonical numeric form.
 */
export function normalizePixelDimension(
	value: unknown,
	fallback?: string | number,
): string | undefined {
	const parsed = parseUnsignedDecimal(value, false);
	if (parsed !== null && parsed > 0) return String(parsed);
	if (fallback === undefined) return undefined;

	const parsedFallback = parseUnsignedDecimal(fallback, false);
	return parsedFallback !== null && parsedFallback > 0 ? String(parsedFallback) : undefined;
}
