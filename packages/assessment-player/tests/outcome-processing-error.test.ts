/**
 * Test-level outcome-processing failures must surface (issue: silent swallowing).
 *
 * When outcome processing fails, SCORE/testFeedback silently never computed. Now the
 * failure is carried as a typed, stable-coded error on the submit response, the finalize
 * response, the persisted session and the final results; the host hears it through
 * config.onError (and the web component's player-error event); and delivery never
 * crashes: candidate responses stay accepted and persisted.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { AssessmentPlayerError, isAssessmentPlayerError } from '../src/core/errors.js';
import type { SubmitResponsesResponse } from '../src/integration/api-contract.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const ITEM_XML = `<assessmentItem ${NS} identifier="i1" title="Item 1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

/** Test-level outcome processing whose expression fails to compile and execute. */
const TEST_XML = `<assessmentTest ${NS} identifier="op-error" title="Outcome processing error">
  <outcomeDeclaration identifier="SCORE_TOTAL" cardinality="single" baseType="float"/>
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section 1" visible="true">
      <assessmentItemRef identifier="i1" href="i1.xml"/>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="SCORE_TOTAL"><totallyUnknownOperator/></setOutcomeValue>
  </outcomeProcessing>
</assessmentTest>`;

async function setup() {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
		itemXmlMap: { 'i1.xml': ITEM_XML },
	});
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const init = await backend.initSession({ assessmentId: parsed.identifier, candidateId: 'candidate' });
	return { parsed, backend, init };
}

afterEach(() => localStorage.clear());

function errorCode(error: unknown): string {
	expect(isAssessmentPlayerError(error)).toBe(true);
	return (error as AssessmentPlayerError).code;
}

describe('outcome-processing failures surface instead of disappearing', () => {
	test('submitResponses returns a typed error and keeps responses persisted', async () => {
		const { backend, init } = await setup();
		const res: SubmitResponsesResponse = await backend.submitResponses({
			sessionId: init.sessionId,
			itemIdentifier: 'i1',
			responses: { RESPONSE: 'A' },
			submittedAt: Date.now(),
		});

		expect(res.success).toBe(true);
		expect(res.result).toBeDefined();
		expect(res.outcomeProcessingError?.code).toBe('OUTCOME_PROCESSING_FAILED');
		expect(res.outcomeProcessingError?.message.length).toBeGreaterThan(0);

		// Candidate responses stay persisted despite the failure.
		const stored = JSON.parse(localStorage.getItem(`qti_session_${init.sessionId}`) ?? '{}');
		expect(stored.state?.itemResponses?.i1?.RESPONSE).toBe('A');
		expect(stored.state?.itemScores?.i1).toBeDefined();
		expect(stored.outcomeProcessingError?.code).toBe('OUTCOME_PROCESSING_FAILED');
	});

	test('the player surfaces the error via onError and on results, without crashing delivery', async () => {
		const { parsed, backend } = await setup();
		localStorage.clear();
		const onErrorCalls: string[] = [];
		let completions = 0;

		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'player' },
			onComplete: () => {
				completions += 1;
			},
			onError: (error) => {
				onErrorCalls.push(errorCode(error));
			},
		});
		await player.navigateTo(0);

		player.updateResponse('RESPONSE', 'A');
		const results = await player.submit();

		// Delivery completed normally.
		expect(completions).toBe(1);
		expect(results.itemResults.map((r) => r.itemIdentifier)).toEqual(['i1']);

		// The host heard about the failure exactly once (submit + finalize share one report).
		expect(onErrorCalls).toEqual(['outcomeProcessingFailed']);

		// Results carry the typed error explicitly.
		expect(results.outcomeProcessingError?.code).toBe('OUTCOME_PROCESSING_FAILED');
		expect(player.getNavigationState().isComplete).toBe(true);
	});
});
