/**
 * The shell's connection composable must not adopt a player whose creation
 * resolved after a teardown (unmount or retry): `teardown()`/`destroy()` can only
 * destroy `state.player`, which is still null while `AssessmentPlayer.create()` is
 * in flight, so the resolved player used to be assigned, wired and never destroyed —
 * its TimeManager interval ticking forever. The teardown generation guard destroys
 * such a stale player exactly once and keeps `state.player` null.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { AssessmentPlayer } from '../../src/core/AssessmentPlayer.js';
import type { BackendAdapter, InitSessionRequest } from '../../src/integration/api-contract.js';
import { createPlayerConnection } from '../../src/components/createPlayerConnection.svelte.js';

/**
 * A minimal stand-in for the created player: stale adoption is the path under test,
 * and the fake records exactly what the guard must (and must only) do to it. A live
 * adoption (the non-stale control) ends at `isFinalized()` so no event wiring runs.
 */
function fakePlayer() {
	return {
		hasStarted: vi.fn(() => false),
		isFinalized: vi.fn(() => true),
		destroy: vi.fn(),
	};
}

function connection(inputs: { backend: BackendAdapter; initSession: InitSessionRequest }, onSessionCreated: () => void) {
	return createPlayerConnection({
		inputs: () => ({
			...inputs,
			config: {},
			beginGate: false,
			autosave: undefined,
			autosaveIntervalMs: undefined,
		}),
		i18nProvider: { t: (key: string) => key } as never,
		localizeError: (err: unknown) => ({ message: String(err), supportCode: null }),
		announce: () => {},
		onPlayerError: () => {},
		onSessionCreated,
		onSessionLive: async () => {},
		handlers: {
			onItemChange: () => {},
			onSectionChange: () => {},
			onTestFeedbackChange: () => {},
			onResponseChange: () => {},
			onBusyChange: () => {},
			onFlagChange: () => {},
			onAutosaveChange: () => {},
			onComplete: () => {},
			onTimeExpired: () => {},
			onScopeTimeExpired: () => {},
			onPauseChange: () => {},
		},
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('creation staleness', () => {
	test('a player resolving after destroy() is destroyed exactly once and never adopted', async () => {
		const created = fakePlayer();
		let resolveCreate: (player: AssessmentPlayer) => void = () => {};
		vi.spyOn(AssessmentPlayer, 'create').mockImplementation(
			() => new Promise<AssessmentPlayer>((resolve) => (resolveCreate = resolve)),
		);

		const onSessionCreated = vi.fn();
		const conn = connection(
			{ backend: {} as BackendAdapter, initSession: { assessmentId: 'stale', candidateId: 'c' } },
			onSessionCreated,
		);

		const initializing = conn.initialize();
		expect(conn.state.initializing).toBe(true);

		// The shell unmounts while creation is in flight: state.player is still null.
		conn.destroy();
		resolveCreate(created as unknown as AssessmentPlayer);
		await initializing;

		expect(created.destroy).toHaveBeenCalledTimes(1);
		expect(conn.state.player).toBeNull();
		expect(onSessionCreated).not.toHaveBeenCalled();
		expect(conn.state.error).toBeNull();
		expect(conn.state.initializing).toBe(false);
	});

	test('a teardown (retry) during flight also voids the resolved player', async () => {
		const created = fakePlayer();
		let resolveCreate: (player: AssessmentPlayer) => void = () => {};
		vi.spyOn(AssessmentPlayer, 'create').mockImplementation(
			() => new Promise<AssessmentPlayer>((resolve) => (resolveCreate = resolve)),
		);

		const onSessionCreated = vi.fn();
		const conn = connection(
			{ backend: {} as BackendAdapter, initSession: { assessmentId: 'stale', candidateId: 'c' } },
			onSessionCreated,
		);

		const initializing = conn.initialize();
		conn.teardown();
		resolveCreate(created as unknown as AssessmentPlayer);
		await initializing;

		expect(created.destroy).toHaveBeenCalledTimes(1);
		expect(conn.state.player).toBeNull();
		expect(onSessionCreated).not.toHaveBeenCalled();
	});

	test('an unstale creation is adopted as before', async () => {
		const created = fakePlayer();
		vi.spyOn(AssessmentPlayer, 'create').mockResolvedValue(created as unknown as AssessmentPlayer);

		const onSessionCreated = vi.fn();
		const conn = connection(
			{ backend: {} as BackendAdapter, initSession: { assessmentId: 'live', candidateId: 'c' } },
			onSessionCreated,
		);

		await conn.initialize();

		expect(created.destroy).not.toHaveBeenCalled();
		// ($state stores the player behind a reactive proxy, so the adoption is
		// asserted through the session-created callback and a non-null player.)
		expect(conn.state.player).not.toBeNull();
		expect(onSessionCreated).toHaveBeenCalledWith(created);
	});
});
