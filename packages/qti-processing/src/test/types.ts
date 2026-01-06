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
	/**
	 * Convenience flags for Number.Type test-level expressions. Backend should populate these based on its
	 * authoritative session state.
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


