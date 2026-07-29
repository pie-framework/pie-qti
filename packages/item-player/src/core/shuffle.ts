/**
 * Seeded shuffling for QTI interactions that support the `shuffle` attribute.
 *
 * QTI expects the presentation order to be randomized per candidate attempt, and to
 * stay stable *within* that attempt — a candidate must not see choices jump around
 * between re-renders or after reloading a saved session. Both properties come from
 * seeding a real PRNG with the item session GUID: `Player` persists that GUID in its
 * saved state and restores it, so the same attempt reproduces the same order while a
 * different candidate (or a new attempt) gets a different one.
 */

import { createSeededRng } from './random.js';

/**
 * FNV-1a (32-bit) string hash.
 *
 * Deliberately not a sum of character codes: a sum is order-insensitive, so it
 * collides on anagrams (`"AB"`/`"BA"`, `"item1"`/`"1item"`) and clusters tightly for
 * ids sharing a prefix, which in turn makes a weak PRNG return the same permutation
 * for every item.
 */
export function hashStringToSeed(value: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/**
 * Build the RNG used to shuffle one interaction's choices.
 *
 * Keyed on both the session GUID and the response identifier so that two interactions
 * in the same item do not receive identical permutations.
 */
export function createShuffleRng(sessionGuid: string, responseId: string): () => number {
	return createSeededRng(hashStringToSeed(`${sessionGuid}:${responseId}`));
}

/**
 * Fisher-Yates shuffle that honours QTI's `fixed` attribute: entries reported as fixed
 * keep their authored index, and only the remaining entries are permuted among the
 * leftover slots.
 *
 * Returns a new array; the input is not mutated.
 */
export function shuffleWithFixed<T>(
	items: readonly T[],
	isFixed: (item: T) => boolean,
	rng: () => number,
): T[] {
	const fixedAt = new Map<number, T>();
	const movable: T[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (isFixed(item)) {
			fixedAt.set(i, item);
		} else {
			movable.push(item);
		}
	}

	for (let i = movable.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[movable[i], movable[j]] = [movable[j], movable[i]];
	}

	const out: T[] = new Array(items.length);
	let next = 0;
	for (let i = 0; i < items.length; i++) {
		const pinned = fixedAt.get(i);
		out[i] = pinned !== undefined ? pinned : movable[next++];
	}
	return out;
}

/**
 * Convenience wrapper for the common extractor case.
 *
 * `rng` is optional so that an externally constructed `ExtractionContext` without one
 * simply keeps the authored order rather than throwing — failing back to the order the
 * content author wrote is always safe.
 */
export function maybeShuffle<T>(
	items: readonly T[],
	shuffle: boolean,
	rng: (() => number) | undefined,
): T[] {
	if (!shuffle || !rng || items.length < 2) return [...items];
	// `T` is intentionally unconstrained: constraining it to `{ fixed?: boolean }` makes
	// inference collapse `T` to the constraint for choice types that do not declare
	// `fixed` (e.g. `associateInteraction`), erasing their real fields from the result.
	return shuffleWithFixed(items, (item) => (item as { fixed?: boolean }).fixed === true, rng);
}
