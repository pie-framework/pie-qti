/**
 * Utility functions for working with QTI pair responses
 * Pairs are represented as space-separated strings: "sourceId targetId"
 */

/**
 * Gets the target ID matched with a source ID
 * @param pairs - Array of "sourceId targetId" pair strings
 * @param sourceId - The source identifier to search for
 * @returns The matched target ID, or null if not found
 */
export function getTargetForSource(pairs: string[], sourceId: string): string | null {
	const pair = pairs.find((p) => p.startsWith(`${sourceId} `));
	return pair ? pair.split(' ')[1] : null;
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
 * Creates or updates a pair, removing any existing pairs for the source or target
 * @param pairs - Array of existing pair strings
 * @param sourceId - The source identifier
 * @param targetId - The target identifier
 * @returns A new array with the pair created/updated
 */
export function createOrUpdatePair(pairs: string[], sourceId: string, targetId: string): string[] {
	// Remove any existing pair for this source
	let newPairs = pairs.filter((p) => !p.startsWith(`${sourceId} `));

	// Remove any existing pair for this target
	newPairs = newPairs.filter((p) => !p.endsWith(` ${targetId}`));

	// Add new pair
	newPairs.push(`${sourceId} ${targetId}`);

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
