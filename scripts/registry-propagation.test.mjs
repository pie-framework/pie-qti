import { describe, expect, test } from 'bun:test';

import {
	backoffDelayMs,
	DEFAULT_PROPAGATION_POLICY,
	isPropagationError,
	planRetry,
	policyFromEnv,
} from './registry-propagation.mjs';

/** The E404 body npm printed for @pie-qti/ims-cp-core@0.1.25 on the 0.1.25 release. */
const E404 = `npm error code E404
npm error 404 No match found for version 0.1.25
npm error 404  The requested resource '@pie-qti/ims-cp-core@0.1.25' could not be found or you do not have permission to access it.`;

describe('isPropagationError', () => {
	test('recognises the replica-lag failures', () => {
		expect(isPropagationError(E404)).toBe(true);
		expect(isPropagationError('npm error code ETARGET')).toBe(true);
		expect(isPropagationError('No matching version found for @pie-qti/x@^0.1.25')).toBe(true);
	});

	test('leaves every other failure alone', () => {
		expect(isPropagationError('npm error code E403 Forbidden')).toBe(false);
		expect(isPropagationError('npm error code ENEEDAUTH')).toBe(false);
		expect(isPropagationError(undefined)).toBe(false);
	});
});

describe('backoffDelayMs', () => {
	test('doubles from the initial delay and caps', () => {
		expect(backoffDelayMs(1)).toBe(3_000);
		expect(backoffDelayMs(2)).toBe(6_000);
		expect(backoffDelayMs(3)).toBe(12_000);
		expect(backoffDelayMs(4)).toBe(24_000);
		expect(backoffDelayMs(5)).toBe(30_000);
		expect(backoffDelayMs(9)).toBe(30_000);
	});
});

describe('planRetry', () => {
	test('retries a fresh propagation failure', () => {
		expect(planRetry({ attempt: 1, elapsedMs: 0, message: E404 })).toEqual({
			retry: true,
			delayMs: 3_000,
			reason: null,
		});
	});

	test('does not retry an authorization failure', () => {
		const plan = planRetry({ attempt: 1, elapsedMs: 0, message: 'npm error code ENEEDAUTH' });
		expect(plan.retry).toBe(false);
		expect(plan.reason).toBe('not a propagation failure');
	});

	test('stops at maxAttempts', () => {
		const policy = { ...DEFAULT_PROPAGATION_POLICY, maxAttempts: 3 };
		expect(planRetry({ attempt: 2, elapsedMs: 0, message: E404, policy }).retry).toBe(true);
		const plan = planRetry({ attempt: 3, elapsedMs: 0, message: E404, policy });
		expect(plan.retry).toBe(false);
		expect(plan.reason).toContain('3 attempt(s)');
	});

	// The deadline is shared across packages: a genuinely unpublished release must not pay the
	// per-call budget once for each of the 27 packages in the fixed group.
	test('stops once the shared deadline would be overrun', () => {
		const policy = { ...DEFAULT_PROPAGATION_POLICY, deadlineMs: 10_000 };
		expect(planRetry({ attempt: 1, elapsedMs: 6_000, message: E404, policy }).retry).toBe(true);
		const plan = planRetry({ attempt: 1, elapsedMs: 8_000, message: E404, policy });
		expect(plan.retry).toBe(false);
		expect(plan.reason).toContain('deadline of 10s');
	});
});

describe('policyFromEnv', () => {
	test('widens the deadline from the environment', () => {
		expect(policyFromEnv({ PIE_REGISTRY_PROPAGATION_DEADLINE_SECONDS: '600' }).deadlineMs).toBe(600_000);
	});

	test('keeps the default for an absent or unusable value', () => {
		const { deadlineMs } = DEFAULT_PROPAGATION_POLICY;
		expect(policyFromEnv({}).deadlineMs).toBe(deadlineMs);
		expect(policyFromEnv({ PIE_REGISTRY_PROPAGATION_DEADLINE_SECONDS: 'soon' }).deadlineMs).toBe(deadlineMs);
		expect(policyFromEnv({ PIE_REGISTRY_PROPAGATION_DEADLINE_SECONDS: '-5' }).deadlineMs).toBe(deadlineMs);
	});
});
