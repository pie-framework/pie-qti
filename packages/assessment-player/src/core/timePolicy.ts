/**
 * Time policy: effective limits for an item across its scope chain, the submit
 * timing evidence a backend receives, and the minimum-time gate.
 *
 * Moved out of `AssessmentPlayer.ts` verbatim (pure code motion): pure functions
 * and queries over explicit inputs — the orchestrator resolves the scope chain,
 * the PNP extended time and the TimeManager's elapsed readings and passes them in.
 * None of this takes the transition lock.
 */

import type { SubmitTimingEvidence } from '../integration/api-contract.js';
import type { TimeLimits } from '../types/index.js';
import type { FlatItem } from './deliveryStructure.js';
import type { ExtendedTime } from './TimeManager.js';
import { extendTimeLimit } from './TimeManager.js';
import { AssessmentPlayerError } from './errors.js';

export interface EffectiveItemTimeLimits {
	timeLimits?: TimeLimits;
	source?: 'item' | 'section' | 'testPart' | 'assessment';
	/**
	 * Identifier of the scope that supplied the binding maximum (the section among the
	 * enclosing chain when a section limit binds; undefined for the assessment scope).
	 */
	scopeIdentifier?: string;
}

/** The nearest binding limits across the item's scopes (assessment → part → sections → item). */
export function effectiveItemTimeLimits(
	flat: FlatItem,
	assessmentTimeLimits: TimeLimits | undefined,
	extendedTime: ExtendedTime | undefined,
): EffectiveItemTimeLimits {
	const scopes: Array<{
		source: EffectiveItemTimeLimits['source'];
		identifier?: string;
		limits?: TimeLimits;
	}> = [
		{ source: 'assessment', limits: assessmentTimeLimits },
		{ source: 'testPart', identifier: flat.testPart.identifier, limits: flat.testPart.timeLimits },
		// Every enclosing section limits the item, not only the innermost one.
		...flat.sections.map((section) => ({
			source: 'section' as const,
			identifier: section.identifier,
			limits: section.timeLimits,
		})),
		{ source: 'item', identifier: flat.identifier, limits: flat.item.timeLimits },
	];
	let source: EffectiveItemTimeLimits['source'];
	let scopeIdentifier: string | undefined;
	let minTime: number | undefined;
	let maxTime: number | undefined;
	let allowLateSubmission: boolean | undefined;
	for (const scope of scopes) {
		if (!scope.limits) continue;
		if (scope.limits.minTime !== undefined) {
			minTime = minTime === undefined ? scope.limits.minTime : Math.max(minTime, scope.limits.minTime);
		}
		if (scope.limits.maxTime !== undefined) {
			const scopedMaxTime = extendTimeLimit(scope.limits.maxTime, extendedTime);
			if (scopedMaxTime !== undefined && (maxTime === undefined || scopedMaxTime < maxTime)) {
				maxTime = scopedMaxTime;
				source = scope.source;
				scopeIdentifier = scope.identifier;
				allowLateSubmission = scope.limits.allowLateSubmission;
			}
		} else if (scope.limits.allowLateSubmission !== undefined && maxTime === undefined) {
			allowLateSubmission = scope.limits.allowLateSubmission;
			source = scope.source;
			scopeIdentifier = scope.identifier;
		}
	}

	if (maxTime === undefined && minTime === undefined && allowLateSubmission === undefined) {
		return {};
	}
	return { source, scopeIdentifier, timeLimits: { minTime, maxTime, allowLateSubmission } };
}

/** The submit timing evidence for one item submission, from its effective limits and clock readings. */
export function submitTimingEvidence(options: {
	q: FlatItem;
	effective: EffectiveItemTimeLimits;
	/** Wall-clock fallback elapsed for the item (the serialized session duration). */
	elapsedMs: number;
	/** The TimeManager's per-scope elapsed reading; undefined when there is none. */
	scopeElapsedMs: (scope: 'assessment' | 'testPart' | 'section' | 'item', identifier?: string) => number | undefined;
	/** The PNP-extended whole-test maximum in seconds; undefined when the test has none. */
	assessmentLimitSeconds: number | undefined;
	/** The TimeManager's whole-test elapsed reading; undefined when there is none. */
	assessmentElapsedMs: number | undefined;
	submissionReason?: SubmitTimingEvidence['submissionReason'];
}): SubmitTimingEvidence | undefined {
	const { q, effective, elapsedMs, scopeElapsedMs, assessmentLimitSeconds, assessmentElapsedMs, submissionReason } =
		options;
	const limitSeconds = effective.timeLimits?.maxTime;
	if (!effective.source || limitSeconds === undefined) {
		// An administrative collection (a proctor's forced end) reports its reason even
		// when nothing is timed.
		return submissionReason
			? {
					scope: 'assessment',
					elapsedMs: scopeElapsedMs('assessment') ?? elapsedMs,
					submissionReason,
				}
			: undefined;
	}
	const scopeIdentifier = effective.source === 'assessment'
		? undefined
		: (effective.scopeIdentifier ??
			(effective.source === 'item'
				? q.identifier
				: effective.source === 'section'
					? q.section.identifier
					: q.testPart.identifier));
	const scopedElapsedMs = scopeElapsedMs(effective.source, scopeIdentifier) ?? elapsedMs;
	return {
		scope: effective.source,
		elapsedMs: scopedElapsedMs,
		limitSeconds,
		expired: scopedElapsedMs >= limitSeconds * 1000,
		allowLateSubmission: effective.timeLimits?.allowLateSubmission,
		// The candidate's own test clock: it excludes begin-gate and proctor-pause time,
		// which a backend wall clock measured from session creation would count.
		...(assessmentLimitSeconds !== undefined && assessmentElapsedMs !== undefined
			? {
					assessmentElapsedMs,
					assessmentLimitSeconds,
				}
			: {}),
		...(submissionReason ? { submissionReason } : {}),
	};
}

/** The minimum-time gate: a coded refusal while the scope's minimum has not elapsed. */
export function assertMinTimeElapsed(
	scope: 'assessment' | 'testPart' | 'section' | 'item',
	limits: TimeLimits | undefined,
	elapsedMs: number,
): void {
	if (limits?.minTime === undefined) return;
	if (elapsedMs < limits.minTime * 1000) {
		const remaining = Math.ceil(limits.minTime - elapsedMs / 1000);
		throw new AssessmentPlayerError(
			'minTimeNotElapsed',
			`The ${scope} minimum time has not elapsed (${remaining}s remaining).`,
			{ scope, remaining },
		);
	}
}
