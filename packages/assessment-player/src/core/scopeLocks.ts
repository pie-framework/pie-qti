/**
 * Scope time locks.
 *
 * A test part, section or item whose hard limit expired without late submission
 * closes for the candidate; a whole-test expiry closes everything. Moved out of
 * `AssessmentPlayer.ts` verbatim (pure code motion): the registry and its queries
 * are policy only — no lock, no session state. The whole-test expiry flag stays
 * with the orchestrator's terminal state and is passed in explicitly.
 */

import type { TimeLimits } from '../types/index.js';
import type { FlatItem } from './deliveryStructure.js';
import type { ExtendedTime } from './TimeManager.js';
import { extendTimeLimit } from './TimeManager.js';

export type TimeScope = 'testPart' | 'section' | 'item';

export function scopeKey(scope: TimeScope, identifier: string): string {
	return `${scope}:${identifier}`;
}

/**
 * Whether a hard maximum has run out for the given elapsed milliseconds (PNP
 * extended time applied). Limits that allow late submission never lock.
 */
export function scopeLimitRanOut(
	limits: TimeLimits | undefined,
	elapsedMs: number | undefined,
	extendedTime: ExtendedTime | undefined,
): boolean {
	if (limits?.maxTime === undefined || limits.allowLateSubmission === true) return false;
	const maxSeconds = extendTimeLimit(limits.maxTime, extendedTime);
	return maxSeconds !== undefined && (Number(elapsedMs) || 0) >= maxSeconds * 1000;
}

/** The scopes whose time limit expired without late submission, keyed `scope:identifier`. */
export class ScopeLocks {
	readonly #locked = new Set<string>();

	/** Lock a scope; true when it was not locked before. */
	lock(scope: TimeScope, identifier: string): boolean {
		const key = scopeKey(scope, identifier);
		if (this.#locked.has(key)) return false;
		this.#locked.add(key);
		return true;
	}

	isLocked(scope: TimeScope, identifier: string): boolean {
		return this.#locked.has(scopeKey(scope, identifier));
	}

	/** Drop every lock (a host-driven restore recomputes them from the snapshot's clocks). */
	clear(): void {
		this.#locked.clear();
	}
}

/**
 * Whether an expired limit closes the item for the candidate: its own, any
 * enclosing section's, its test part's — or the whole test expired, which closes
 * every item (the collection of the test is all that remains).
 */
export function isItemLocked(q: FlatItem, locks: ScopeLocks, assessmentExpired: boolean): boolean {
	if (assessmentExpired) return true;
	return (
		locks.isLocked('item', q.identifier) ||
		locks.isLocked('testPart', q.testPart.identifier) ||
		q.sections.some((section) => locks.isLocked('section', section.identifier))
	);
}

/** The expired scope that closes an item (outermost first); the assessment for a whole-test expiry. */
export function lockingScopeOf(
	q: FlatItem | undefined,
	locks: ScopeLocks,
	assessmentExpired: boolean,
): Pick<import('./AssessmentPlayer.js').AssessmentTimeExpiryEvent, 'scope' | 'identifier'> {
	if (assessmentExpired || !q) return { scope: 'assessment' };
	if (locks.isLocked('testPart', q.testPart.identifier)) {
		return { scope: 'testPart', identifier: q.testPart.identifier };
	}
	for (const section of q.sections) {
		if (locks.isLocked('section', section.identifier)) {
			return { scope: 'section', identifier: section.identifier };
		}
	}
	return { scope: 'item', identifier: q.identifier };
}
