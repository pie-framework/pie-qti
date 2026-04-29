/**
 * Returns true if a source and target choice are compatible for pairing.
 *
 * Per QTI spec, an empty/absent matchGroup is unrestricted (pairs with anything).
 * Two non-empty matchGroups are compatible only if they share at least one value.
 */
export function isCompatibleMatchGroup(
	sourceGroups: string[] | undefined,
	targetGroups: string[] | undefined
): boolean {
	if (!sourceGroups || sourceGroups.length === 0) return true;
	if (!targetGroups || targetGroups.length === 0) return true;
	return sourceGroups.some((g) => targetGroups.includes(g));
}
