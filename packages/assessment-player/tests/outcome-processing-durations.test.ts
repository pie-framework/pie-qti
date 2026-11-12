/**
 * Test-level outcome processing reads the built-in duration variables of the test, each test part
 * and each section (`duration`, `PART_ID.duration`, `SECTION_ID.duration`) in seconds, from
 * TimeManager timing. Clocks keep milliseconds; only the QTI variables are seconds.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '@pie-qti/item-player';
import type { SerializedItemSessionState } from '@pie-qti/item-player';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { AssessmentSessionState } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const item = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

const TEST_22 = `<assessmentTest ${NS} identifier="durations-test" title="Durations">
  <outcomeDeclaration identifier="TEST_DURATION" cardinality="single" baseType="duration"/>
  <outcomeDeclaration identifier="PART_DURATION" cardinality="single" baseType="duration"/>
  <outcomeDeclaration identifier="SECTION_DURATION" cardinality="single" baseType="duration"/>
  <outcomeDeclaration identifier="ITEM_DURATION" cardinality="single" baseType="duration"/>
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="section-a" title="A" visible="true">
      <assessmentSection identifier="section-b" title="B" visible="true">
        <assessmentItemRef identifier="item-1" href="item-1.xml"/>
      </assessmentSection>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="TEST_DURATION"><variable identifier="duration"/></setOutcomeValue>
    <setOutcomeValue identifier="PART_DURATION"><variable identifier="part-1.duration"/></setOutcomeValue>
    <setOutcomeValue identifier="SECTION_DURATION"><variable identifier="section-a.duration"/></setOutcomeValue>
    <setOutcomeValue identifier="ITEM_DURATION"><variable identifier="item-1.duration"/></setOutcomeValue>
  </outcomeProcessing>
</assessmentTest>`;

const VERSIONS = {
	'QTI 2.2': TEST_22,
	'QTI 3.0': convertQti2ToQti3(TEST_22),
} as const;

afterEach(() => localStorage.clear());

describe.each(Object.keys(VERSIONS) as Array<keyof typeof VERSIONS>)('%s duration variables in outcome processing', (version) => {
	test('expose the test, testPart and section clocks in seconds', async () => {
		const itemXml = version === 'QTI 3.0' ? convertQti2ToQti3(item('item-1')) : item('item-1');
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(VERSIONS[version], {
			itemXmlMap: { 'item-1.xml': itemXml },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		const { sessionId } = await backend.initSession({ assessmentId: assessment.identifier, candidateId: 'candidate' });

		// A candidate who answered and whose serialized item session reports 60 seconds on task
		// (the item's built-in `duration` variable is seconds; the host-facing fields are ms).
		const session = createAssessmentItemDefinition({ itemXml, role: 'candidate' }).openSession();
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		session.dispatch({ action: 'endAttempt', countAttempt: false });
		const serialized = session.serialize();
		session.dispose();
		// The snapshot is frozen; rebuild it with a deterministic 60 seconds on task (the
		// serialized `duration` field is host-facing milliseconds).
		const itemSession: SerializedItemSessionState = { ...serialized, duration: 60000 };

		await backend.submitResponses({
			sessionId,
			itemIdentifier: 'item-1',
			responses: { RESPONSE: 'A' },
			submittedAt: Date.now(),
			itemSession,
		});

		// The host persists the TimeManager timing (milliseconds) with saveState.
		const stored = JSON.parse(localStorage.getItem(`qti_session_${sessionId}`)!);
		const state = stored.state as AssessmentSessionState;
		state.timing = {
			...state.timing,
			startedAt: Date.now() - 90000,
			totalTime: 65000,
			itemTimes: { ...state.timing.itemTimes, 'item-1': 60000 },
			sectionTimes: { 'section-a': 30000, 'section-b': 12000 },
			testPartTimes: { 'part-1': 45000 },
		};
		await backend.saveState({ sessionId, state });

		const results = await backend.finalizeAssessment({ sessionId });
		// Milliseconds convert to QTI duration seconds.
		expect(results.outcomes).toMatchObject({
			TEST_DURATION: 65,
			PART_DURATION: 45,
			SECTION_DURATION: 30,
		});
		// The item's own duration variable; the restored session accrues a millisecond or two.
		expect(results.outcomes?.ITEM_DURATION).toBeCloseTo(60, 2);
	});
});
