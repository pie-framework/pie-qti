/**
 * QTI ASI §10.3 with §5.1: template processing runs on a fresh instance of the item, whose
 * variables start from their declarations. `newTemplate` therefore starts the new instance from
 * the declared defaults and correct responses — not from the defaults (`setDefaultValue`) or
 * correct responses (`setCorrectResponse`) the previous instance's template rules computed — with
 * the assessmentItemRef's `templateDefault` values applied as at session start.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** Draw N=2 sets template-rule effects; draw N=1 skips them. */
const CONDITIONAL_RULES_ITEM = `<assessmentItem ${NS} identifier="new-template-declared" title="t" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="EXTRA" cardinality="single" baseType="identifier">
    <defaultValue><value>X</value></defaultValue>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <outcomeDeclaration identifier="BONUS" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <templateDeclaration identifier="N" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="BASE" cardinality="single" baseType="integer">
    <defaultValue><value>1</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="DOUBLE" cardinality="single" baseType="integer"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <choiceInteraction responseIdentifier="EXTRA" maxChoices="1">
      <simpleChoice identifier="X">X</simpleChoice>
      <simpleChoice identifier="Y">Y</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <templateProcessing>
    <setTemplateValue identifier="N"><randomInteger min="1" max="2"/></setTemplateValue>
    <setTemplateValue identifier="DOUBLE">
      <product><variable identifier="BASE"/><baseValue baseType="integer">2</baseValue></product>
    </setTemplateValue>
    <templateCondition>
      <templateIf>
        <match><variable identifier="N"/><baseValue baseType="integer">2</baseValue></match>
        <setCorrectResponse identifier="RESPONSE"><baseValue baseType="identifier">B</baseValue></setCorrectResponse>
        <setCorrectResponse identifier="EXTRA"><baseValue baseType="identifier">Y</baseValue></setCorrectResponse>
        <setDefaultValue identifier="EXTRA"><baseValue baseType="identifier">Y</baseValue></setDefaultValue>
        <setDefaultValue identifier="BONUS"><baseValue baseType="float">5</baseValue></setDefaultValue>
      </templateIf>
    </templateCondition>
  </templateProcessing>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** Random draws, in order, for one session: 0.99 draws N=2, 0 draws N=1. */
function draws(...values: number[]): () => () => number {
	return () => {
		let index = 0;
		return () => values[index++ % values.length]!;
	};
}

function correctResponseOf(session: ItemSession, identifier: string): unknown {
	return session.serialize().responseVariables[identifier]?.correctResponse;
}

describe.each([
	['QTI 2.2', CONDITIONAL_RULES_ITEM],
	['QTI 3.0', convertQti2ToQti3(CONDITIONAL_RULES_ITEM)],
])('newTemplate starts the new instance from the declarations (%s)', (_version, itemXml) => {
	test('the previous instance’s template-rule effects do not carry into the next draw', () => {
		const definition = createAssessmentItemDefinition({ itemXml, rngFactory: draws(0.99, 0) });
		const session = definition.openSession();
		try {
			// First instance: N=2 applied every template rule.
			expect(session.state().templates.N).toBe(2);
			expect(correctResponseOf(session, 'RESPONSE')).toBe('B');
			expect(correctResponseOf(session, 'EXTRA')).toBe('Y');
			expect(session.state().responses.EXTRA).toBe('Y');
			expect(session.state().outcomes.BONUS).toBe(5);

			session.dispatch({ action: 'newTemplate' });

			// Second instance: N=1 applies none, so every value is as declared.
			expect(session.state().templates.N).toBe(1);
			expect(correctResponseOf(session, 'RESPONSE')).toBe('A');
			expect(correctResponseOf(session, 'EXTRA')).toBeUndefined();
			expect(session.state().responses.EXTRA).toBe('X');
			expect(session.state().outcomes.BONUS).toBe(0);

			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			const ended = session.dispatch({ action: 'endAttempt' });
			// The declared key scores, and outcomes reset to their declared defaults.
			expect(ended.result?.scoring?.score).toBe(1);
			expect(ended.result?.scoring?.outcomeValues.BONUS).toBe(0);
			expect(ended.result?.sessionState.outcomeVariables.BONUS?.defaultValue).toBe(0);
		} finally {
			session.dispose();
		}
	});

	test('a restored session’s next instance also starts from the declarations', () => {
		const definition = createAssessmentItemDefinition({ itemXml, rngFactory: draws(0.99, 0) });
		const first = definition.openSession();
		const saved = first.serialize();
		first.dispose();
		expect(saved.responseVariables.RESPONSE?.correctResponse).toBe('B');

		// The restored session keeps the saved instance (no template processing), then draws N=2
		// and N=1 from its own random stream: two newTemplate calls reach the N=1 instance.
		const reopened = definition.openSession({ restore: saved });
		try {
			expect(correctResponseOf(reopened, 'RESPONSE')).toBe('B');
			reopened.dispatch({ action: 'newTemplate' });
			reopened.dispatch({ action: 'newTemplate' });
			expect(reopened.state().templates.N).toBe(1);
			expect(correctResponseOf(reopened, 'RESPONSE')).toBe('A');
			expect(correctResponseOf(reopened, 'EXTRA')).toBeUndefined();
			expect(reopened.state().responses.EXTRA).toBe('X');
			expect(reopened.state().outcomes.BONUS).toBe(0);
		} finally {
			reopened.dispose();
		}
	});

	test('the assessmentItemRef templateDefault values apply to the new instance', () => {
		const definition = createAssessmentItemDefinition({ itemXml, rngFactory: draws(0.99, 0) });
		const session = definition.openSession({ templateDefaults: { BASE: 7 } });
		try {
			expect(session.state().templates).toMatchObject({ BASE: 7, DOUBLE: 14 });
			session.dispatch({ action: 'newTemplate' });
			expect(session.state().templates).toMatchObject({ N: 1, BASE: 7, DOUBLE: 14 });

			// A session restored without its templateDefaults (as delivery restores one) keeps
			// them for its next instance too: the snapshot carries them as template defaults.
			const reopened = definition.openSession({ restore: session.serialize() });
			try {
				reopened.dispatch({ action: 'newTemplate' });
				expect(reopened.state().templates).toMatchObject({ BASE: 7, DOUBLE: 14 });
			} finally {
				reopened.dispose();
			}
		} finally {
			session.dispose();
		}
	});
});
