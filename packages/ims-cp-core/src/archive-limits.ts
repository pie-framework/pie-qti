/**
 * Shared archive-extraction limit helpers.
 *
 * These encode the safety boundary for untrusted content packages (entry counts,
 * size and compression-ratio bomb caps). They were previously duplicated across
 * the platform packages (ims-cp-node, ims-cp-browser) and could drift; the
 * platform packages own only their IO, not the safety rules.
 */

/**
 * Resolve one archive limit from an optional override and its default.
 * @throws when the value is negative, non-finite (except +Infinity), or non-integer when required.
 */
export function resolveLimit(
	value: number | undefined,
	fallback: number,
	name: string,
	requireInteger = false,
): number {
	const resolved = value ?? fallback;
	if (
		resolved !== Number.POSITIVE_INFINITY &&
		(!Number.isFinite(resolved) || resolved < 0 || (requireInteger && !Number.isInteger(resolved)))
	) {
		throw new Error(`${name} must be a non-negative ${requireInteger ? 'integer' : 'number'}`);
	}
	return resolved;
}

/**
 * True when an entry's expansion exceeds the allowed compression ratio — the
 * decompression-bomb guard. A non-positive compressed size with a nonzero
 * uncompressed size is treated as exceeding.
 */
export function exceedsCompressionRatio(uncompressed: number, compressed: number, maximum: number): boolean {
	if (uncompressed === 0 || maximum === Number.POSITIVE_INFINITY) return false;
	if (compressed <= 0) return true;
	return uncompressed / compressed > maximum;
}
