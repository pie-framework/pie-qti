/**
 * The outcome of parsing one of the element's JSON attributes: the attribute is
 * absent (removed or empty), parsed to a JSON object, or is malformed / not an
 * object.
 */
export type JsonAttributeParse<T> =
	| { status: 'absent' }
	| { status: 'parsed'; value: T }
	| { status: 'invalid' };

/**
 * Parse a JSON-object attribute (`items-json`, `config-json`, `security-json`).
 * Removal (null, undefined or the empty string) reports `absent`. Anything
 * JSON.parse rejects, or that is not a JSON object — a string, number, boolean,
 * array or null — reports `invalid`, so callers never cast a non-object value
 * into an object-typed field and can surface the malformed attribute instead of
 * silently keeping the previous one.
 */
export function parseJsonObjectAttribute<T>(value: string | null | undefined): JsonAttributeParse<T> {
	if (value === null || value === undefined || value === '') return { status: 'absent' };
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return { status: 'invalid' };
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { status: 'invalid' };
	}
	return { status: 'parsed', value: parsed as T };
}
