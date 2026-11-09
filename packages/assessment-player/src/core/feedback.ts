/**
 * QTI attempt-relative feedback visibility.
 *
 * QTI is attempt-relative here: with more than one attempt allowed (or unlimited
 * attempts, adaptive items), feedback for every non-final attempt must be shown; once
 * the last attempt has ended, `itemSessionControl@showFeedback` governs. An adaptive
 * item always shows its feedback.
 *
 * Two rules in the player apply this shape and feed different outputs, and they differ
 * on purpose (see the table test in `tests/feedback-visibility.test.ts`):
 *
 * 1. `AssessmentPlayer.feedbackVisible` — the live item session's presentation policy
 *    and the shell's captured item feedback. This is the semantics these helpers
 *    implement: an adaptive item (read from the item XML) or `showFeedback` shows
 *    feedback whatever the attempts have done so far, and the caller judges a
 *    *projected* attempt count (`attemptsAfter`: the counted attempts once the attempt
 *    being judged has ended). Unlimited attempts are represented as `null` maxAttempts.
 * 2. `ItemSessionController.shouldShowFeedback` — `getItemSessionInfo().showFeedback`.
 *    It keeps its own wrapper: nothing is visible before the item's first submission,
 *    the count is the *live* recorded count, and an adaptive item is unlimited only
 *    through its resolved settings (`resolveItemSessionControl` zeroes `maxAttempts`),
 *    because the session controller sees settings, never item XML.
 */

import type { ItemSessionControlSettings } from './ItemSessionController.js';

/**
 * The item's maximum attempts for the attempt-relative rules: null when unlimited —
 * an adaptive item, or an authored `maxAttempts` of 0 — otherwise at least 1.
 */
export function resolveMaxAttempts(
	settings: Pick<ItemSessionControlSettings, 'maxAttempts'> | undefined,
	adaptive: boolean,
): number | null {
	if (adaptive) return null;
	const maxAttempts = settings?.maxAttempts ?? 1;
	return maxAttempts === 0 ? null : Math.max(1, maxAttempts);
}

export interface AttemptFeedbackVisibility {
	/** The item's `itemSessionControl@showFeedback`. */
	showFeedback: boolean | undefined;
	/** From `resolveMaxAttempts`; null when unlimited. */
	maxAttempts: number | null;
	/** The counted attempts of the state being judged. */
	attempts: number;
	/** The item root declares `adaptive="true"`. */
	adaptive: boolean;
}

/**
 * QTI feedback visibility for a submission's or a presentation's attempt state:
 * an adaptive item or `showFeedback` shows feedback whatever the attempts; otherwise
 * a non-final attempt does (`attempts` below the maximum, or unlimited) and a final
 * or single attempt does not.
 */
export function attemptFeedbackVisible({ showFeedback, maxAttempts, attempts, adaptive }: AttemptFeedbackVisibility): boolean {
	if (adaptive || showFeedback === true) return true;
	if (attempts < 1) return false;
	return maxAttempts === null || (maxAttempts > 1 && attempts < maxAttempts);
}
