/**
 * Pure helpers over serialized item sessions and response records.
 *
 * Moved out of `AssessmentPlayer.ts` verbatim (pure code motion): the player and
 * the session coordinator share them, and none of them takes the transition lock
 * or touches session state on its own.
 */

import type { SerializedItemSessionState } from '@pie-qti/item-player';
import type { ResponseDefault } from './AssessmentSessionCoordinator.js';
import type { ResponseValue } from '../integration/api-contract.js';

/**
 * The persisted response-record type (what backends receive and what snapshots
 * carry). Item sessions hold `unknown` values; every response the player persists
 * or submits passes through this one boundary. The runtime value is unchanged —
 * this single documented conversion replaces the scattered `as any` writes the
 * player used to make into session state.
 */
export function asResponseValues(responses: Record<string, unknown>): Record<string, ResponseValue> {
	return responses as Record<string, ResponseValue>;
}

export function cloneData<T>(value: T | undefined): T | undefined {
	return value === undefined ? undefined : structuredClone(value);
}

export function cloneResponseRecord(
	responses: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
	return structuredClone(responses) as Record<string, unknown>;
}

export function valuesFromItemSession(
	state: SerializedItemSessionState,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(state.responseVariables).map(([identifier, variable]) => [
			identifier,
			cloneData(variable.value),
		]),
	);
}

/**
 * Each response variable's declared default from a serialized session (QTI: a response
 * still equal to its default is no response — the `numberResponded` test). Variables
 * without a declared default carry none, so NULL/empty stays the only skipped shape.
 */
export function responseDefaultsOf(
	state: Pick<SerializedItemSessionState, 'responseVariables'>,
): Record<string, ResponseDefault> {
	const out: Record<string, ResponseDefault> = {};
	for (const [identifier, variable] of Object.entries(state.responseVariables)) {
		if (variable.defaultValue === null || variable.defaultValue === undefined) continue;
		out[identifier] = { value: variable.defaultValue, cardinality: variable.cardinality };
	}
	return out;
}

export function responseValuesEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		return left.every((value, index) => responseValuesEqual(value, right[index]));
	}
	if (!isRecord(left) || !isRecord(right)) return false;

	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	const rightKeySet = new Set(rightKeys);
	return leftKeys.every(
		(key) => rightKeySet.has(key) && responseValuesEqual(left[key], right[key]),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object';
}

export function isWritableItemLifecycle(lifecycleStatus: SerializedItemSessionState['lifecycleStatus']): boolean {
	return lifecycleStatus === 'initial' || lifecycleStatus === 'interacting';
}

/** A serialized item session as the end of the test leaves it: an open or suspended one is closed. */
export function closedItemSession(session: SerializedItemSessionState): SerializedItemSessionState {
	const open =
		session.lifecycleStatus === 'initial' ||
		session.lifecycleStatus === 'interacting' ||
		session.lifecycleStatus === 'suspended';
	return open ? { ...session, lifecycleStatus: 'closed' } : session;
}
