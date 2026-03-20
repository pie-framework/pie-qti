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
export function removePairBySource(pairs: string[], sourceId: string): string[] {
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
export function removePairByTarget(pairs: string[], targetId: string): string[] {
	return pairs.filter((p) => !p.endsWith(` ${targetId}`));
}

/**
 * Checks if a source is paired
 * @param pairs - Array of pair strings
 * @param sourceId - The source identifier
 * @returns True if the source has a pair
 */
export function isSourcePaired(pairs: string[], sourceId: string): boolean {
	return pairs.some((p) => p.startsWith(`${sourceId} `));
}

/**
 * Checks if a target is paired
 * @param pairs - Array of pair strings
 * @param targetId - The target identifier
 * @returns True if the target has a pair
 */
export function isTargetPaired(pairs: string[], targetId: string): boolean {
	return pairs.some((p) => p.endsWith(` ${targetId}`));
}
