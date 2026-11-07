/**
 * QTI countAttempt on endAttemptInteraction: response processing always runs, but only a counted
 * attempt finalizes a non-adaptive item. With countAttempt="false" (QTI 3.0 `count-attempt`) the
 * attempt is not counted — numAttempts is unchanged and the session stays open so the candidate
 * continues (this is how hint buttons work on plain items, not just adaptive ones).
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const HINT_ITEM = `<assessmentItem ${NS} identifier="hint-item" title="Hint Item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
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
    <p><endAttemptInteraction responseIdentifier="HINT" title="Show a hint" countAttempt="false"/></p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
        <setOutcomeValue identifier="completionStatus">
          <baseValue baseType="identifier">completed</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElseIf>
        <variable identifier="HINT"/>
        <setOutcomeValue identifier="HINT_SEEN">
          <baseValue baseType="identifier">hinted</baseValue>
        </setOutcomeValue>
      </responseElseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

describe.each([
	['QTI 2.2 (countAttempt)', HINT_ITEM],
	['QTI 3.0 (count-attempt)', convertQti2ToQti3(HINT_ITEM)],
])('endAttempt countAttempt=false on a non-adaptive item (%s)', (_version, itemXml) => {
	const withSession = (run: (session: ItemSession) => void) => {
		const session = createAssessmentItemDefinition({ itemXml }).openSession();
		try {
			run(session);
		} finally {
			session.dispose();
		}
	};

	test('the interaction metadata reports the uncounted attempt in both spellings', () => {
		withSession((session) => {
			const hint = session
				.present()
				.flow.find((node) => node.kind === 'interaction' && node.mount.interaction.type === 'endAttemptInteraction');
			expect(hint).toBeDefined();
			expect((hint!.mount.interaction as { countAttempt?: boolean }).countAttempt).toBe(false);
		});
	});

	test('runs response processing without counting the attempt and keeps the session open', () => {
		withSession((session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			// Activating the hint button records its boolean response, then ends the attempt.
			session.dispatch({ action: 'setResponse', responseIdentifier: 'HINT', value: true });
			const transition = session.dispatch({ action: 'endAttempt', countAttempt: false });

			const view = transition.current;
			// Response processing ran: the hint outcome resolved from the HINT response.
			expect(view.outcomes.HINT_SEEN).toBe('hinted');
			// The attempt was not counted and the item did not finalize.
			expect(view.numAttempts).toBe(0);
			expect(view.completionStatus).not.toBe('completed');
			expect(view.completed).toBe(false);
			expect(view.lifecycleStatus).toBe('interacting');
			// The candidate continues: responses stay writable and a later counted attempt is possible.
			expect(() => session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' })).not.toThrow();
			expect(session.state().responses.HINT).toBe(true);
		});
	});

	test('a later counted attempt finalizes and scores the continued response', () => {
		withSession((session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			session.dispatch({ action: 'setResponse', responseIdentifier: 'HINT', value: true });
			session.dispatch({ action: 'endAttempt', countAttempt: false });
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });

			const transition = session.dispatch({ action: 'endAttempt', countAttempt: true });
			const view = transition.current;
			expect(view.numAttempts).toBe(1);
			expect(view.completionStatus).toBe('completed');
			expect(view.completed).toBe(true);
			expect(view.lifecycleStatus).toBe('closed');
			expect(view.outcomes.SCORE).toBe(1);
		});
	});

	test('countAttempt defaults to a counted, finalizing attempt', () => {
		withSession((session) => {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			const transition = session.dispatch({ action: 'endAttempt' });
			expect(transition.current.numAttempts).toBe(1);
			expect(transition.current.lifecycleStatus).toBe('closed');
			expect(transition.current.completed).toBe(true);
		});
	});
});
