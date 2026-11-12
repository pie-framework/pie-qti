/**
 * Practice delivery: the item-level "Check answer" flow.
 *
 * In an individual submission-mode part whose resolved itemSessionControl@showFeedback is
 * on, `checkCurrentItem()` submits the item through the normal per-item path and stays on
 * it: the attempt counts, the backend records the result, item feedback is captured for the
 * shell (`getLastItemFeedback`), and — while attempts remain — a non-adaptive item reopens
 * writable with the computed outcomes restored so the candidate can revise and check again.
 * Simultaneous parts and showFeedback=false keep the submit-on-move delivery with no check
 * control (`getCheckAnswerState`).
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SecureItemRef, SubmitResponsesRequest } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/**
 * A choice item whose response processing computes SCORE and an identifier outcome that
 * drives two modal feedback blocks (correct/incorrect).
 */
const practiceItem = (identifier: string, control: SecureItemRef['itemSessionControl']): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemSessionControl: control,
	itemXml: `<assessmentItem ${NS} identifier="${identifier}" title="Practice ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
    <defaultValue><value>none</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>What is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">incorrect</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
  <modalFeedback identifier="correct" outcomeIdentifier="FEEDBACK" showHide="show"><p>Nice work.</p></modalFeedback>
  <modalFeedback identifier="incorrect" outcomeIdentifier="FEEDBACK" showHide="show"><p>Check your addition.</p></modalFeedback>
</assessmentItem>`,
});

const plainItem = (identifier: string): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml: `<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  </responseProcessing>
</assessmentItem>`,
});

const players: AssessmentPlayer[] = [];

afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function waitFor(condition: () => boolean, description: string): Promise<void> {
	const deadline = Date.now() + 2000;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

interface Fixture {
	player: AssessmentPlayer;
	submissions: SubmitResponsesRequest[];
	finalized: () => boolean;
}

async function fixture(
	submissionMode: 'individual' | 'simultaneous',
	items: SecureItemRef[],
): Promise<Fixture> {
	const assessment: SecureAssessment = {
		identifier: `check-${submissionMode}-${items.map((i) => i.identifier).join('-')}`,
		title: 'Check answer delivery',
		navigationMode: 'nonlinear',
		submissionMode,
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode,
				itemSessionControl: submissionMode === 'simultaneous' ? { showFeedback: true, maxAttempts: 2 } : undefined,
				sections: [{ identifier: 'section-1', visible: true, assessmentItemRefs: items }],
			},
		],
	};
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const submissions: SubmitResponsesRequest[] = [];
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		submissions.push(structuredClone(request));
		return submit(request);
	};
	let finalized = false;
	const finalize = backend.finalizeAssessment.bind(backend);
	backend.finalizeAssessment = async (request) => {
		finalized = true;
		return finalize(request);
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
	});
	players.push(player);
	await waitFor(() => player.getCurrentItemSession() !== null, 'the initial item session');
	return { player, submissions, finalized: () => finalized };
}

describe('getCheckAnswerState', () => {
	it('individual part with showFeedback and two attempts offers the control', async () => {
		const { player } = await fixture('individual', [practiceItem('p1', { showFeedback: true, maxAttempts: 2 })]);
		const state = player.getCheckAnswerState();
		expect(state?.available).toBe(true);
		expect(state?.reason).toBeNull();
		expect(state?.maxAttempts).toBe(2);
		expect(state?.remainingAttempts).toBe(2);
		expect(state?.attemptsUsed).toBe(0);
		expect(state?.attemptsExhausted).toBe(false);
	});

	it('a simultaneous part never offers the control', async () => {
		const { player } = await fixture('simultaneous', [practiceItem('p1', { showFeedback: true, maxAttempts: 2 })]);
		const state = player.getCheckAnswerState();
		expect(state?.available).toBe(false);
		expect(state?.reason).toBe('simultaneous');
	});

	it('showFeedback=false (and maxAttempts 1) keeps the submit-on-move delivery', async () => {
		const { player } = await fixture('individual', [plainItem('p1')]);
		const state = player.getCheckAnswerState();
		expect(state?.available).toBe(false);
		expect(state?.reason).toBe('feedbackOff');
	});

	it('showFeedback with a single attempt delivers feedback on the move, not through the control', async () => {
		const { player } = await fixture('individual', [practiceItem('p1', { showFeedback: true })]);
		const state = player.getCheckAnswerState();
		expect(state?.available).toBe(false);
		expect(state?.maxAttempts).toBe(1);
	});
});

describe('checkCurrentItem', () => {
	it('submits through the normal path, stays on the item, and captures item feedback', async () => {
		const { player, submissions } = await fixture('individual', [practiceItem('p1', { showFeedback: true, maxAttempts: 2 })]);
		player.updateResponse('RESPONSE', 'A');

		const result = await player.checkCurrentItem();

		expect(player.getNavigationState().currentIndex).toBe(0);
		expect(submissions).toHaveLength(1);
		expect(submissions[0]).toMatchObject({ itemIdentifier: 'p1', countAttempt: true });
		expect(result?.score).toBe(0);
		// The attempt counted and the result was recorded.
		expect(player.getCheckAnswerState()?.attemptsUsed).toBe(1);
		expect(player.getCheckAnswerState()?.remainingAttempts).toBe(1);
		expect(player.getState().itemScores?.['p1']?.score).toBe(0);
		// The item's modal feedback, matched by the computed outcome, is captured for the shell.
		const feedback = player.getLastItemFeedback();
		expect(feedback?.itemIdentifier).toBe('p1');
		expect(feedback?.feedback.map((entry) => entry.identifier)).toEqual(['incorrect']);
		expect(feedback?.feedback[0]?.content).toContain('Check your addition.');

		// The non-adaptive item reopened writable with the outcomes restored, so the
		// integrated feedback renders while the candidate revises.
		const session = player.getCurrentItemSession();
		expect(session?.state().lifecycleStatus).toBeOneOf(['initial', 'interacting']);
		expect(session?.state().outcomes.FEEDBACK).toBe('incorrect');
	});

	it('a revised answer checks again, and the exhausted attempts disable the control', async () => {
		const { player, submissions } = await fixture('individual', [
			practiceItem('p1', { showFeedback: true, maxAttempts: 2 }),
			plainItem('p2'),
		]);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();

		player.updateResponse('RESPONSE', 'B');
		const second = await player.checkCurrentItem();
		expect(second?.score).toBe(1);
		expect(submissions).toHaveLength(2);
		expect(player.getCheckAnswerState()?.attemptsExhausted).toBe(true);
		expect(player.getCheckAnswerState()?.remainingAttempts).toBe(0);
		// The last check's feedback replaced the first's.
		expect(player.getLastItemFeedback()?.feedback.map((entry) => entry.identifier)).toEqual(['correct']);

		// A third check is a coded rejection.
		await expect(player.checkCurrentItem()).rejects.toMatchObject({ code: 'maxAttemptsReached' });
		// The item stays closed once the attempts are gone (no pointless reopen).
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('closed');

		// Moving on needs no further submission: the recorded result stands.
		await player.next();
		expect(player.getNavigationState().currentIndex).toBe(1);
		expect(submissions).toHaveLength(2);
	});

	it('moving on after one check re-submits only when the answer changed', async () => {
		const { player, submissions } = await fixture('individual', [
			practiceItem('p1', { showFeedback: true, maxAttempts: 3 }),
			plainItem('p2'),
		]);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(submissions).toHaveLength(1);

		// Unchanged: the recorded result stands and no attempt is spent on the move.
		await player.next();
		expect(player.getNavigationState().currentIndex).toBe(1);
		expect(submissions).toHaveLength(1);

		// Back (nonlinear, allowReview default): revised, then the move carries the change.
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'B');
		await player.next();
		expect(submissions).toHaveLength(2);
		expect(submissions[1]).toMatchObject({ itemIdentifier: 'p1', responses: { RESPONSE: 'B' } });
		expect(player.getState().itemScores?.['p1']?.score).toBe(1);
	});

	it('a revisited practice item stays re-attemptable after moving on unchanged', async () => {
		const { player, submissions } = await fixture('individual', [
			practiceItem('p1', { showFeedback: true, maxAttempts: 2 }),
			plainItem('p2'),
		]);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		await player.next();

		// Back to the checked item (allowReview default): it reopens attemptable, not closed.
		await player.navigateTo(0);
		const session = player.getCurrentItemSession();
		expect(session?.state().lifecycleStatus).toBeOneOf(['initial', 'interacting']);
		expect(player.getCheckAnswerState()).toMatchObject({
			available: true,
			attemptsUsed: 1,
			remainingAttempts: 1,
		});
		// The recorded result survived the handoff; a check spends the second attempt.
		expect(player.getState().itemScores?.['p1']?.score).toBe(0);
		await player.checkCurrentItem();
		expect(submissions).toHaveLength(2);
		expect(player.getCheckAnswerState()?.attemptsExhausted).toBe(true);
	});

	it('submit() re-submits a revised practice item; an unchanged one finalizes as checked', async () => {
		const { player, submissions, finalized } = await fixture('individual', [
			practiceItem('p1', { showFeedback: true, maxAttempts: 3 }),
		]);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();

		// Unchanged: finalize uses the check's recorded result.
		const results = await player.submit();
		expect(finalized()).toBe(true);
		expect(submissions).toHaveLength(1);
		expect(results.itemResults[0]).toMatchObject({ itemIdentifier: 'p1', score: 0 });
		expect(player.getResultsSummary()?.items[0]).toMatchObject({ identifier: 'p1', score: 0, status: 'answered' });
	});

	it('captures no feedback when showFeedback is off', async () => {
		const { player, submissions } = await fixture('individual', [plainItem('p1'), plainItem('p2')]);
		player.updateResponse('RESPONSE', 'B');
		// Submit-on-move with feedback policy off: the submission must not surface feedback.
		await player.next();
		expect(submissions).toHaveLength(1);
		expect(player.getLastItemFeedback()).toBeNull();
	});

	it('captures feedback on the submit-on-move transition for a single-attempt item', async () => {
		const { player, submissions } = await fixture('individual', [
			practiceItem('p1', { showFeedback: true }),
			plainItem('p2'),
		]);
		player.updateResponse('RESPONSE', 'B');
		await player.next();
		expect(submissions).toHaveLength(1);
		// The candidate left the item; its correct-answer feedback rides the transition.
		expect(player.getLastItemFeedback()?.feedback.map((entry) => entry.identifier)).toEqual(['correct']);
		expect(player.getNavigationState().currentIndex).toBe(1);
	});
});

describe('candidate comments (allowComment)', () => {
	it('stores the comment in the snapshot and sends it with the submission', async () => {
		const commentItem = (identifier: string, allow: boolean): SecureItemRef => ({
			...plainItem(identifier),
			itemSessionControl: { allowComment: allow },
		});
		const { player, submissions } = await fixture('individual', [commentItem('p1', true), commentItem('p2', false)]);

		expect(player.getItemSessionInfo()?.canComment).toBe(true);
		player.setItemComment('The diagram is unclear.');
		expect(player.getItemComment()).toBe('The diagram is unclear.');
		expect(player.getState().itemComments?.p1).toBe('The diagram is unclear.');

		player.updateResponse('RESPONSE', 'B');
		await player.next();
		expect(submissions[0]?.comment).toBe('The diagram is unclear.');

		// The next item does not allow comments.
		expect(player.getItemSessionInfo()?.canComment).toBe(false);
		expect(() => player.setItemComment('nope')).toThrow();
	});
});
