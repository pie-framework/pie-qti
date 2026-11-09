/**
 * Phase 5 pinning test (player-cleanup plan, "Kept separate"): the client's
 * presented-items record (every item delivery has shown, kept for the review
 * screen's marks) and the backend contract's `state.visitedItems` (the items
 * whose submissions the backend accepted) are two different records. A backend
 * `updatedState` that lists only submitted items must not erase the presented
 * marks, and a backend position inside an `updatedState` must not move delivery.
 * Autosave is off: nothing round-trips a merged snapshot through the backend to
 * mask the distinction.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type {
	BackendAdapter,
	SecureAssessment,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from '../src/integration/api-contract.js';

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

const choiceItemXml = (identifier: string) =>
	`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="1"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

async function fixture() {
	const assessment: SecureAssessment = {
		identifier: 'presented-vs-visited',
		title: 'Presented vs visited',
		navigationMode: 'nonlinear',
		submissionMode: 'individual',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'individual',
				sections: [
					{
						identifier: 'section-1',
						visible: true,
						assessmentItemRefs: ['item-1', 'item-2', 'item-3'].map((identifier) => ({
							identifier,
							role: 'candidate' as const,
							itemXml: choiceItemXml(identifier),
						})),
					},
				],
			},
		],
	};
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const submittedIds: string[] = [];
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> => {
		submittedIds.push(request.itemIdentifier);
		const result = await submit(request);
		if (!result.updatedState) return result;
		return {
			...result,
			// A backend whose session state lists only what IT accepted as visited,
			// and whose stored position is stale (it never heard of the client's
			// navigation since).
			updatedState: {
				...result.updatedState,
				visitedItems: [...new Set(submittedIds)],
				currentItemIdentifier: 'item-1',
			},
		};
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		autosave: false,
	});
	players.push(player);
	expect(player.isAutosaveEnabled()).toBe(false);
	await player.navigateTo(0);
	return { player, assessment, backend, submittedIds };
}

describe('presented-items record vs state.visitedItems', () => {
	test('an updatedState listing only submitted items keeps the presented marks and never moves delivery', async () => {
		const { player } = await fixture();

		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// The submission was accepted, and the backend's visited list carries the
		// submitted item only. Delivery moved on to item-2 and presented it.
		expect(player.getState().currentItemIdentifier).toBe('item-2');
		expect(player.getState().visitedItems).toEqual(['item-1', 'item-2']);

		// The presented record survived the submitted-only backend list: item-2 is
		// marked visited without any submission of its own.
		expect(player.getState().visitedItems).toContain('item-2');
		// ...while the submission record stays submitted-only: item-2 has no score.
		expect(Object.keys(player.getState().itemScores ?? {})).toEqual(['item-1']);
	});

	test('a backend position inside an updatedState never moves delivery', async () => {
		const { player } = await fixture();

		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// The backend's updatedState claimed the position was still item-1; the
		// client's navigation decides where delivery stands.
		expect(player.getState().currentItemIdentifier).toBe('item-2');
		expect(player.getNavigationState().currentIndex).toBe(1);
	});

	test('the presented marks survive a host-driven save and restore (autosave off)', async () => {
		const { player, assessment } = await fixture();

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		// Present item-3 as well, without submitting anything more.
		await player.navigateTo(2);

		const snapshot = player.getState({ includeItemSessions: true });
		expect(snapshot.visitedItems).toEqual(['item-1', 'item-2', 'item-3']);

		// A host that persists state itself (autosave off) resumes from the snapshot.
		const backend: BackendAdapter = {
			async initSession() {
				return {
					sessionId: 'restored-session',
					assessment,
					restoredState: structuredClone(snapshot),
				};
			},
			async submitResponses() {
				return { success: true };
			},
			async saveState() {
				return { success: true, savedAt: Date.now() };
			},
			async finalizeAssessment() {
				return { success: true, totalScore: 0, maxScore: 0, itemScores: {}, finalizedAt: Date.now() };
			},
		};
		const restored = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
			autosave: false,
		});
		players.push(restored);

		// Delivery resumes where it was, the presented marks intact, the accepted
		// submission's state restored.
		expect(restored.getState().currentItemIdentifier).toBe('item-3');
		expect(restored.getState().visitedItems).toEqual(['item-1', 'item-2', 'item-3']);
		expect(restored.getState().itemSessionStates?.['item-1']?.attemptCount).toBe(1);
		expect(restored.hasRestoredProgress()).toBe(true);
		// The resumed item stays workable.
		restored.updateResponse('RESPONSE', 'B');
		expect(restored.getResponses()).toMatchObject({ RESPONSE: 'B' });
	});
});
