/**
 * Submission policy.
 *
 * The QTI itemSessionControl submission gate (`allowSkipping` / `validateResponses`)
 * and the coded rejections for held-back items. Moved out of `AssessmentPlayer.ts`
 * verbatim (pure code motion): pure decisions over explicit inputs — no lock, no
 * session state. Kept deliberately separate from the constraint-validation layer:
 * *whether* an item may be skipped or must validate is policy; *what* the item's
 * interactions require is read live from a detached item session by the orchestrator
 * (`responseValidationFor`) and only shapes the blocker's user-facing `requirement`.
 */

import type { SecureAssessment, SecureTestPart } from '../integration/api-contract.js';
import type { FlatItem } from './deliveryStructure.js';
import { isSkippedResponseSet, type ResponseDefault } from './AssessmentSessionCoordinator.js';
import type { ItemSessionControlSettings } from './ItemSessionController.js';
import { AssessmentPlayerError, type AssessmentPlayerErrorCode } from './errors.js';

/** The part's effective QTI submission mode (the assessment-level field is the fallback). */
export function effectiveSubmissionMode(
	testPart: SecureTestPart,
	assessment: SecureAssessment,
): 'individual' | 'simultaneous' {
	return testPart.submissionMode ?? assessment.submissionMode;
}

/**
 * QTI itemSessionControl `allowSkipping` / `validateResponses` for one item's
 * responses. Both are "only applicable when the item is in a testPart with individual
 * submission mode", so a simultaneous part is never gated. A skipped item (no
 * response at all: every response NULL, empty or still equal to its declared default —
 * the test `numberResponded` applies) may be submitted only when skipping is allowed,
 * and is then not validated; an answered item validates when the item asks for it.
 */
export function submissionGate(options: {
	individual: boolean;
	settings: Pick<ItemSessionControlSettings, 'allowSkipping' | 'validateResponses'>;
	responses: Record<string, unknown>;
	defaults: Readonly<Record<string, ResponseDefault>>;
}): { mustAnswer: boolean; validate: boolean } {
	const { individual, settings, responses, defaults } = options;
	if (!individual) return { mustAnswer: false, validate: false };
	const skipped = isSkippedResponseSet(responses, defaults);
	return {
		mustAnswer: skipped && settings.allowSkipping === false,
		validate: !skipped && settings.validateResponses === true,
	};
}

/**
 * An item a candidate-initiated end of the test would refuse to submit
 * (`getSubmissionBlockers()`): QTI `allowSkipping=false` with no response (`required`),
 * or `validateResponses=true` with responses that do not satisfy the interactions
 * (`invalid`). Both apply only to items in individual submission parts.
 */
export interface SubmissionBlocker {
	identifier: string;
	/** Flat delivery index (for `navigateTo`). */
	index: number;
	/** 1-based position shown to the candidate. */
	number: number;
	reason: 'required' | 'invalid';
	/** Whether the navigation rules let the candidate jump to it now. */
	jumpAllowed: boolean;
	/** False when the candidate can no longer reach the question (its part was left). */
	reachable: boolean;
	/**
	 * What the response still owes, when derivable from the item's interaction constraints
	 * (a minimum number of selections, strings, associations or plays); absent when the
	 * item only needs an answer. The shell localizes it into the entry text.
	 */
	requirement?: { kind: 'minChoices' | 'minStrings' | 'minAssociations' | 'minPlays' | 'incomplete'; count?: number };
}

/** Reject a candidate-initiated end of the test (or part leave) that would submit held-back items, naming them. */
export function throwForBlockers(blockers: ReadonlyArray<SubmissionBlocker>, context: 'finalize' | 'leavePart'): void {
	const required = blockers.filter((blocker) => blocker.reason === 'required');
	const named = required.length > 0 ? required : blockers;
	if (named.length === 0) return;
	const code: AssessmentPlayerErrorCode =
		context === 'finalize'
			? required.length > 0
				? 'finalizeResponseRequired'
				: 'finalizeResponseInvalid'
			: required.length > 0
				? 'leavePartResponseRequired'
				: 'leavePartResponseInvalid';
	const identifiers = named.map((blocker) => blocker.identifier);
	const what = context === 'finalize' ? 'the test can end' : 'leaving this test part';
	throw new AssessmentPlayerError(
		code,
		required.length > 0
			? `These items need a response before ${what}: ${identifiers.join(', ')}`
			: `These items have responses that do not satisfy their interactions (before ${what}): ${identifiers.join(', ')}`,
		{
			items: named.map((blocker) => blocker.number).join(', '),
			itemIdentifiers: identifiers.join(','),
			count: named.length,
		},
	);
}

/** Assemble the blocker view for an item a submission control would refuse right now. */
export function submissionBlockerFor(
	q: FlatItem,
	reason: SubmissionBlocker['reason'],
	requirement: SubmissionBlocker['requirement'] | undefined,
	jumpAllowed: boolean,
): SubmissionBlocker {
	return {
		identifier: q.identifier,
		index: q.index,
		number: q.index + 1,
		reason,
		jumpAllowed,
		reachable: jumpAllowed,
		...(requirement ? { requirement } : {}),
	};
}
