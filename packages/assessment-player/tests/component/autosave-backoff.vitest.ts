/**
 * Autosave failure backoff (UX6), under vitest fake timers: a failed save retries on
 * its own with a bounded backoff (2s, 8s, 30s) instead of waiting for the candidate's
 * next change, stops on success, and gives up (until the next change) after the last
 * attempt.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AutosaveManager } from '../../src/core/AutosaveManager.js';

function makeManager(save: ReturnType<typeof vi.fn>, retryDelaysMs = [2_000, 8_000, 30_000]) {
	return new AutosaveManager({
		enabled: true,
		intervalMs: 1_000,
		collect: () => ({ sessionId: 's1', state: {} }),
		save: save as unknown as (request: { sessionId: string; state: unknown }) => Promise<{ success: boolean }>,
		isBlocked: () => false,
		isStopped: () => false,
		onStateChange: () => {},
		onError: () => {},
		retryDelaysMs,
	});
}

describe('autosave backoff', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	test('a failed save retries with the bounded backoff and recovers', async () => {
		const save = vi.fn()
			.mockRejectedValueOnce(new Error('backend down'))
			.mockRejectedValueOnce(new Error('still down'))
			.mockResolvedValueOnce({ success: true });
		const manager = makeManager(save);

		manager.notify();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(save).toHaveBeenCalledTimes(1);

		// First backoff attempt after 2s, second after a further 8s.
		await vi.advanceTimersByTimeAsync(2_000);
		expect(save).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(8_000);
		expect(save).toHaveBeenCalledTimes(3);

		// The success resets the backoff: no further attempts fire.
		await vi.advanceTimersByTimeAsync(30_000);
		expect(save).toHaveBeenCalledTimes(3);
		expect(manager.getState().status).toBe('saved');
	});

	test('after the last attempt it waits for the next change instead of retrying forever', async () => {
		const save = vi.fn().mockRejectedValue(new Error('backend down'));
		const manager = makeManager(save, [100, 200]);

		manager.notify();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(save).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(100);
		expect(save).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(200);
		expect(save).toHaveBeenCalledTimes(3);
		// Both backoff attempts spent: time alone triggers nothing more.
		await vi.advanceTimersByTimeAsync(60_000);
		expect(save).toHaveBeenCalledTimes(3);
		expect(manager.getState().status).toBe('failed');

		// The next candidate change starts a fresh cycle.
		manager.notify();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(save).toHaveBeenCalledTimes(4);
	});

	test('stop() cancels a pending backoff retry', async () => {
		const save = vi.fn().mockRejectedValue(new Error('backend down'));
		const manager = makeManager(save, [100]);

		manager.notify();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(save).toHaveBeenCalledTimes(1);
		manager.stop();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(save).toHaveBeenCalledTimes(1);
	});
});
