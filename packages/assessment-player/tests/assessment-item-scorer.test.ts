import { describe, expect, it } from 'bun:test';
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
});
