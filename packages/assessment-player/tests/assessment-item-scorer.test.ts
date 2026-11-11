import { describe, expect, it } from 'bun:test';
import { createAssessmentItemDefinition } from '@pie-qti/item-player';
import {
	getAssessmentItemIdentifier,
	scoreAssessmentItem,
} from '../src/integration/assessment-item-scorer.js';

const MATCH_CORRECT_ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="scored-choice" title="Scored Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

const RANDOM_TEMPLATE_ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="random-template" title="Random Template" adaptive="false" timeDependent="false">
  <templateDeclaration identifier="ANSWER" cardinality="single" baseType="integer">
    <defaultValue><value>1</value></defaultValue>
  </templateDeclaration>
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <textEntryInteraction responseIdentifier="RESPONSE"/>
  </itemBody>
  <templateProcessing>
    <setTemplateValue identifier="ANSWER">
      <randomInteger min="1" max="2"/>
    </setTemplateValue>
  </templateProcessing>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <variable identifier="ANSWER"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

/** Response processing references an unknown expression: the scorer's engine throws. */
const BROKEN_RESPONSE_PROCESSING_ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="broken-rp" title="Broken Response Processing" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Broken</p></itemBody>
  <responseProcessing><unknownProcessingExpression/></responseProcessing>
</assessmentItem>`;

/** Same engine failure, but the item declares its maximum (SCORE normalMaximum="5"). */
const BROKEN_ITEM_WITH_DECLARED_MAX = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="broken-rp-max" title="Broken, Declared Max" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="5">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Broken with a declared max</p></itemBody>
  <responseProcessing><unknownProcessingExpression/></responseProcessing>
</assessmentItem>`;

describe('assessment item scorer', () => {
	it('extracts the AssessmentItem identifier used in ScoringResult', () => {
		expect(getAssessmentItemIdentifier(MATCH_CORRECT_ITEM)).toBe('scored-choice');
	});

	it('runs ResponseProcessing and maps correct responses into AssessmentScoringResult', () => {
		const result = scoreAssessmentItem({
			itemXml: MATCH_CORRECT_ITEM,
			responses: { RESPONSE: 'A' },
		});

		expect(result.itemIdentifier).toBe('scored-choice');
		expect(result.score).toBe(1);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
		expect(result.outcomeValues.SCORE).toBe(1);
	});

	it('runs ResponseProcessing and maps incorrect responses into AssessmentScoringResult', () => {
		const result = scoreAssessmentItem({
			itemXml: MATCH_CORRECT_ITEM,
			responses: { RESPONSE: 'B' },
		});

		expect(result.itemIdentifier).toBe('scored-choice');
		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(1);
		expect(result.completed).toBe(true);
		expect(result.outcomeValues.SCORE).toBe(0);
	});

	it('scores against restored template variables from serialized item sessions', () => {
		const originalRandom = Math.random;
		try {
			Math.random = () => 0;
			const definition = createAssessmentItemDefinition({ itemXml: RANDOM_TEMPLATE_ITEM });
			const candidateSession = definition.openSession({ responses: { RESPONSE: 1 } });
			expect(candidateSession.state().templates.ANSWER).toBe(1);
			const itemSession = candidateSession.dispatch({ action: 'endAttempt' }).result?.sessionState;
			expect(itemSession).toBeDefined();
			candidateSession.dispose();

			Math.random = () => 0.99;
			const result = scoreAssessmentItem({
				itemXml: RANDOM_TEMPLATE_ITEM,
				responses: { RESPONSE: '1' },
				itemSession: itemSession!,
			});

			expect(result.score).toBe(1);
			expect(result.completed).toBe(true);
		} finally {
			Math.random = originalRandom;
		}
	});

	it('attaches scoringError to the degenerate result when response processing fails', () => {
		const errors: unknown[][] = [];
		const original = console.error;
		console.error = (...args: unknown[]) => errors.push(args);
		let result;
		try {
			result = scoreAssessmentItem({ itemXml: BROKEN_RESPONSE_PROCESSING_ITEM, responses: { RESPONSE: 'A' } });
		} finally {
			console.error = original;
		}
		expect(result.score).toBe(0);
		expect(result.completed).toBe(false);
		expect(result.outcomeValues).toEqual({});
		expect(result.scoringError?.code).toBe('ITEM_SCORING_FAILED');
		expect(result.scoringError?.message).toBeTruthy();
	});

	it('keeps the declared maximum on the degenerate result instead of inventing 1', () => {
		const original = console.error;
		console.error = () => {};
		let result;
		try {
			result = scoreAssessmentItem({ itemXml: BROKEN_ITEM_WITH_DECLARED_MAX, responses: { RESPONSE: 'A' } });
		} finally {
			console.error = original;
		}
		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(5);
		expect(result.scoringError?.code).toBe('ITEM_SCORING_FAILED');
	});

	it('a healthy item result carries no scoringError', () => {
		const result = scoreAssessmentItem({ itemXml: MATCH_CORRECT_ITEM, responses: { RESPONSE: 'A' } });
		expect(result.scoringError).toBeUndefined();
	});
});
