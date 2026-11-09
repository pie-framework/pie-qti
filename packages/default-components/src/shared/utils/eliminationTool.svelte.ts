/**
 * QTI 3.0 PNP §6.2 elimination tool: per-identifier scratch-work toggles. Eliminated items stay
 * in the DOM and in the response; only the candidate's view of them changes.
 */

export interface EliminationTool {
	/** The current set of eliminated identifiers. */
	readonly eliminated: Set<string>;
	isEliminated(identifier: string): boolean;
	toggle(identifier: string): void;
}

export function createEliminationTool(): EliminationTool {
	let eliminatedChoices = $state(new Set<string>());

	return {
		get eliminated() {
			return eliminatedChoices;
		},
		isEliminated(identifier: string): boolean {
			return eliminatedChoices.has(identifier);
		},
		toggle(identifier: string): void {
			const next = new Set(eliminatedChoices);
			if (next.has(identifier)) {
				next.delete(identifier);
			} else {
				next.add(identifier);
			}
			eliminatedChoices = next;
		},
	};
}
