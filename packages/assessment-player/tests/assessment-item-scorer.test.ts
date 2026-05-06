import { describe, expect, it } from 'bun:test';
import { Player } from '@pie-qti/item-player';
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
			const candidatePlayer = new Player({ itemXml: RANDOM_TEMPLATE_ITEM });
			expect(candidatePlayer.getTemplateVariables().ANSWER).toBe(1);
			candidatePlayer.setResponses({ RESPONSE: 1 });
			const itemSession = candidatePlayer.endAttempt().sessionState;

			Math.random = () => 0.99;
			const result = scoreAssessmentItem({
				itemXml: RANDOM_TEMPLATE_ITEM,
				responses: { RESPONSE: 1 },
				itemSession,
			});

			expect(result.score).toBe(1);
			expect(result.completed).toBe(true);
		} finally {
			Math.random = originalRandom;
		}
	});
});
