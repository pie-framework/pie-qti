/**
 * Activating an endAttemptInteraction ends the attempt: the item player submits with the
 * interaction's countAttempt (false for hint requests, which do not count as an attempt).
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { endAttemptRequest } from '../../src/components/utils/endAttempt.js';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const HINT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="hint" title="Hint" adaptive="true" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
  <responseDeclaration identifier="GIVE_UP" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
    <p><endAttemptInteraction responseIdentifier="HINT" title="Show a hint" countAttempt="false"/></p>
    <p><endAttemptInteraction responseIdentifier="GIVE_UP" title="Give up"/></p>
  </itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', HINT_ITEM],
	['QTI 3.0', convertQti2ToQti3(HINT_ITEM)],
])('endAttemptRequest (%s)', (_version, itemXml) => {
	const withSession = (run: (session: ItemSession) => void) => {
		const session = createAssessmentItemDefinition({ itemXml }).openSession();
		try {
			run(session);
		} finally {
			session.dispose();
		}
	};
	const flow = (session: ItemSession) => () => session.present().flow;

	test('a hint request ends the attempt without counting it', () => {
		withSession((session) => {
			const transition = session.dispatch({ action: 'setResponse', responseIdentifier: 'HINT', value: true });
			expect(endAttemptRequest(transition, flow(session))).toEqual({ countAttempt: false });
		});
	});

	test('an end-attempt button counts the attempt by default', () => {
		withSession((session) => {
			const transition = session.dispatch({ action: 'setResponse', responseIdentifier: 'GIVE_UP', value: true });
			expect(endAttemptRequest(transition, flow(session))).toEqual({ countAttempt: true });
		});
	});

	test('only the change to true ends the attempt, once', () => {
		withSession((session) => {
			const off = session.dispatch({ action: 'setResponse', responseIdentifier: 'HINT', value: false });
			expect(endAttemptRequest(off, flow(session))).toBeNull();
			session.dispatch({ action: 'setResponse', responseIdentifier: 'HINT', value: true });
			const again = session.dispatch({ action: 'setResponse', responseIdentifier: 'HINT', value: true });
			expect(endAttemptRequest(again, flow(session))).toBeNull();
		});
	});

	test('other responses and bulk response writes never end the attempt', () => {
		withSession((session) => {
			const choice = session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			expect(endAttemptRequest(choice, flow(session))).toBeNull();
			const restored = session.dispatch({ action: 'setResponses', responses: { GIVE_UP: true } });
			expect(endAttemptRequest(restored, flow(session))).toBeNull();
		});
	});
});
