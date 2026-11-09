/**
 * gapMatchInteraction maxAssociations in response validation (QTI 2.2 ASI Table 5.38.3, QTI 3.0
 * Table 5.57.3): a response may make at most maxAssociations associations; 0 means no restriction.
 * An absent attribute is 1 in QTI 2.2 and 3.0. QTI 2.1 has no such attribute, so it sets no cap.
 * A restored or programmatic response over the cap is invalid, so validateResponses rejects it.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';

function item(interactionAttributes: string, namespace = 'http://www.imsglobal.org/xsd/imsqti_v2p2'): string {
	return `<assessmentItem xmlns="${namespace}" identifier="gm-maxima" title="Gap match maxima" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <gapMatchInteraction responseIdentifier="RESPONSE"${interactionAttributes}>
      <gapText identifier="W1" matchMax="0">one</gapText>
      <gapText identifier="W2" matchMax="0">two</gapText>
      <p>A <gap identifier="G1"/>, a <gap identifier="G2"/> and a <gap identifier="G3"/>.</p>
    </gapMatchInteraction>
  </itemBody>
</assessmentItem>`;
}

function errorsFor(itemXml: string, response: unknown): string[] {
	const validation = new Player({ itemXml }).validateResponses({ RESPONSE: response });
	return validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
}

describe.each([
	['QTI 2.2', item(' maxAssociations="2"'), item('')],
	['QTI 3.0', convertQti2ToQti3(item(' maxAssociations="2"')), convertQti2ToQti3(item(''))],
])('gapMatchInteraction maxAssociations (%s)', (_version, cappedItem, defaultItem) => {
	test('accepts up to maxAssociations associations', () => {
		expect(errorsFor(cappedItem, ['W1 G1', 'W2 G2'])).toEqual([]);
	});

	test('rejects more associations than maxAssociations', () => {
		const errors = errorsFor(cappedItem, ['W1 G1', 'W2 G2', 'W1 G3']);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('maxAssociations=2');
	});

	test('an absent maxAssociations allows the spec default of one association', () => {
		expect(errorsFor(defaultItem, ['W1 G1'])).toEqual([]);
		const errors = errorsFor(defaultItem, ['W1 G1', 'W2 G2']);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('maxAssociations=1');
	});

	test('maxAssociations="0" does not restrict', () => {
		expect(errorsFor(item(' maxAssociations="0"'), ['W1 G1', 'W2 G2', 'W1 G3'])).toEqual([]);
	});

	test('ignores NULL, empty and malformed entries', () => {
		expect(errorsFor(cappedItem, null)).toEqual([]);
		expect(errorsFor(cappedItem, [])).toEqual([]);
		expect(errorsFor(cappedItem, ['W1 G1', '', 'W2 G2'])).toEqual([]);
	});

	test('endAttempt with validateResponses rejects a response over the cap and accepts a corrected one', () => {
		const session = createAssessmentItemDefinition({ itemXml: cappedItem }).openSession();
		try {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['W1 G1', 'W2 G2', 'W1 G3'] });
			expect(session.state().canSubmit).toBe(false);
			const rejected = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(rejected?.validation?.valid).toBe(false);
			expect(session.state().numAttempts).toBe(0);

			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['W1 G1', 'W2 G2'] });
			expect(session.state().canSubmit).toBe(true);
			const accepted = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(accepted?.validation?.valid).toBe(true);
			expect(session.state().numAttempts).toBe(1);
		} finally {
			session.dispose();
		}
	});
});

test('QTI 2.1: an absent maxAssociations sets no interaction cap', () => {
	const itemXml = item('', 'http://www.imsglobal.org/xsd/imsqti_v2p1');
	expect(errorsFor(itemXml, ['W1 G1', 'W2 G2', 'W1 G3'])).toEqual([]);
});
