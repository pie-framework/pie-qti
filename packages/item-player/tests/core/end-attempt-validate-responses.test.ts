/**
 * QTI itemSessionControl validateResponses (ASI §4): "An invalid response is defined to be a
 * response which does not satisfy the constraints imposed by the interaction with which it is
 * associated" — minChoices, minStrings, matchMin and the like, not only a well-formed value.
 * With validateResponses on, endAttempt rejects such a response: the attempt is not counted,
 * no response processing runs, and the session stays writable for the candidate to correct it.
 *
 * An item with no response at all is a skip, which allowSkipping governs (and "delivery engines
 * must ensure that the candidate can choose to submit no response" when it is true). The item
 * does not know allowSkipping, so a skip is left to the caller rather than rejected here.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const MIN_CHOICES_ITEM = `<assessmentItem ${NS} identifier="min-choices" title="Min choices" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse><value>A</value><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" minChoices="2" maxChoices="3">
      <prompt>Select two or three.</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
      <simpleChoice identifier="C">C</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

const MIN_STRINGS_ITEM = `<assessmentItem ${NS} identifier="min-strings" title="Min strings" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="string"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <extendedTextInteraction responseIdentifier="RESPONSE" minStrings="2" maxStrings="3">
      <prompt>Give two reasons.</prompt>
    </extendedTextInteraction>
  </itemBody>
</assessmentItem>`;

function withSession(itemXml: string, run: (session: ItemSession) => void): void {
	const session = createAssessmentItemDefinition({ itemXml }).openSession();
	try {
		run(session);
	} finally {
		session.dispose();
	}
}

describe.each([
	['QTI 2.2', MIN_CHOICES_ITEM],
	['QTI 3.0', convertQti2ToQti3(MIN_CHOICES_ITEM)],
])('endAttempt validateResponses against minChoices (%s)', (_version, itemXml) => {
	test('rejects a response with fewer than minChoices selections', () => {
		withSession(itemXml, (session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['A'] });
			const before = session.state().lifecycleStatus;

			const result = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;

			expect(result?.validation?.valid).toBe(false);
			expect(result?.validation?.entries.RESPONSE?.valid).toBe(false);
			expect(result?.validation?.issues).toContainEqual(
				expect.objectContaining({ responseId: 'RESPONSE', code: 'incomplete', severity: 'error' }),
			);
			expect(result?.scoring).toBeUndefined();
			expect(result?.completed).toBe(false);
			// Not counted, and still open for the candidate to correct.
			expect(session.state().numAttempts).toBe(0);
			expect(session.state().lifecycleStatus).toBe(before);
			expect(session.state().lifecycleStatus).not.toBe('closed');
			expect(session.state().responses.RESPONSE).toEqual(['A']);
		});
	});

	test('accepts a response that satisfies minChoices', () => {
		withSession(itemXml, (session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['A', 'B'] });

			const result = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;

			expect(result?.validation?.valid).toBe(true);
			expect(result?.validation?.issues).toEqual([]);
			expect(result?.scoring?.score).toBe(1);
			expect(session.state().numAttempts).toBe(1);
			expect(session.state().lifecycleStatus).toBe('closed');
		});
	});

	test('a corrected response is accepted after a rejection', () => {
		withSession(itemXml, (session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['A'] });
			expect(session.dispatch({ action: 'endAttempt', validateResponses: true }).result?.validation?.valid).toBe(false);

			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['A', 'C'] });
			const result = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(result?.validation?.valid).toBe(true);
			expect(session.state().numAttempts).toBe(1);
			expect(session.state().lifecycleStatus).toBe('closed');
		});
	});

	test('without validateResponses an incomplete response is accepted as it stands', () => {
		withSession(itemXml, (session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['A'] });

			const result = session.dispatch({ action: 'endAttempt' }).result;

			expect(result?.validation).toBeUndefined();
			expect(result?.scoring?.score).toBe(0);
			expect(session.state().numAttempts).toBe(1);
			expect(session.state().lifecycleStatus).toBe('closed');
		});
	});

	test('a skipped item (no response at all) is left to allowSkipping, not rejected', () => {
		withSession(itemXml, (session) => {
			const result = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;

			expect(result?.validation?.valid).toBe(true);
			expect(result?.validation?.entries.RESPONSE?.complete).toBe(false);
			expect(session.state().numAttempts).toBe(1);
			expect(session.state().lifecycleStatus).toBe('closed');
		});
	});
});

describe('endAttempt validateResponses against minStrings', () => {
	test('rejects fewer strings than minStrings and accepts enough', () => {
		withSession(MIN_STRINGS_ITEM, (session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['one'] });
			const rejected = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(rejected?.validation?.valid).toBe(false);
			expect(rejected?.validation?.issues.map((issue) => issue.code)).toEqual(['incomplete']);
			expect(session.state().numAttempts).toBe(0);

			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['one', 'two'] });
			const accepted = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(accepted?.validation?.valid).toBe(true);
			expect(session.state().numAttempts).toBe(1);
		});
	});
});
