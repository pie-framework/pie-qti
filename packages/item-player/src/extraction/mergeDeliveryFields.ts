/**
 * Merge extension (plugin-owned) sink policy with the authored standard policy
 * for one interaction kind.
 *
 * Both lists may classify the same output path; one path has one sink meaning,
 * so the merge is last-wins by path with the standard policy applied last: a
 * plugin can add new paths but cannot relabel a standard one — not even by
 * changing the field's kind.
 */
export function mergeDeliveryFields<T extends { kind: string; path: readonly (string | '*')[] }>(
	extensions: readonly T[],
	standard: readonly T[],
): T[] {
	const fieldsByPath = new Map<string, T>();
	for (const field of [...extensions, ...standard]) {
		fieldsByPath.set(JSON.stringify(field.path), field);
	}
	return [...fieldsByPath.values()];
}
