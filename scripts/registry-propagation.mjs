/**
 * Retry policy for registry reads that follow a publish in the same job.
 *
 * npm serves reads from replicas that lag the publish, so a version that was just published
 * 404s for a while: the 0.1.25 release published all 27 packages and `check-published-closure`
 * then got E404 for four of them, all resolvable minutes later. The release had already gone
 * out, so the failure only reported it as failed.
 *
 * Waiting is bounded twice over. Per call, `maxAttempts` with exponential backoff. Across the
 * run, one shared `deadlineMs` measured from the first attempt: without it a genuinely
 * unpublished package burns the full per-call budget once for every package in the fixed group.
 *
 * Same policy as pie-players' scripts/lib/registry-propagation.mjs.
 */

export const DEFAULT_PROPAGATION_POLICY = Object.freeze({
	maxAttempts: 5,
	initialDelayMs: 3_000,
	maxDelayMs: 30_000,
	deadlineMs: 240_000,
});

/** Lets a release run widen the wait without a code change when the registry is slow. */
export const policyFromEnv = (env = {}, base = DEFAULT_PROPAGATION_POLICY) => {
	const deadlineSeconds = Number.parseInt(env.PIE_REGISTRY_PROPAGATION_DEADLINE_SECONDS ?? "", 10);
	if (!Number.isFinite(deadlineSeconds) || deadlineSeconds < 0) return base;
	return Object.freeze({ ...base, deadlineMs: deadlineSeconds * 1_000 });
};

/** Exponential backoff, capped. `attempt` is 1-based: the delay *after* that attempt failed. */
export const backoffDelayMs = (attempt, policy = DEFAULT_PROPAGATION_POLICY) =>
	Math.min(policy.maxDelayMs, policy.initialDelayMs * 2 ** Math.max(0, attempt - 1));

/**
 * Whether a failure looks like the read side not having caught up yet.
 *
 * E404 is the missing version. ETARGET is the same lag seen through a range: npm resolved the
 * range against a packument that predates the publish. A stale *cached* packument produces
 * ETARGET too, which is why callers pass `--prefer-online`.
 */
export const isPropagationError = (message) => {
	const text = String(message ?? "");
	return (
		/\bE404\b/.test(text) ||
		/\bETARGET\b/.test(text) ||
		/No match found for version/i.test(text) ||
		/No matching version found for/i.test(text)
	);
};

/**
 * Decide what to do after a failed attempt. Pure: the caller supplies elapsed time and does the
 * sleeping. `reason` is set only when giving up, and names which bound was hit so a release log
 * distinguishes "npm never caught up" from "not published".
 */
export const planRetry = ({ attempt, elapsedMs, message, policy = DEFAULT_PROPAGATION_POLICY }) => {
	if (!isPropagationError(message)) {
		return { retry: false, delayMs: 0, reason: "not a propagation failure" };
	}
	if (attempt >= policy.maxAttempts) {
		return { retry: false, delayMs: 0, reason: `gave up after ${policy.maxAttempts} attempt(s)` };
	}

	const delayMs = backoffDelayMs(attempt, policy);
	if (elapsedMs + delayMs > policy.deadlineMs) {
		return {
			retry: false,
			delayMs: 0,
			reason: `propagation deadline of ${Math.round(policy.deadlineMs / 1_000)}s reached`,
		};
	}

	return { retry: true, delayMs, reason: null };
};
