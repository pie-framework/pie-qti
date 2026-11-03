/**
 * Shared archive-extraction safety policy.
 *
 * Single authority for the zip-bomb guardrails applied by the three archive
 * engines (@pie-qti/ims-cp-browser jszip, @pie-qti/ims-cp-node unzipper,
 * @pie-qti/storage adm-zip). The engines differ per platform by necessity;
 * the limits, validation, and ratio math must not drift between them.
 */

/** Guardrail limits for extracting untrusted archives. */
export interface ArchiveExtractionLimits {
	/** Maximum compressed input size in bytes. */
	maxCompressedSize: number;
	/** Maximum total advertised uncompressed size in bytes. */
	maxTotalUncompressedSize: number;
	/** Maximum number of archive entries. */
	maxEntries: number;
	/** Maximum allowed uncompressed/compressed size ratio per entry. */
	maxCompressionRatio: number;
}

/** Default guardrails: 100 MB compressed, 250 MB uncompressed, 1000 entries, ratio 200. */
export const DEFAULT_ARCHIVE_EXTRACTION_LIMITS: Readonly<ArchiveExtractionLimits> = {
	maxCompressedSize: 100 * 1024 * 1024,
	maxTotalUncompressedSize: 250 * 1024 * 1024,
	maxEntries: 1000,
	maxCompressionRatio: 200,
};

/**
 * Resolve a single configurable limit against its fallback.
 *
 * @param value - Host-provided value (undefined selects the fallback).
 * @param fallback - Default value.
 * @param name - Option name used in error messages.
 * @param requireInteger - Reject non-integer values (counts).
 */
export function resolveArchiveLimit(
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
 * True when an entry's size ratio exceeds `maximum` (possible zip bomb).
 * Zero-sized compressed entries with content are always rejected.
 */
export function exceedsCompressionRatio(
	uncompressed: number,
	compressed: number,
	maximum: number,
): boolean {
	if (uncompressed === 0 || maximum === Number.POSITIVE_INFINITY) return false;
	if (compressed <= 0) return true;
	return uncompressed / compressed > maximum;
}
