/**
 * Shared confirm-before-submit flow for ordering interactions (WCAG 2.2 SC 3.3.4): the response
 * only becomes final when the candidate confirms, drag reordering auto-confirms, and an
 * externally cleared response re-arms the confirmation.
 */

export interface ConfirmationFlowOptions {
	/** The candidate-visible order. */
	orderedIds: () => string[];
	/** The authored order, used to detect whether the candidate reordered. */
	initialOrder: () => string[];
	disabled: () => boolean;
	/** The response as the plugin sees it (raw bindable or parsed prop); null before first commit. */
	response: () => unknown;
	/** Commits an order as the response (sets the bindable and emits the change). */
	commit: (order: string[]) => void;
}

export interface ConfirmationFlow {
	/** True when the candidate's order differs from the authored order. */
	readonly hasReordered: boolean;
	/** True while the confirm button should render. */
	readonly needsConfirmation: boolean;
	/** True once the candidate (or a drag) confirmed the current order. */
	readonly hasConfirmed: boolean;
	/** A drag reorder is a deliberate placement: confirm on the candidate's behalf. */
	autoConfirm(): void;
	/** Commit the current order as final (no-op when disabled or already confirmed). */
	confirmOrder(): void;
	/** Re-arm the confirmation when the response is externally cleared. */
	resetIfCleared(): void;
}

export function createConfirmationFlow(options: ConfirmationFlowOptions): ConfirmationFlow {
	let hasConfirmed = $state(false);

	const hasReordered = $derived.by(() => {
		const ids = options.orderedIds();
		const initial = options.initialOrder();
		return ids.length > 0 && ids.some((id, index) => id !== initial[index]);
	});

	const needsConfirmation = $derived(
		!options.disabled() && (!options.response() || !hasConfirmed) && options.orderedIds().length > 0
	);

	return {
		get hasReordered() {
			return hasReordered;
		},
		get needsConfirmation() {
			return needsConfirmation;
		},
		get hasConfirmed() {
			return hasConfirmed;
		},
		autoConfirm(): void {
			hasConfirmed = true;
		},
		confirmOrder(): void {
			if (options.disabled() || hasConfirmed) return;
			hasConfirmed = true;
			options.commit(options.orderedIds());
		},
		resetIfCleared(): void {
			const value = options.response();
			if (value === null || (Array.isArray(value) && value.length === 0)) {
				hasConfirmed = false;
			}
		},
	};
}
