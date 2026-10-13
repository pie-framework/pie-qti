/**
 * Retry policy for registry reads that follow a publish in the same job.
 *
 * A version reaches its packument minutes after `changeset publish` reports it published: npm's
 * own `time` entries put @pie-qti/item-player 515s behind the first package on 0.1.26, and on
 * 0.1.25 `check-published-closure` got E404 for four packages that resolved minutes later. The
 * release had already gone out both times, so giving up early only reported it as failed.
 *
 * One bound: a shared `deadlineMs` measured from the first attempt of the run. It is shared
 * because versioning is fixed, so a genuinely unpublished release fails every package at once,
 * and a per-lookup budget would multiply the wait by the size of the group. Past the deadline the
 * remaining lookups get one attempt each. A five-attempt cap per lookup was dropped after it gave
 * each package 45 seconds and, with a 240s deadline, failed 0.1.26 on lag alone.
 *
 * Same policy as pie-players' scripts/lib/registry-propagation.mjs.
 */

export const DEFAULT_PROPAGATION_POLICY = Object.freeze({
	initialDelayMs: 3_000,
	maxDelayMs: 30_000,
	deadlineMs: 900_000,
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
 * sleeping. `reason` is set only when giving up, and says whether the failure was not lag at all
 * or npm never caught up within the deadline.
 */
export const planRetry = ({ attempt, elapsedMs, message, policy = DEFAULT_PROPAGATION_POLICY }) => {
	if (!isPropagationError(message)) {
		return { retry: false, delayMs: 0, reason: "not a propagation failure" };
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
