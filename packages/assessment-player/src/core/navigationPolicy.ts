/**
 * Client navigation legality.
 *
 * Whether the navigation *rules* let a candidate move or jump right now: linear
 * versus nonlinear delivery, test-part sequencing, time locks and review policy.
 * Moved out of `AssessmentPlayer.ts` verbatim (pure code motion): pure functions
 * over the delivery structure and predicates the orchestrator supplies — they
 * never take the transition lock, and they are kept separate from the delivery-rules
 * walk (`testStructure.ts`, shared with the backend's `integration/test-navigation.ts`
 * entry), which decides *where* the rules go, not whether a move is legal.
 */

import type { SecureAssessment, SecureSection, SecureTestPart } from '../integration/api-contract.js';
import type { FlatItem } from './deliveryStructure.js';

/** The part's effective QTI navigation mode (the assessment-level field is the fallback). */
export function effectiveNavigationMode(
	testPart: SecureTestPart,
	assessment: SecureAssessment,
): 'linear' | 'nonlinear' {
	return testPart.navigationMode ?? assessment.navigationMode ?? 'nonlinear';
}

/**
 * Whether jumping to a presented section is legal right now: in linear navigation there
 * is no jumping at all; in nonlinear navigation only sections of the current test part
 * are reachable, never locked items or items review has closed. Finalized tests have no
 * legal targets.
 */
export function isLegalSectionTarget(options: {
	section: SecureSection;
	items: readonly FlatItem[];
	assessment: SecureAssessment;
	finalized: boolean;
	currentIndex: number;
	isItemLocked: (q: FlatItem) => boolean;
	canReviewItem: (q: FlatItem) => boolean;
}): boolean {
	const { section, items, assessment, finalized, currentIndex, isItemLocked, canReviewItem } = options;
	if (finalized) return false;
	const current = items[currentIndex];
	if (!current) return false;
	const members = items.filter((q) =>
		q.sections.some((s) => s.identifier === section.identifier),
	);
	if (members.length === 0) return false;
	const mode = effectiveNavigationMode(current.testPart, assessment);
	if (mode === 'linear') {
		return members.some((q) => q === current);
	}
	return members.some(
		(q) =>
			q.testPart === current.testPart &&
			!isItemLocked(q) &&
			canReviewItem(q),
	);
}

/**
 * Whether a candidate-initiated move from `currentIndex` to `targetIndex` follows the
 * navigation rules. Within a nonlinear test part any item is reachable. Otherwise the only
 * forward move is the forward step itself — `forward`, the item the backend's decision kept
 * for the current item or the delivery rules (branch rules, preconditions) deliver next,
 * passing over items an expired limit closed: in a linear part no item is skipped or
 * revisited, and test parts are entered in sequence — never a jump across a part, never
 * one back, never into a part whose precondition fails.
 */
export function canNavigateByTestPart(options: {
	targetIndex: number;
	currentIndex: number;
	items: readonly FlatItem[];
	assessment: SecureAssessment;
	forward: () => number;
}): boolean {
	const { targetIndex, currentIndex, items, assessment, forward } = options;
	if (targetIndex < 0 || targetIndex >= items.length) return false;
	const current = items[currentIndex];
	const target = items[targetIndex];
	if (!current || !target) return false;
	if (targetIndex === currentIndex) return true;
	const mode = effectiveNavigationMode(current.testPart, assessment);
	if (current.testPart === target.testPart && mode === 'nonlinear') return true;
	if (targetIndex < currentIndex) return false;
	return targetIndex === forward();
}
