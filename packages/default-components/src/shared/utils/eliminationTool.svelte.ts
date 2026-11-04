import type { I18nProvider } from '@pie-qti/i18n';

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

/**
 * The eliminate/restore action label for the toggle button. A provider response equal to the key
 * means the key is missing, so the English fallback is used instead.
 */
export function eliminationActionLabel(eliminated: boolean, i18n?: I18nProvider): string {
	const key = eliminated ? 'interactions.choice.restoreChoice' : 'interactions.choice.eliminateChoice';
	const fallback = eliminated ? 'Restore' : 'Eliminate';
	const value = i18n?.t(key);
	return !value || value === key ? fallback : value;
}
