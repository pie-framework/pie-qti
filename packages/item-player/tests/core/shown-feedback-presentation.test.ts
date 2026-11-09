/**
 * The presentation reports the feedback its body shows (WCAG 4.1.3): the plan is the one place
 * that knows which feedbackInline and feedbackBlock the outcomes select, because it splices them
 * into the body HTML and leaves no marker behind. The player announces this report after the
 * candidate's attempt.
 */

import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

const ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="shown-feedback" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Four</simpleChoice>
			<simpleChoice identifier="B">Five</simpleChoice>
		</choiceInteraction>
		<p><feedbackInline outcomeIdentifier="FEEDBACK" identifier="CORRECT" showHide="show">Well done.</feedbackInline><feedbackInline outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show">Not quite.</feedbackInline></p>
		<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show"><p>Two and two make four.</p></feedbackBlock>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">CORRECT</baseValue></setOutcomeValue>
			</responseIf>
			<responseElse>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">INCORRECT</baseValue></setOutcomeValue>
			</responseElse>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

describe('ItemPresentation.shownFeedback', () => {
	test('reports no feedback before the attempt and the shown feedback, in document order, after it', () => {
		const session = createAssessmentItemDefinition({ itemXml: ITEM }).openSession();
		expect(session.present().shownFeedback).toEqual({ shown: false, text: '' });

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
		session.dispatch({ action: 'endAttempt' });
		expect(session.present().shownFeedback).toEqual({ shown: true, text: 'Not quite. Two and two make four.' });
		session.dispose();
	});

	test('the correct answer reports its own feedback', () => {
		const session = createAssessmentItemDefinition({ itemXml: ITEM }).openSession();
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		session.dispatch({ action: 'endAttempt' });
		expect(session.present().shownFeedback).toEqual({ shown: true, text: 'Well done.' });
		session.dispose();
	});

	test('a session presented with showFeedback="false" reports no feedback', () => {
		const session = createAssessmentItemDefinition({ itemXml: ITEM }).openSession({
			presentation: { showFeedback: false },
		});
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
		session.dispatch({ action: 'endAttempt' });
		expect(session.present().shownFeedback).toEqual({ shown: false, text: '' });
		session.dispose();
	});

	test('a restored, answered session reports the feedback it shows', () => {
		const definition = createAssessmentItemDefinition({ itemXml: ITEM });
		const first = definition.openSession();
		first.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		first.dispatch({ action: 'endAttempt' });
		const saved = first.serialize();
		first.dispose();

		// The report is the body's state; announcing it is the player's decision, which a restore never makes.
		const restored = definition.openSession({ restore: saved });
		expect(restored.present().shownFeedback).toEqual({ shown: true, text: 'Well done.' });
		restored.dispose();
	});
});
