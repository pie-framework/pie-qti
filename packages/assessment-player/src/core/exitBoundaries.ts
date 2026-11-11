/**
 * Exit-boundary resolution for branch decisions.
 *
 * Where a QTI branch rule's `EXIT_TEST` / `EXIT_TESTPART` / `EXIT_SECTION` (or a
 * plain item target) lands in the delivered sequence. Extracted from
 * `AssessmentPlayer.ts` as pure functions over the flat delivery — no lock, no session
 * state; what the orchestrator then *does* with the resolved boundary (flush the part,
 * navigate, end the test) stays with it. No longer a verbatim copy: the literal-target
 * semantics have since been deliberately aligned with the reference backend —
 * forward-only resolution through the shared `firstForwardBranchTarget`, and one
 * landing policy for every consumer (`branchLandingOf`: an EXIT_* is the landing, an
 * unresolvable literal is skipped).
 */

import type { SecureSection } from '../integration/api-contract.js';
import type { FlatItem } from './deliveryStructure.js';
import { firstForwardBranchTarget } from './testStructure.js';

/**
 * The enclosing section a literal EXIT_SECTION leaves: the innermost section, walked
 * outward while the next enclosing one also ends with the current item — a branch rule
 * on an outer section fires at its last item, where the whole outer boundary closes, so
 * the EXIT lands outside the entire outer section, not just outside the innermost one.
 */
export function endedEnclosingSection(
	current: FlatItem,
	items: readonly FlatItem[],
	currentIndex: number,
): SecureSection {
	let ended = current.section;
	for (let level = current.sections.length - 2; level >= 0; level--) {
		const section = current.sections[level]!;
		const continues = items.some(
			(item, i) => i > currentIndex && item.sections.some((s) => s.identifier === section.identifier),
		);
		if (continues) break;
		ended = section;
	}
	return ended;
}

/**
 * Where a branch decision lands: an item index, or -1 when it ends the test or resolves to
 * nothing forward. Literal targets resolve forward-only (QTI 2.2 §5.15: the target must refer
 * to an item or section that has not yet been presented — a delivered test never re-enters an
 * earlier one) through the same shared resolver the reference backend uses
 * (`firstForwardBranchTarget`), so identical XML branches identically on the backend path. An
 * unresolvable literal — e.g. a backward target with no later occurrence — is skipped: the
 * delivery rules decide from the next item, as when the backend leaves the rule unfired.
 */
export function branchTargetIndex(
	q: FlatItem,
	target: string,
	items: readonly FlatItem[],
	currentIndex: number,
): number {
	if (target === 'EXIT_TEST') return -1;
	if (target === 'EXIT_TESTPART') {
		return items.findIndex((item, i) => i > q.index && item.testPart !== q.testPart);
	}
	if (target === 'EXIT_SECTION') {
		const exited = endedEnclosingSection(q, items, currentIndex);
		const inside = items.findIndex(
			(item, i) => i > q.index && !item.sections.some((section) => section.identifier === exited.identifier),
		);
		return inside >= 0 ? inside : items.findIndex((item, i) => i > q.index && item.testPart !== q.testPart);
	}
	return firstForwardBranchTarget(target, items, q.index) ?? -1;
}

/**
 * How a branch decision lands in the delivery once `branchTargetIndex` has resolved it —
 * the one statement of the policy every consumer shares:
 *
 * - `{ kind: 'item', index }` — the decision names a forward item: delivery hops there.
 * - `{ kind: 'exit' }` — an `EXIT_TEST` / `EXIT_TESTPART` / `EXIT_SECTION`: the exit itself
 *   is the landing; boundary handling ends the scope or the test (a resolved index of -1
 *   never navigates).
 * - `{ kind: 'skipped' }` — a literal target with no forward occurrence: the rule does not
 *   fire, and the delivery rules decide from the next item, as when the backend leaves the
 *   rule unfired.
 */
export type BranchLanding =
	| { readonly kind: 'item'; readonly index: number }
	| { readonly kind: 'exit' }
	| { readonly kind: 'skipped' };

/** Classify a resolved branch decision (see `BranchLanding`). */
export function branchLandingOf(target: string, resolvedIndex: number): BranchLanding {
	if (resolvedIndex >= 0) return { kind: 'item', index: resolvedIndex };
	return isExitBranchTarget(target) ? { kind: 'exit' } : { kind: 'skipped' };
}

/** Whether a branch rule target exits a scope (`EXIT_TEST` / `EXIT_TESTPART` / `EXIT_SECTION`) rather than naming an item. */
function isExitBranchTarget(target: string): boolean {
	return target === 'EXIT_TEST' || target === 'EXIT_TESTPART' || target === 'EXIT_SECTION';
}

/** Whether a branch decision takes delivery out of the item's test part (or ends the test). */
export function branchExitLeavesPart(
	q: FlatItem,
	target: string,
	items: readonly FlatItem[],
	currentIndex: number,
): boolean {
	const landing = branchLandingOf(target, branchTargetIndex(q, target, items, currentIndex));
	switch (landing.kind) {
		case 'exit':
			// EXIT_TEST ends the test; an EXIT_* boundary nothing follows ends the part anyway.
			return true;
		case 'item':
			return items[landing.index]!.testPart !== q.testPart;
		case 'skipped':
			// The rule does not fire (the backend falls through to the next item), so it
			// crosses no part boundary.
			return false;
	}
}

/**
 * The first delivered item an EXIT_TESTPART / EXIT_SECTION boundary leaves, or -1 when
 * nothing follows (the test ends). The literal resolves over the item's full enclosing
 * chain (like the backend's branch-rule walk), not the innermost section alone: an
 * outer-section EXIT lands outside the whole outer section — and when nothing follows
 * the section inside its test part, the part ends too.
 */
export function resolveExitBoundary(
	special: 'EXIT_TESTPART' | 'EXIT_SECTION',
	current: FlatItem,
	items: readonly FlatItem[],
	currentIndex: number,
): number {
	const exitedSection = special === 'EXIT_SECTION' ? endedEnclosingSection(current, items, currentIndex) : undefined;
	let nextIdx = items.findIndex((item, i) =>
		i > currentIndex &&
		(exitedSection
			? !item.sections.some((section) => section.identifier === exitedSection.identifier)
			: item.testPart.identifier !== current.testPart.identifier),
	);
	if (exitedSection && nextIdx < 0) {
		// Nothing follows the section inside this test part: the part ends too.
		nextIdx = items.findIndex(
			(item, i) => i > currentIndex && item.testPart !== current.testPart,
		);
	}
	return nextIdx;
}
