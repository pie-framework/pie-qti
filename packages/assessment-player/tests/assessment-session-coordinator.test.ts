import { describe, expect, it } from 'bun:test';
import type { SerializedItemSessionState } from '@pie-qti/item-player';
import { AssessmentSessionCoordinator } from '../src/core/AssessmentSessionCoordinator.js';
import type { AssessmentSessionState } from '../src/integration/api-contract.js';

describe('AssessmentSessionCoordinator', () => {
	it('records active and explicit item responses independently', () => {
		const coordinator = createCoordinator();

		coordinator.activateItem('item-1');
		coordinator.updateActiveResponse('RESPONSE', 'A');
		coordinator.updateResponseForItem('item-2', 'RESPONSE', ['B', 'C']);

		expect(coordinator.getActiveResponses()).toEqual({ RESPONSE: 'A' });
		expect(coordinator.getResponses('item-2')).toEqual({ RESPONSE: ['B', 'C'] });
		expect(coordinator.snapshot().itemResponses).toEqual({
			'item-1': { RESPONSE: 'A' },
			'item-2': { RESPONSE: ['B', 'C'] },
		});
	});

	it('saves rich item sessions only when requested in snapshots', () => {
		const coordinator = createCoordinator();
		const itemSession = fakeItemSession('suspended');

		coordinator.saveItemSession('item-1', { RESPONSE: 'A' }, itemSession, 1200);

		const defaultSnapshot = coordinator.snapshot();
		const fullSnapshot = coordinator.snapshot({ includeItemSessions: true });

		expect(defaultSnapshot.itemSessions).toBeUndefined();
		expect(fullSnapshot.itemSessions?.['item-1']).toBe(itemSession);
		expect(fullSnapshot.itemResponses['item-1']).toEqual({ RESPONSE: 'A' });
		expect(fullSnapshot.timing.itemTimes['item-1']).toBe(1200);
		expect(fullSnapshot.itemSessionStates?.['item-1']?.isAnswered).toBe(true);
	});

	it('restores persisted item-session state before legacy score fallback', () => {
		const coordinator = createCoordinator({
			itemScores: {
				'item-1': {
					itemIdentifier: 'item-1',
					score: 1,
					maxScore: 1,
					completed: true,
					outcomeValues: { SCORE: 1 },
				},
			},
			itemSessionStates: {
				'item-1': {
					itemIdentifier: 'item-1',
					attemptCount: 3,
					isAnswered: true,
					isSubmitted: true,
					lastSubmissionTime: 123,
				},
			},
		});

		const info = coordinator.getItemSessionInfo('item-1');

		expect(info.attemptCount).toBe(3);
		expect(info.canSubmit).toBe(true);
		expect(coordinator.hasItemResult('item-1')).toBe(true);
		expect(coordinator.snapshot().itemSessionStates?.['item-1']?.lastSubmissionTime).toBe(123);
	});

	it('derives answered and submitted state from legacy scores when no item-session snapshot exists', () => {
		const coordinator = createCoordinator({
			itemResponses: { 'item-1': { RESPONSE: 'A' } },
			itemScores: {
				'item-1': {
					itemIdentifier: 'item-1',
					score: 1,
					maxScore: 1,
					completed: true,
					outcomeValues: { SCORE: 1 },
				},
			},
		});

		const state = coordinator.snapshot().itemSessionStates?.['item-1'];

		expect(state?.attemptCount).toBe(1);
		expect(state?.isAnswered).toBe(true);
		expect(state?.isSubmitted).toBe(true);
	});
});

function createCoordinator(state: Partial<AssessmentSessionState> = {}) {
	return new AssessmentSessionCoordinator({
		state: createState(state),
		itemIdentifiers: ['item-1', 'item-2'],
		itemSessionControl: { maxAttempts: 0, allowSkipping: true },
	});
}

function createState(state: Partial<AssessmentSessionState> = {}): AssessmentSessionState {
	return {
		currentItemIdentifier: 'item-1',
		visitedItems: [],
		itemResponses: {},
		itemScores: {},
		itemSessions: {},
		timing: {
			startedAt: 1,
			itemTimes: {},
			totalTime: 0,
		},
		...state,
		timing: {
			startedAt: 1,
			itemTimes: {},
			totalTime: 0,
			...state.timing,
		},
	};
}

function fakeItemSession(lifecycleStatus: string): SerializedItemSessionState {
	return {
		lifecycleStatus,
		duration: 0,
		responseVariables: {},
		outcomeVariables: {},
		templateVariables: {},
		contextVariables: {},
	} as unknown as SerializedItemSessionState;
}
