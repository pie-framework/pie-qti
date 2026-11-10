/**
 * The response-validation memo: the engine's base validation is computed once per response
 * revision and interaction-data generation, so repeated reads at unchanged state reuse the
 * computation — while every state change revalidates.
 *
 * Pinned here, because a stale memo would be a correctness bug, not a performance one:
 * - repeated validation of the same responses object at one revision returns the same result;
 * - a template change that regenerates the interaction data revalidates, even for the same
 *   responses object (a template-shown choice's matchMin appears and disappears);
 * - response changes revalidate, so the session's canSubmit stays correct after newTemplate;
 * - the memoized validation is the BASE validation: the serialized validationMessages never
 *   contain the end-attempt gate's `incomplete` issue, even when the gate just reported it.
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const MIN_CHOICES_ITEM = `<assessmentItem ${NS} identifier="memo-min-choices" title="Min choices" adaptive="false" timeDependent="false">
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

/**
 * An order choice the template hides while T holds "A". Without minChoices an order is
 * complete once it holds every choice — so with A hidden ['B', 'C'] is a complete order of
 * the two remaining choices, and with A shown the same response orders two of three.
 */
const TEMPLATE_CHOICE_ITEM = `<assessmentItem ${NS} identifier="memo-template-choice" title="Template choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <templateDeclaration identifier="T" cardinality="single" baseType="identifier">
    <defaultValue><value>A</value></defaultValue>
  </templateDeclaration>
  <itemBody>
    <orderInteraction responseIdentifier="RESPONSE">
      <simpleChoice identifier="A" templateIdentifier="T" showHide="hide">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
      <simpleChoice identifier="C">C</simpleChoice>
    </orderInteraction>
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

describe('response validation memo', () => {
	test('repeated validation of the same responses at one state reuses the computation', () => {
		const player = new Player({ itemXml: MIN_CHOICES_ITEM });
		try {
			const responses = { RESPONSE: ['A', 'B'] };
			expect(player.validateResponses(responses)).toBe(player.validateResponses(responses));
		} finally {
			player.destroy();
		}
	});

	test('a template change that regenerates the interaction data revalidates the same responses object', () => {
		const player = new Player({ itemXml: TEMPLATE_CHOICE_ITEM });
		try {
			// T defaults to "A": the matchMin choice is hidden, ['B'] satisfies the interaction.
			const responses = { RESPONSE: ['B', 'C'] };
			const withHidden = player.validateResponses(responses);
			expect(withHidden.entries.RESPONSE?.required).toBe(false);
			expect(withHidden.entries.RESPONSE?.complete).toBe(true);

			player.setTemplateVariables({ T: 'B' });
			const withShown = player.validateResponses(responses);
			expect(withShown).not.toBe(withHidden);
			expect(withShown.entries.RESPONSE?.complete).toBe(false);

			// Back to the hidden state: the first result's reading applies again.
			player.setTemplateVariables({ T: 'A' });
			const back = player.validateResponses(responses);
			expect(back).not.toBe(withShown);
			expect(back.entries.RESPONSE?.complete).toBe(true);
		} finally {
			player.destroy();
		}
	});

	test('canSubmit stays correct after newTemplate', () => {
		withSession(MIN_CHOICES_ITEM, (session) => {
			session.dispatch({ action: 'setResponses', responses: { RESPONSE: ['A', 'B'] } });
			expect(session.state().canSubmit).toBe(true);

			// A new template instance resets the responses: the required interaction is
			// unanswered again, whatever an earlier revision's memo held.
			session.dispatch({ action: 'newTemplate' });
			expect(session.state().canSubmit).toBe(false);

			session.dispatch({ action: 'setResponses', responses: { RESPONSE: ['A', 'B'] } });
			expect(session.state().canSubmit).toBe(true);
		});
	});

	test('serialized validationMessages never carry the gate incomplete issue', () => {
		withSession(MIN_CHOICES_ITEM, (session) => {
			session.dispatch({ action: 'setResponses', responses: { RESPONSE: ['A'] } });
			const result = session.dispatch({ action: 'endAttempt', validateResponses: true });

			// The gate rejects the incomplete attempt with its own issue channel.
			expect(result.result?.validation?.issues.map((issue) => issue.code)).toEqual(['incomplete']);
			// The serialized snapshot of the same responses stays base validation: a skip-or-not
			// judgement is the caller's, so `incomplete` never appears in persisted state.
			for (const messages of [
				result.result?.sessionState.validationMessages,
				session.serialize().validationMessages,
			]) {
				expect(messages?.map((issue) => issue.code)).not.toContain('incomplete');
			}
			expect(session.state().canSubmit).toBe(false);
		});
	});
});
