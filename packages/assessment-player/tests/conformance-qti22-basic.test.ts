/**
 * QTI 2.2 Basic DELIVERY — assessment-level conformance tests
 *
 * Tests T4/T7 test structure (testPart + section) and T14 state persistence
 * (record and restore responses) against a minimal internal assessment that
 * mirrors the structure of the official T4+T7 conformance package.
 *
 * Acceptance criteria covered:
 *   T4-L1-D1  one assessmentTest element
 *   T4-L1-D2  one testPart, navigationMode=linear, submissionMode=individual
 *   T7-L1-D1  one visible section
 *   T7-L1-D2  four items (choice single, choice multiple, textEntry, extendedText)
 *   T14-L1-D1 responses saved and correctly restored after session restart
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import type { AssessmentScoringResult, AssessmentSessionState, SecureAssessment } from '../src/integration/api-contract.js';

// DOM stubs are provided by packages/assessment-player/tests/setup.ts (preloaded
// when running tests within this package). When running `bun test` from the repo
// root, ReferenceBackendAdapter.spec.ts (which loads first alphabetically) sets
// the same stubs, so no inline setup is needed here.

// -------------------------------------------------------------------------
// Minimal internal assessment matching T4+T7 structure.
// Four items: choice-single, choice-multiple, textEntry, extendedText.
// navigationMode=linear, submissionMode=individual (T4-L1-D2).
// -------------------------------------------------------------------------
const CHOICE_SINGLE_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-choice-single" title="Choice Single" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <simpleChoice identifier="A">A</simpleChoice>
    <simpleChoice identifier="B">B</simpleChoice>
  </choiceInteraction></itemBody>
</assessmentItem>`;

const CHOICE_MULTIPLE_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-choice-multiple" title="Choice Multiple" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="3">
    <simpleChoice identifier="A">A</simpleChoice>
    <simpleChoice identifier="B">B</simpleChoice>
    <simpleChoice identifier="C">C</simpleChoice>
  </choiceInteraction></itemBody>
</assessmentItem>`;

const TEXT_ENTRY_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-text-entry" title="Text Entry" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody><p>The cow <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15"/> over the moon.</p></itemBody>
</assessmentItem>`;

const EXTENDED_TEXT_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-extended-text" title="Extended Text" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody><extendedTextInteraction responseIdentifier="RESPONSE" expectedLength="200">
    <prompt>Write a haiku about autumn.</prompt>
  </extendedTextInteraction></itemBody>
</assessmentItem>`;

const T4_T7_ASSESSMENT: SecureAssessment = {
	identifier: 'qti22-basic-t4-t7',
	title: 'QTI 2.2 Basic T4 and T7 Test Structures',
	navigationMode: 'linear',
	submissionMode: 'individual',
	testParts: [
		{
			identifier: 'part1',
			sections: [
				{
					identifier: 'section1',
					title: 'Section 1',
					visible: true,
					assessmentItemRefs: [
						{ identifier: 'item-choice-single', role: 'candidate', itemXml: CHOICE_SINGLE_XML },
						{ identifier: 'item-choice-multiple', role: 'candidate', itemXml: CHOICE_MULTIPLE_XML },
						{ identifier: 'item-text-entry', role: 'candidate', itemXml: TEXT_ENTRY_XML },
						{ identifier: 'item-extended-text', role: 'candidate', itemXml: EXTENDED_TEXT_XML },
					],
				},
			],
		},
	],
};

const LIMITED_ATTEMPTS_ASSESSMENT: SecureAssessment = {
	...T4_T7_ASSESSMENT,
	identifier: 'qti22-basic-item-session-control',
	testParts: [
		{
			...T4_T7_ASSESSMENT.testParts[0],
			itemSessionControl: {
				maxAttempts: 1,
				showFeedback: true,
				allowReview: false,
			},
		},
	],
};

const SUBMITTED_SCORE: AssessmentScoringResult = {
	itemIdentifier: 'item-choice-single',
	score: 1,
	maxScore: 1,
	completed: true,
	outcomeValues: { SCORE: 1 },
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function makeAdapter(): ReferenceBackendAdapter {
	localStorage.clear();
	const adapter = new ReferenceBackendAdapter();
	adapter.registerAssessment(T4_T7_ASSESSMENT.identifier, T4_T7_ASSESSMENT);
	return adapter;
}

function makeLimitedAttemptsAdapter(): ReferenceBackendAdapter {
	localStorage.clear();
	const adapter = new ReferenceBackendAdapter();
	adapter.registerAssessment(LIMITED_ATTEMPTS_ASSESSMENT.identifier, LIMITED_ATTEMPTS_ASSESSMENT);
	return adapter;
}

async function createPlayer(): Promise<AssessmentPlayer> {
	const adapter = makeAdapter();
	const player = await AssessmentPlayer.create({
		backend: adapter,
		initSession: {
			assessmentId: T4_T7_ASSESSMENT.identifier,
			candidateId: 'test-candidate',
		},
	});
	// The constructor fires navigateTo(startId) as fire-and-forget. Await it
	// explicitly so that currentItemIndex is set before our tests run.
	await player.navigateTo(0);
	return player;
}

async function createLimitedAttemptsPlayer(): Promise<AssessmentPlayer> {
	const adapter = makeLimitedAttemptsAdapter();
	const player = await AssessmentPlayer.create({
		backend: adapter,
		initSession: {
			assessmentId: LIMITED_ATTEMPTS_ASSESSMENT.identifier,
			candidateId: 'test-candidate',
		},
	});
	await player.navigateTo(0);
	return player;
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe('T4-L1-D1: one assessmentTest element', () => {
	it('assessment loads with correct identifier and title', async () => {
		const player = await createPlayer();
		const nav = player.getNavigationState();
		expect(nav).toBeDefined();
		expect(nav.totalItems).toBe(4);
	});
});

describe('T4-L1-D2: navigationMode=linear, submissionMode=individual', () => {
	it('navigation mode is linear — cannot skip ahead', async () => {
		const player = await createPlayer();
		// In linear mode, jumping to item 2 (skipping item 1) should fail
		await expect(player.navigateTo(2)).rejects.toThrow(/linear/i);
	});

	it('sequential navigation succeeds', async () => {
		const player = await createPlayer();
		// Start at item 0 — navigate to 1 should work
		await player.navigateTo(1);
		const state = player.getNavigationState();
		expect(state.currentIndex).toBe(1);
		expect(state.canPrevious).toBe(false);
		await expect(player.navigateTo(0)).rejects.toThrow(/navigation is not allowed/i);
	});
});

describe('T7-L1-D1: one visible section', () => {
	it('first section is visible', async () => {
		const player = await createPlayer();
		const assessment = (player as any).assessment as SecureAssessment;
		const section = assessment.testParts[0].sections[0];
		expect(section.visible).toBe(true);
	});
});

describe('T7-L1-D2: four items in section', () => {
	it('section contains 4 assessmentItemRefs', async () => {
		const player = await createPlayer();
		const assessment = (player as any).assessment as SecureAssessment;
		const refs = assessment.testParts[0].sections[0].assessmentItemRefs;
		expect(refs).toHaveLength(4);
	});

	it('items include choice-single, choice-multiple, text-entry, extended-text', async () => {
		const player = await createPlayer();
		const assessment = (player as any).assessment as SecureAssessment;
		const ids = assessment.testParts[0].sections[0].assessmentItemRefs.map((r) => r.identifier);
		expect(ids).toContain('item-choice-single');
		expect(ids).toContain('item-choice-multiple');
		expect(ids).toContain('item-text-entry');
		expect(ids).toContain('item-extended-text');
	});
});

describe('T14-L1-D1: record and restore responses', () => {
	it('responses saved on updateResponse are present in getState()', async () => {
		const player = await createPlayer();
		// Submit a response on item 0
		player.updateResponse('RESPONSE', 'A');
		const state = player.getState();
		expect(state.itemResponses['item-choice-single']).toEqual({ RESPONSE: 'A' });
	});

	it('state restored in new player contains previous response', async () => {
		const adapter = makeAdapter();
		const player1 = await AssessmentPlayer.create({
			backend: adapter,
			initSession: { assessmentId: T4_T7_ASSESSMENT.identifier, candidateId: 'test-candidate' },
		});
		await player1.navigateTo(0);

		// Record a response on item 0
		player1.updateResponse('RESPONSE', 'A');
		const savedState = player1.getState();

		// Create a second player and restore the state
		const player2 = await AssessmentPlayer.create({
			backend: adapter,
			initSession: { assessmentId: T4_T7_ASSESSMENT.identifier, candidateId: 'test-candidate' },
		});
		await player2.navigateTo(0);
		await player2.restoreState(savedState);

		const restored = player2.getState();
		expect(restored.itemResponses['item-choice-single']).toEqual({ RESPONSE: 'A' });
		expect(restored.currentItemIdentifier).toBe(savedState.currentItemIdentifier);
	});

	it('responses for multiple items are all preserved', async () => {
		const player = await createPlayer();

		// Respond to item 0
		player.updateResponse('RESPONSE', 'A');
		// Navigate to item 1 and respond
		await player.next();
		player.updateResponse('RESPONSE', ['A', 'B']);

		const state = player.getState();
		expect(state.itemResponses['item-choice-single']).toEqual({ RESPONSE: 'A' });
		expect(state.itemResponses['item-choice-multiple']).toEqual({ RESPONSE: ['A', 'B'] });
	});
});

describe('ItemSession restore hints', () => {
	function submittedState(overrides: Partial<AssessmentSessionState> = {}): AssessmentSessionState {
		return {
			currentItemIdentifier: 'item-choice-single',
			visitedItems: ['item-choice-single'],
			itemResponses: {
				'item-choice-single': { RESPONSE: 'A' },
			},
			itemScores: {
				'item-choice-single': SUBMITTED_SCORE,
			},
			timing: {
				startedAt: Date.now(),
				itemTimes: {},
				totalTime: 0,
			},
			...overrides,
		};
	}

	it('restores persisted ItemSession attempt and review state', async () => {
		const player = await createLimitedAttemptsPlayer();
		await player.restoreState(
			submittedState({
				itemSessionStates: {
					'item-choice-single': {
						itemIdentifier: 'item-choice-single',
						attemptCount: 1,
						isAnswered: true,
						isSubmitted: true,
						lastSubmissionTime: 123,
					},
				},
			})
		);

		const info = player.getItemSessionInfo();
		expect(info?.attemptCount).toBe(1);
		expect(info?.remainingAttempts).toBe(0);
		expect(info?.canSubmit).toBe(false);
		expect(info?.showFeedback).toBe(true);
		expect(info?.canReview).toBe(false);
		expect(player.getState().itemSessionStates?.['item-choice-single']?.lastSubmissionTime).toBe(123);
	});

	it('derives submitted ItemSession state from legacy scores when no snapshot exists', async () => {
		const player = await createLimitedAttemptsPlayer();
		await player.restoreState(submittedState());

		const info = player.getItemSessionInfo();
		expect(info?.attemptCount).toBe(1);
		expect(info?.remainingAttempts).toBe(0);
		expect(info?.canSubmit).toBe(false);
		expect(info?.showFeedback).toBe(true);
	});
});
