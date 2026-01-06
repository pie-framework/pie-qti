/**
 * Generic response/value helpers.
 *
 * These are UI-agnostic utilities intended to keep "is this answered?"
 * logic consistent across apps (example, assessment player, etc).
 */

/**
 * Returns true when a response value should be treated as "no response / unanswered".
 *
 * Notes:
 * - `0` and `false` are valid answers in some interactions, so they are NOT empty.
 * - Empty objects are treated as empty, and objects whose values are all empty are treated as empty.
 */
export function isResponseEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true;

	if (typeof value === 'string') return value.trim() === '';

	if (Array.isArray(value)) {
		if (value.length === 0) return true;
		// Some interactions may emit arrays with empty members; treat "all empty" as empty.
		return value.every((v) => isResponseEmpty(v));
	}

	// Files/blobs are valid user responses (upload interactions).
	if (typeof Blob !== 'undefined' && value instanceof Blob) return false;

	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj);
		if (keys.length === 0) return true;
		return keys.every((k) => isResponseEmpty(obj[k]));
	}

	// numbers, booleans, symbols, functions -> treat as "has a response"
	return false;
}

export function countAnsweredForResponseIds(
	responses: Record<string, unknown>,
	responseIds: readonly string[]
): number {
	let count = 0;
	for (const id of responseIds) {
		if (!isResponseEmpty(responses[id])) count++;
	}
	return count;
}


