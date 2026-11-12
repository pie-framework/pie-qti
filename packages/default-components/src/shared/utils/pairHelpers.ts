/**
 * Utility functions for working with QTI pair responses
 * Pairs are represented as space-separated strings: "sourceId targetId"
 */

/**
 * Gets the target ID matched with a source ID (first match only, for one-to-one display)
 * @param pairs - Array of "sourceId targetId" pair strings
 * @param sourceId - The source identifier to search for
 * @returns The matched target ID, or null if not found
 */
export function getTargetForSource(pairs: string[], sourceId: string): string | null {
	const pair = pairs.find((p) => p.startsWith(`${sourceId} `));
	return pair ? pair.split(' ')[1] : null;
}

/**
 * Gets all target IDs matched with a source ID (for many-to-many)
 * @param pairs - Array of "sourceId targetId" pair strings
 * @param sourceId - The source identifier to search for
 * @returns Array of matched target IDs
 */
export function getTargetsForSource(pairs: string[], sourceId: string): string[] {
	return pairs
		.filter((p) => p.startsWith(`${sourceId} `))
		.map((p) => p.split(' ')[1])
		.filter((t): t is string => !!t);
}

/**
 * Gets the source ID matched with a target ID
 * @param pairs - Array of "sourceId targetId" pair strings
 * @param targetId - The target identifier to search for
 * @returns The matched source ID, or null if not found
 */
export function getSourceForTarget(pairs: string[], targetId: string): string | null {
	const pair = pairs.find((p) => p.endsWith(` ${targetId}`));
	return pair ? pair.split(' ')[0] : null;
}

/**
 * Creates or updates a pair.
 * - Removes any existing pair for the target (target receives at most one when matchMax=1)
 * - Does NOT remove other pairs for the source (allows many-to-many: one source → multiple targets)
 * @param pairs - Array of existing pair strings
 * @param sourceId - The source identifier
 * @param targetId - The target identifier
 * @returns A new array with the pair created/updated
 */
export function createOrUpdatePair(pairs: string[], sourceId: string, targetId: string): string[] {
	// Remove any existing pair for this target (target gets "replaced")
	let newPairs = pairs.filter((p) => !p.endsWith(` ${targetId}`));

	// Don't remove source pairs - allows one source to match multiple targets (many-to-many)
	// Add new pair (avoid duplicate if same pair already exists)
	const newPair = `${sourceId} ${targetId}`;
	if (!newPairs.includes(newPair)) {
		newPairs.push(newPair);
	}

	return newPairs;
}

/**
 * Removes a pair by source ID
 * @param pairs - Array of existing pair strings
 * @param sourceId - The source identifier to remove
 * @returns A new array without the pair
 */
export function removePairBySource(pairs: readonly string[], sourceId: string): string[] {
	return pairs.filter((p) => !p.startsWith(`${sourceId} `));
}

/**
 * Removes a specific pair by source and target ID
 */
export function removePair(pairs: string[], sourceId: string, targetId: string): string[] {
	return pairs.filter((p) => p !== `${sourceId} ${targetId}`);
}

/**
 * Removes a pair by target ID
 * @param pairs - Array of existing pair strings
 * @param targetId - The target identifier to remove
 * @returns A new array without the pair
 */
export function removePairByTarget(pairs: readonly string[], targetId: string): string[] {
	return pairs.filter((p) => !p.endsWith(` ${targetId}`));
}

/**
 * Counts the pairs that have an identifier as their source (the first token)
 * @param pairs - Array of "sourceId targetId" pair strings
 * @param sourceId - The source identifier to count
 * @returns Number of pairs with that source
 */
export function countPairsForSource(pairs: readonly string[], sourceId: string): number {
	return pairs.filter((p) => p.startsWith(`${sourceId} `)).length;
}

/**
 * Places a source on a target in a directed-pair response, where each target holds one source
 * (a gap, a graphic gap match hotspot). The pair is written "source target", the QTI
 * `directedPair` order.
 *
 * - The target's previous pair is replaced.
 * - `sourceCapacity` is how many targets the source may fill (its matchMax; 0 means no limit).
 *   Below it the source's other placements stay: the source is reused. At it the source moves:
 *   its other placements are removed, so the capacity is never exceeded. A single-use source
 *   (capacity 1) therefore always moves.
 * - An empty `sourceId` adds no pair: the call clears the target.
 *
 * Unlike {@link createOrUpdatePair}, which keeps every other placement of the source (a
 * many-to-many match, which refuses past its capacity instead), this moves a source at its
 * capacity.
 * @param pairs - Array of existing "sourceId targetId" pair strings
 * @returns A new array with the placement applied
 */
export function placeSourceOnTarget(
	pairs: readonly string[],
	sourceId: string,
	targetId: string,
	sourceCapacity: number,
): string[] {
	let next = removePairByTarget(pairs, targetId);
	if (sourceCapacity > 0 && countPairsForSource(next, sourceId) >= sourceCapacity) {
		next = removePairBySource(next, sourceId);
	}
	if (sourceId) {
		const pair = `${sourceId} ${targetId}`;
		if (!next.includes(pair)) next.push(pair);
	}
	return next;
}

/**
 * Whether the pairs hold the unordered pair of two identifiers, in either order: the reading of
 * a QTI `pair` response (associate, graphic associate), whose pairs are unordered.
 * @param pairs - Array of "first second" pair strings
 * @returns True if "a b" or "b a" is among the pairs
 */
export function hasUnorderedPair(pairs: readonly string[], a: string, b: string): boolean {
	return pairs.some((p) => p === `${a} ${b}` || p === `${b} ${a}`);
}

/**
 * Checks if a pair string contains an identifier as its source or target token.
 * Matches whole tokens only: "A B" contains "B" but not a substring like "B2".
 * @param pair - A "sourceId targetId" pair string
 * @param id - The identifier to look for
 * @returns True if the identifier is either token of the pair
 */
export function pairIncludesId(pair: string, id: string): boolean {
	const spaceIndex = pair.indexOf(' ');
	if (spaceIndex === -1) return pair === id;
	return pair.slice(0, spaceIndex) === id || pair.slice(spaceIndex + 1) === id;
}

/**
 * Counts how many pairs contain an identifier as source or target
 * @param pairs - Array of "sourceId targetId" pair strings
 * @param id - The identifier to count
 * @returns Number of pairs involving the identifier
 */
export function countPairsWithId(pairs: string[], id: string): number {
	return pairs.filter((p) => pairIncludesId(p, id)).length;
}
