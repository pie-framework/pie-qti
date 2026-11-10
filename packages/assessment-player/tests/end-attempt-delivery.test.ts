/**
 * QTI endAttemptInteraction inside assessment delivery.
 *
 * The item session is owned by the AssessmentPlayer, so activating an end-attempt button never
 * closes the session locally: the player decides per QTI submission mode. Individual mode submits
 * the item through the normal per-item path with the interaction's countAttempt honored (a
 * countAttempt="false" hint runs response processing without consuming an attempt); simultaneous
 * mode records the response and defers response processing to the end of the test part, so the
 * final submission still succeeds.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SecureItemRef, SubmitResponsesRequest } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** A choice item plus an end-attempt interaction whose countAttempt is configurable. */
const endAttemptItem = (
	identifier: string,
	{
		adaptive = false,
		countAttempt,
	}: { adaptive?: boolean; countAttempt?: boolean } = {},
): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml: `<assessmentItem ${NS} identifier="${identifier}" title="End attempt" adaptive="${adaptive}" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="END" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="HINT_SEEN" cardinality="single" baseType="identifier">
    <defaultValue><value>none</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
    <p><endAttemptInteraction responseIdentifier="END" title="End attempt"${countAttempt === undefined ? '' : ` countAttempt="${countAttempt}"`}/></p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>
      </responseIf>
      <responseElseIf>
        <variable identifier="END"/>
        <setOutcomeValue identifier="HINT_SEEN"><baseValue baseType="identifier">hinted</baseValue></setOutcomeValue>
      </responseElseIf>
    </responseCondition>
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
		identifier: `end-attempt-${submissionMode}-${items.length}`,
		title: 'End attempt delivery',
		navigationMode: 'nonlinear',
		submissionMode,
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode,
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

describe('endAttemptInteraction in assessment delivery', () => {
	it('individual mode: activation submits the item with the attempt counted and stays on the item', async () => {
		const { player, submissions } = await fixture('individual', [endAttemptItem('item-1')]);
		player.updateResponse('RESPONSE', 'B');
		player.updateResponse('END', true);

		// The activation itself submits the item; the candidate stays on it.
		await waitFor(() => submissions.length === 1 && !player.isBusy(), 'the end-attempt submission');
		expect(player.getNavigationState().currentIndex).toBe(0);
		expect(submissions[0]).toMatchObject({ itemIdentifier: 'item-1', countAttempt: true });
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('closed');
		expect(player.getCurrentItemSession()?.state().numAttempts).toBe(1);
		expect(player.getState().itemScores?.['item-1'] === undefined).toBe(false);

		// The counted attempt is consumed: another submission cannot exceed maxAttempts, and the
		// already-closed session must not make that attempt throw a local lifecycle error.
		await expect(player.submitCurrentItem()).rejects.toThrow('Maximum attempts reached');
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('closed');

		// Ending the test finalizes the already-submitted item.
		const results = await player.submit();
		expect(results.itemResults.map((result) => result.itemIdentifier)).toEqual(['item-1']);
		expect(results.totalScore).toBe(1);
	});

	it('individual mode: a countAttempt=false hint on a non-adaptive item keeps the session open and the final submission succeeds', async () => {
		const { player, submissions } = await fixture('individual', [endAttemptItem('item-1', { countAttempt: false })]);
		player.updateResponse('RESPONSE', 'A');
		player.updateResponse('END', true);

		await waitFor(() => submissions.length === 1 && !player.isBusy(), 'the hint submission');
		expect(submissions[0]).toMatchObject({ itemIdentifier: 'item-1', countAttempt: false });
		// Response processing ran for the hint outcome, without counting an attempt.
		const session = player.getCurrentItemSession();
		expect(session?.state().lifecycleStatus).toBe('interacting');
		expect(session?.state().numAttempts).toBe(0);
		expect(session?.state().outcomes.HINT_SEEN).toBe('hinted');
		// No result was recorded, so the item is still pending its real submission.
		expect(player.getState().itemScores?.['item-1']).toBeUndefined();
		expect(player.getState().itemSessionStates?.['item-1']?.attemptCount).toBe(0);
		// The hint consumed no attempt: the single allowed attempt is still available.
		expect(player.getItemSessionInfo()?.remainingAttempts).toBe(1);

		// The candidate changes their mind; the final submission carries the final response and
		// consumes the attempt.
		player.updateResponse('RESPONSE', 'B');
		const results = await player.submit();
		expect(submissions.map((s) => s.itemIdentifier)).toEqual(['item-1', 'item-1']);
		expect(submissions[1]).toMatchObject({ countAttempt: true, responses: { RESPONSE: 'B' } });
		expect(results.totalScore).toBe(1);
		expect(results.itemResults[0]?.score).toBe(1);
		expect(player.getItemSessionInfo()?.remainingAttempts).toBe(0);
	});

	it('simultaneous mode: the end-attempt response is recorded and the final submission succeeds', async () => {
		const { player, submissions } = await fixture('simultaneous', [endAttemptItem('item-1')]);
		player.updateResponse('RESPONSE', 'B');
		player.updateResponse('END', true);

		// Response processing is deferred: activation submits nothing and closes nothing.
		await new Promise((resolve) => setTimeout(resolve, 25));
		expect(submissions).toHaveLength(0);
		const status = player.getCurrentItemSession()?.state().lifecycleStatus;
		expect(status === 'interacting' || status === 'initial').toBe(true);

		const results = await player.submit();
		expect(submissions.map((s) => s.itemIdentifier)).toEqual(['item-1']);
		expect(submissions[0]?.responses).toMatchObject({ RESPONSE: 'B', END: true });
		expect(results.totalScore).toBe(1);
		expect(results.itemResults[0]?.score).toBe(1);
	});

	it('individual mode: an adaptive item keeps accepting hint attempts until it completes', async () => {
		const { player, submissions } = await fixture(
			'individual',
			[endAttemptItem('item-1', { adaptive: true, countAttempt: false })],
		);
		player.updateResponse('RESPONSE', 'A');
		player.updateResponse('END', true);

		await waitFor(() => submissions.length === 1 && !player.isBusy(), 'the adaptive hint submission');
		expect(submissions[0]).toMatchObject({ countAttempt: false });
		const session = player.getCurrentItemSession();
		expect(session?.state().lifecycleStatus).toBe('interacting');
		expect(session?.state().numAttempts).toBe(0);

		// The corrected answer ends the adaptive item with a counted attempt.
		player.updateResponse('RESPONSE', 'B');
		const results = await player.submit();
		expect(submissions.map((s) => s.itemIdentifier)).toEqual(['item-1', 'item-1']);
		expect(submissions[1]).toMatchObject({ countAttempt: true });
		expect(results.totalScore).toBe(1);
		const finalSession = player.getCurrentItemSession()?.state();
		expect(finalSession?.numAttempts).toBe(1);
		expect(finalSession?.lifecycleStatus).toBe('closed');
	});

	it('a hint after a counted check on a reopened item leaves the item session open', async () => {
		// The item's response processing marks completionStatus=completed for the correct
		// answer, so a hint on that answer runs response processing into "completed". The
		// hint consumed no attempt, so the session must be as open as it was before it.
		const item1 = {
			...endAttemptItem('item-1', { countAttempt: false }),
			itemSessionControl: { showFeedback: true, maxAttempts: 3 },
		};
		const { player, submissions } = await fixture('individual', [
			item1,
			endAttemptItem('item-2', { countAttempt: false }),
		]);
		player.updateResponse('RESPONSE', 'B');
		await player.next();
		expect(player.getNavigationState().currentIndex).toBe(1);

		// Back to the submitted item: it reopens attemptable (two attempts remain).
		await player.navigateTo(0);
		expect(player.getItemSessionInfo()).toMatchObject({ attemptCount: 1, remainingAttempts: 2 });

		// A counted check on the reopened item: attempt 2, then it reopens writable again.
		await player.checkCurrentItem();
		expect(player.getNavigationState().currentIndex).toBe(0);
		expect(player.getItemSessionInfo()).toMatchObject({ attemptCount: 2, remainingAttempts: 1 });
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('interacting');

		// The hint submits uncounted and must leave the session as open as it was.
		player.updateResponse('END', true);
		await waitFor(() => submissions.length === 3 && !player.isBusy(), 'the hint submission');
		expect(submissions[2]).toMatchObject({ itemIdentifier: 'item-1', countAttempt: false });
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('interacting');
		expect(player.getItemSessionInfo()).toMatchObject({ attemptCount: 2, remainingAttempts: 1 });

		// The candidate can still answer: change the response and submit a counted attempt.
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(submissions.map((s) => s.itemIdentifier)).toEqual(['item-1', 'item-1', 'item-1', 'item-1']);
		expect(submissions[3]).toMatchObject({ countAttempt: true, responses: { RESPONSE: 'A' } });
		expect(player.getItemSessionInfo()).toMatchObject({ attemptCount: 3, remainingAttempts: 0 });
	});
});
