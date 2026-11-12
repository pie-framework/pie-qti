/**
 * QTI attempt-relative feedback visibility (see `src/core/feedback.ts`).
 *
 * The tables below pin BOTH rules that apply the shape, over
 * showFeedback x maxAttempts (1, 2, unlimited) x attempts x adaptive:
 *
 * - `attemptFeedbackVisible` + `resolveMaxAttempts` — the presentation rule
 *   (`AssessmentPlayer.feedbackVisible`): the live session's presentation policy and
 *   the shell's captured item feedback.
 * - `ItemSessionController.shouldShowFeedback` — the session-info rule
 *   (`getItemSessionInfo().showFeedback`).
 *
 * They differ on purpose in four ways, and the tables pin each difference:
 * 1. unlimited attempts: the presentation rule carries `null` maxAttempts
 *    (`resolveMaxAttempts` maps an authored 0 to it and clamps to at least 1); the
 *    session-info rule reads the authored 0 in its settings.
 * 2. the attempt count: the presentation rule is judged on the *projected* count
 *    (attemptsAfter — the counted attempts once the attempt being judged ends); the
 *    session-info rule reads the *live* recorded count.
 * 3. before the first attempt: `showFeedback` alone makes the presentation rule true,
 *    while the session-info rule answers false until the item has been submitted.
 * 4. the adaptive override: the presentation rule reads the item XML — an adaptive
 *    item shows feedback unconditionally; the session-info rule sees only settings,
 *    so an adaptive item is unlimited there only through the resolved cascade
 *    (`resolveItemSessionControl` zeroes `maxAttempts` for adaptive items).
 */

import { describe, expect, test } from 'bun:test';
import { attemptFeedbackVisible, resolveMaxAttempts } from '../src/core/feedback.js';
import { ItemSessionController } from '../src/core/ItemSessionController.js';

describe('resolveMaxAttempts', () => {
	test("maps the authored control to the rule's maximum, null when unlimited", () => {
		expect(resolveMaxAttempts({ maxAttempts: undefined }, false)).toBe(1);
		expect(resolveMaxAttempts(undefined, false)).toBe(1);
		expect(resolveMaxAttempts({ maxAttempts: 1 }, false)).toBe(1);
		expect(resolveMaxAttempts({ maxAttempts: 2 }, false)).toBe(2);
		expect(resolveMaxAttempts({ maxAttempts: 0 }, false)).toBeNull();
		// An unfriendly authored value cannot open the door to negative maxima.
		expect(resolveMaxAttempts({ maxAttempts: -3 }, false)).toBe(1);
	});

	test('an adaptive item is unlimited whatever the control says', () => {
		expect(resolveMaxAttempts({ maxAttempts: undefined }, true)).toBeNull();
		expect(resolveMaxAttempts({ maxAttempts: 1 }, true)).toBeNull();
		expect(resolveMaxAttempts({ maxAttempts: 0 }, true)).toBeNull();
	});
});

/**
 * The presentation rule's answers, expected values written out per
 * (showFeedback, maxAttempts) column over attempts 0, 1, 2, 3.
 */
const PRESENTATION_EXPECTED: Record<string, Record<number, boolean[]>> = {
	// showFeedback off: nothing before an attempt; a non-final attempt only.
	off: { 1: [false, false, false, false], 2: [false, true, false, false], 0: [false, true, true, true] },
	// showFeedback on: whatever the attempts have done.
	on: { 1: [true, true, true, true], 2: [true, true, true, true], 0: [true, true, true, true] },
};

const ATTEMPTS = [0, 1, 2, 3];
const AUTHORED_MAX = [1, 2, 0]; // 0 = unlimited

describe('attemptFeedbackVisible — the presentation rule', () => {
	test('showFeedback x maxAttempts (1, 2, unlimited) x attempts', () => {
		for (const [feedbackKey, showFeedback] of [
			['off', false],
			['on', true],
		] as const) {
			for (const maxAttempts of AUTHORED_MAX) {
				for (const [index, attempts] of ATTEMPTS.entries()) {
					expect(attemptFeedbackVisible({
						showFeedback,
						maxAttempts: resolveMaxAttempts({ maxAttempts }, false),
						attempts,
						adaptive: false,
					})).toBe(PRESENTATION_EXPECTED[feedbackKey]![maxAttempts]![index]);
				}
			}
		}
	});

	test('adaptive: true for every cell of the grid, whatever the attempts', () => {
		for (const showFeedback of [false, true]) {
			for (const maxAttempts of AUTHORED_MAX) {
				for (const attempts of ATTEMPTS) {
					expect(attemptFeedbackVisible({
						showFeedback,
						maxAttempts: resolveMaxAttempts({ maxAttempts }, true),
						attempts,
						adaptive: true,
					})).toBe(true);
				}
			}
		}
	});

	test('unlimited attempts show feedback once an attempt has ended, not before', () => {
		const unlimited = resolveMaxAttempts({ maxAttempts: 0 }, false);
		expect(unlimited).toBeNull();
		expect(attemptFeedbackVisible({ showFeedback: false, maxAttempts: unlimited, attempts: 0, adaptive: false })).toBe(false);
		expect(attemptFeedbackVisible({ showFeedback: false, maxAttempts: unlimited, attempts: 1, adaptive: false })).toBe(true);
	});

	test('showFeedback alone is visible before the first attempt (a difference from session info)', () => {
		expect(attemptFeedbackVisible({ showFeedback: true, maxAttempts: 1, attempts: 0, adaptive: false })).toBe(true);
	});

	test('an adaptive item shows feedback before any attempt, even against a single authored attempt', () => {
		expect(attemptFeedbackVisible({ showFeedback: false, maxAttempts: 1, attempts: 0, adaptive: true })).toBe(true);
	});
});

/**
 * The session-info rule's answers (`ItemSessionController.shouldShowFeedback`),
 * expected values written out per (showFeedback, maxAttempts) column over the live
 * recorded attempt counts 0, 1, 2, 3. `adaptive` is not an input here: the
 * controller sees settings, never item XML.
 */
const SESSION_INFO_EXPECTED: Record<string, Record<number, boolean[]>> = {
	off: { 1: [false, false, false, false], 2: [false, true, false, false], 0: [false, true, true, true] },
	// showFeedback on still waits for the first submission.
	on: { 1: [false, true, true, true], 2: [false, true, true, true], 0: [false, true, true, true] },
};

describe('shouldShowFeedback — the session-info rule (getItemSessionInfo().showFeedback)', () => {
	test('showFeedback x maxAttempts (1, 2, unlimited) x attempts', () => {
		for (const [feedbackKey, showFeedback] of [
			['off', false],
			['on', true],
		] as const) {
			for (const maxAttempts of AUTHORED_MAX) {
				for (const [index, attempts] of ATTEMPTS.entries()) {
					const controller = new ItemSessionController({ showFeedback, maxAttempts });
					controller.initializeItem('q1');
					for (let recorded = 0; recorded < attempts; recorded += 1) controller.recordAttempt('q1');
					expect(controller.shouldShowFeedback('q1')).toBe(SESSION_INFO_EXPECTED[feedbackKey]![maxAttempts]![index]);
				}
			}
		}
	});

	test('before the first attempt it stays false even when showFeedback is on', () => {
		// The presentation rule answers true for the same state — that difference is the
		// point: session info describes what is visible now, and nothing is yet.
		const controller = new ItemSessionController({ showFeedback: true, maxAttempts: 1 });
		controller.initializeItem('q1');
		expect(controller.shouldShowFeedback('q1')).toBe(false);
	});

	test('an adaptive item is unlimited only through its resolved settings', () => {
		// Authored control (maxAttempts 2, feedback off) before the cascade: the live
		// presentation rule already answers true for the adaptive item at zero attempts,
		// the session-info rule only after the resolved settings zero its maxAttempts.
		const authored = new ItemSessionController({ showFeedback: false, maxAttempts: 2 });
		authored.initializeItem('q1');
		expect(authored.shouldShowFeedback('q1')).toBe(false);

		const resolved = new ItemSessionController({ showFeedback: false, maxAttempts: 0 });
		resolved.initializeItem('q1');
		expect(resolved.shouldShowFeedback('q1')).toBe(false);
		resolved.recordAttempt('q1');
		expect(resolved.shouldShowFeedback('q1')).toBe(true);

		expect(
			attemptFeedbackVisible({
				showFeedback: false,
				maxAttempts: resolveMaxAttempts({ maxAttempts: 2 }, true),
				attempts: 0,
				adaptive: true,
			}),
		).toBe(true);
	});
});
