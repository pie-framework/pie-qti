/**
 * The player's one clone/freeze family.
 *
 * Everything the player snapshots (session views, transitions, serialized
 * state, delivered interaction data, definition configuration, presentation
 * plans) goes through these helpers, so the treatment of the shapes that make
 * deep-copying hazardous is defined once:
 *
 * - Plain objects and arrays are structurally deep-copied.
 * - ArrayBuffers and typed arrays are copied and never frozen: a response's
 *   drawing `imageData` (`Uint8ClampedArray`) cannot be frozen — `Object.freeze`
 *   throws on a non-empty integer-indexed exotic object — and callers must stay
 *   able to read it after `state()`, serialize and restore.
 * - TrustedHTML, `File`, `Blob` and every other non-plain object keep their
 *   identity as terminal leaves. `structuredClone` would throw `DataCloneError`
 *   on a TrustedHTML value, so presentation and extraction data — which carry
 *   TrustedHTML once a Trusted Types policy is configured — are never handed to
 *   it; a host-owned object a plugin supplied deliberately must survive
 *   delivery as the same object.
 */

/**
 * Structural deep copy of plain data. Typed arrays and buffers are copied;
 * non-plain objects keep their identity; nothing is frozen.
 */
export function cloneValue<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((entry) => cloneValue(entry)) as unknown as T;
	}
	if (!value || typeof value !== 'object') return value;
	if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
		return structuredClone(value);
	}
	// TrustedHTML, File, Blob and other class instances are terminal leaves (see
	// the module doc): not structured-cloned, not recreated, identity preserved.
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
			key,
			cloneValue(entry),
		]),
	) as T;
}

/**
 * In-place deep freeze of a data graph. Plain objects and arrays are frozen;
 * non-plain leaves (TrustedHTML, File, Blob, typed arrays, host objects) are
 * returned untouched — freezing a browser-owned object can throw and freezing
 * a typed array always would. An already-frozen node short-circuits its subtree.
 */
export function deepFreezeInPlace<T>(value: T): T {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
	Object.freeze(value);
	for (const child of Object.values(value as Record<string, unknown>)) {
		deepFreezeInPlace(child);
	}
	return value;
}

/**
 * Clone and freeze plain data without mutating values owned by the caller or a
 * PCI module: `cloneValue`'s copy, deeply frozen.
 */
export function frozenSnapshot<T>(value: T): T {
	return deepFreezeInPlace(cloneValue(value));
}
