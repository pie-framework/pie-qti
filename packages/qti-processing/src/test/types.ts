import type { QtiValue } from '../runtime/types.js';

export interface TestItemState {
	/** assessmentItemRef/@identifier */
	identifier: string;
	/** All section identifiers this item is contained by (outermost -> innermost). */
	sectionIdentifiers?: string[];
	/** assessmentItemRef/category tokens */
	categories?: string[];
	/**
	 * Weight values keyed by weightIdentifier (when QTI defines multiple named weights).
	 * If omitted, weight defaults to 1.
	 */
	weights?: Record<string, number>;
	/**
	 * Snapshot of item variables (responses/outcomes/template variables) at the time of test processing.
	 * Keys are QTI variable identifiers.
	 */
	variables: Record<string, QtiValue>;
	/** Declared normalMinimum/normalMaximum per outcome identifier, read by outcomeMinimum/outcomeMaximum. */
	outcomeBounds?: Record<string, { normalMinimum?: number; normalMaximum?: number }>;
	/**
	 * Flags for the number* test-level expressions, populated by the backend from its authoritative
	 * session state. presented: attempted at least once (defaults to true when omitted); responded: a
	 * response differs from its default; correct/incorrect: every response matches its correct
	 * response, or one does not, for an attempted item whose responses all declare one (inferred from
	 * SCORE and MAXSCORE when both are omitted); selected: part of the delivered test form.
	 */
	presented?: boolean;
	responded?: boolean;
	correct?: boolean;
	incorrect?: boolean;
	selected?: boolean;
}

export interface TestEvalContext {
	items: TestItemState[];
}


