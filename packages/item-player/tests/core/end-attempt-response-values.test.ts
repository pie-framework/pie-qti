/**
 * The value of an endAttemptInteraction's response during response processing (QTI 2.1
 * endAttemptInteraction; QTI 3.0 §5.45): "If the candidate invokes response processing using an
 * end-attempt interaction then the associated response variable is set to true. If response
 * processing is invoked in any other way, either through a different end-attempt interaction or
 * through the default method for the delivery engine, then the associated response variable is
 * set to false. The default value of the response variable is always ignored."
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

// Response processing copies each hint response into an outcome, so the outcomes show the value
// each response had while processing ran.
const TWO_HINTS_ITEM = `<assessmentItem ${NS} identifier="two-hints" title="Two Hints" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HINT1" cardinality="single" baseType="boolean"/>
  <responseDeclaration identifier="HINT2" cardinality="single" baseType="boolean">
    <defaultValue><value>true</value></defaultValue>
  </responseDeclaration>
  <outcomeDeclaration identifier="SAW1" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="SAW2" cardinality="single" baseType="boolean"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
    <p><endAttemptInteraction responseIdentifier="HINT1" title="First hint" countAttempt="false"/></p>
    <p><endAttemptInteraction responseIdentifier="HINT2" title="Second hint" countAttempt="false"/></p>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="SAW1"><variable identifier="HINT1"/></setOutcomeValue>
    <setOutcomeValue identifier="SAW2"><variable identifier="HINT2"/></setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

describe.each([
	['QTI 2.2', TWO_HINTS_ITEM],
	['QTI 3.0', convertQti2ToQti3(TWO_HINTS_ITEM)],
])('endAttemptInteraction response values during response processing (%s)', (_version, itemXml) => {
	const withSession = (run: (session: ItemSession) => void) => {
		const session = createAssessmentItemDefinition({ itemXml }).openSession();
		try {
			run(session);
		} finally {
			session.dispose();
		}
	};

	/** The candidate activates the hint button bound to `responseIdentifier`. */
	const pressHint = (session: ItemSession, responseIdentifier: string) => {
		session.dispatch({ action: 'setResponse', responseIdentifier, value: true });
		return session.dispatch({ action: 'endAttempt', countAttempt: false }).current;
	};

	test('the invoking interaction is true and every other one false, not its default or NULL', () => {
		withSession((session) => {
			const view = pressHint(session, 'HINT1');
			expect(view.outcomes.SAW1).toBe(true);
			expect(view.outcomes.SAW2).toBe(false);
			expect(view.responses.HINT2).toBe(false);
		});
	});

	test('a different end-attempt interaction sets the earlier one false', () => {
		withSession((session) => {
			pressHint(session, 'HINT1');
			const view = pressHint(session, 'HINT2');
			expect(view.outcomes.SAW1).toBe(false);
			expect(view.outcomes.SAW2).toBe(true);
			expect(view.responses.HINT1).toBe(false);
			expect(view.responses.HINT2).toBe(true);
		});
	});

	test('the default way of ending the attempt sets every end-attempt response false', () => {
		withSession((session) => {
			pressHint(session, 'HINT1');
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
			const view = session.dispatch({ action: 'endAttempt' }).current;
			expect(view.outcomes.SAW1).toBe(false);
			expect(view.outcomes.SAW2).toBe(false);
			expect(view.responses.HINT1).toBe(false);
		});
	});

	test('the invoking response keeps its value after processing, for review and reporting', () => {
		withSession((session) => {
			const view = pressHint(session, 'HINT1');
			expect(view.responses.HINT1).toBe(true);
		});
	});

	test('a value carried by a restored session is not a new activation', () => {
		withSession((session) => {
			pressHint(session, 'HINT1');
			const saved = session.serialize();
			const restored = createAssessmentItemDefinition({ itemXml }).openSession({ restore: saved });
			try {
				expect(restored.state().responses.HINT1).toBe(true);
				const view = restored.dispatch({ action: 'endAttempt' }).current;
				expect(view.outcomes.SAW1).toBe(false);
			} finally {
				restored.dispose();
			}
		});
	});

	test('rescoring replays the last submission without changing its end-attempt responses', () => {
		withSession((session) => {
			pressHint(session, 'HINT1');
			const view = session.dispatch({ action: 'scoreAttempt' }).current;
			expect(view.outcomes.SAW1).toBe(true);
			expect(view.responses.HINT1).toBe(true);
		});
	});
});
