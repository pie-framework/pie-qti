/**
 * End-of-test collection in individual submission parts (S1).
 *
 * Only `performNext` submits on the move: a nonlinear jump (`navigateTo`, `previous`)
 * away from an answered item leaves it unsubmitted. Finalize must still collect every
 * visited individual-mode item whose live responses were never accepted — through the
 * same detached end-attempt path the simultaneous collection uses — while unchanged
 * responses (a practice item moved on as answered) never spend a second attempt.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SubmitResponsesRequest } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="1"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function fixture(itemSessionControl?: SecureAssessment['testParts'][number]['itemSessionControl']) {
	const assessment: SecureAssessment = {
		identifier: 'finalize-collect',
		title: 'Nonlinear individual collection',
		navigationMode: 'nonlinear',
		submissionMode: 'individual',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'individual',
				...(itemSessionControl ? { itemSessionControl } : {}),
				sections: [
					{
						identifier: 'section-1',
						visible: true,
						assessmentItemRefs: ['item-1', 'item-2', 'item-3'].map((identifier) => ({
							identifier,
							role: 'candidate' as const,
							itemXml: choiceItem(identifier),
						})),
					},
				],
			},
		],
	};
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const calls: SubmitResponsesRequest[] = [];
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		calls.push(structuredClone(request));
		return submit(request);
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
	});
	players.push(player);
	return {
		player,
		backend,
		calls,
		submittedIds: () => calls.map((call) => call.itemIdentifier),
	};
}

describe('finalize collects unsubmitted individual items', () => {
	it('collects an answered item the candidate jumped away from', async () => {
		const { player, calls, submittedIds } = await fixture();

		// Answer question 3, then jump back to question 1 without any forward submission.
		await player.navigateTo(2);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(0);
		expect(submittedIds()).toEqual([]);

		const results = await player.submit();
		expect(submittedIds()).toContain('item-3');
		const collected = calls.find((call) => call.itemIdentifier === 'item-3');
		expect(collected?.responses).toEqual({ RESPONSE: 'A' });
		// Item 3 is scored from its answer, not from a NULL response.
		const itemResult = results.itemResults.find((result) => result.itemIdentifier === 'item-3');
		expect(itemResult?.score).toBe(1);
	});

	it('does not re-submit an unchanged practice answer at finalize', async () => {
		// A practice part: two attempts, feedback on. The candidate checks the answer
		// (one counted submission), jumps away and submits the test.
		const { player, calls } = await fixture({
			maxAttempts: 2,
			showFeedback: true,
			allowReview: true,
		});
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(player.getCheckAnswerState()).toMatchObject({ attemptsUsed: 1 });
		await player.navigateTo(1);
		await player.submit();

		const itemSubmissions = calls.filter((call) => call.itemIdentifier === 'item-1');
		// Exactly the check-answer submission: finalize did not spend a second attempt
		// on identical responses.
		expect(itemSubmissions).toHaveLength(1);
	});

	it('collects a revised answer a nonlinear jump left behind', async () => {
		// A practice check recorded the response; the candidate then revised it and jumped
		// away without re-checking. Finalize must submit the revision, not keep the stale
		// recorded one.
		const { player, calls } = await fixture({
			maxAttempts: 2,
			showFeedback: true,
			allowReview: true,
		});
		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		expect(calls.filter((call) => call.itemIdentifier === 'item-1')).toHaveLength(1);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(1);

		const results = await player.submit();
		const revisions = calls.filter((call) => call.itemIdentifier === 'item-1');
		expect(revisions).toHaveLength(2);
		expect(revisions[1]?.responses).toEqual({ RESPONSE: 'A' });
		const itemResult = results.itemResults.find((result) => result.itemIdentifier === 'item-1');
		expect(itemResult?.score).toBe(1);
	});

	it('a resumed session does not re-spend an attempt on identical responses', async () => {
		// Check a practice item, persist the snapshot, then resume it in a fresh player:
		// next() moves on without submitting the unchanged answer again.
		const { player, backend, calls } = await fixture({
			maxAttempts: 2,
			showFeedback: true,
			allowReview: true,
		});
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		await player.flushAutosave();
		const resumeId = backend.latestSessionId('finalize-collect', 'candidate');
		expect(resumeId).toBeTruthy();
		const submissionsBefore = calls.filter((call) => call.itemIdentifier === 'item-1').length;
		player.destroy();

		const resumed = await AssessmentPlayer.create({
			backend,
			initSession: {
				assessmentId: 'finalize-collect',
				candidateId: 'candidate',
				resumeSessionId: resumeId!,
			},
		});
		players.push(resumed);
		expect(resumed.getCurrentItem()?.identifier).toBe('item-1');

		await resumed.next();
		const submissionsAfter = calls.filter((call) => call.itemIdentifier === 'item-1').length;
		expect(submissionsAfter).toBe(submissionsBefore);
		expect(resumed.getNavigationState().currentIndex).toBe(1);
	});
});
