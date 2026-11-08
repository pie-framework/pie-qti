/**
 * templateConstraint (QTI ASI §10.3) restarts templateProcessing: the effects of a rejected pass
 * are discarded, including a correct response set by setCorrectResponse. Scoring then uses the
 * correct response of the accepted pass — here the declared one, since the accepted pass does not
 * set it.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="constraint-restart" title="Constraint restart" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <templateDeclaration identifier="T" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>
  <templateProcessing>
    <setTemplateValue identifier="T">
      <randomInteger min="1" max="2"/>
    </setTemplateValue>
    <templateCondition>
      <templateIf>
        <match>
          <variable identifier="T"/>
          <baseValue baseType="integer">1</baseValue>
        </match>
        <setCorrectResponse identifier="RESPONSE">
          <baseValue baseType="identifier">B</baseValue>
        </setCorrectResponse>
      </templateIf>
    </templateCondition>
    <templateConstraint>
      <match>
        <variable identifier="T"/>
        <baseValue baseType="integer">2</baseValue>
      </match>
    </templateConstraint>
  </templateProcessing>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** Draws T=1 (rejected) on the first pass and T=2 (accepted) on the second. */
function rejectThenAccept(): () => number {
	const draws = [0, 0.75];
	let index = 0;
	return () => draws[Math.min(index++, draws.length - 1)]!;
}

describe.each([
	['QTI 2.2', ITEM],
	['QTI 3.0', convertQti2ToQti3(ITEM)],
])('templateConstraint restart (%s)', (_version, itemXml) => {
	test('a correct response set by the rejected pass does not survive the restart', () => {
		const player = new Player({ itemXml, rng: rejectThenAccept() });

		expect(player.getTemplateVariables().T).toBe(2);
		expect(player.getCorrectResponse('RESPONSE')).toBe('A');

		player.setResponses({ RESPONSE: 'A' });
		expect(player.processResponses().score).toBe(1);
	});
});
