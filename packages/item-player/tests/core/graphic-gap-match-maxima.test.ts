/**
 * graphicGapMatchInteraction maxima in response validation (QTI ASI graphicGapMatchInteraction,
 * gapChoice / associableHotspot matchMax): a response may make at most maxAssociations
 * associations, and associate each gap choice (gapText, gapImg) and each hotspot at most its
 * matchMax times; 0 means no restriction. A restored or programmatic response that breaks either
 * is invalid, so validateResponses rejects it at endAttempt and it cannot be submitted.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';

function item(interactionAttributes: string, choices: string): string {
	return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ggm-maxima" title="Graphic gap match maxima" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE"${interactionAttributes}>
      <prompt>Place the labels on the map.</prompt>
      <object type="image/png" data="map.png" width="200" height="200"/>
      ${choices}
    </graphicGapMatchInteraction>
  </itemBody>
</assessmentItem>`;
}

const HOTSPOTS = `<associableHotspot identifier="H1" shape="circle" coords="20,20,10" matchMax="2"/>
      <associableHotspot identifier="H2" shape="circle" coords="60,60,10" matchMax="2"/>
      <associableHotspot identifier="H3" shape="circle" coords="100,100,10" matchMax="1"/>`;

/** maxAssociations="2"; every label and hotspot allows more, so only the interaction limit binds. */
const MAX_ASSOCIATIONS_ITEM = item(
	' maxAssociations="2"',
	`<gapText identifier="T1" matchMax="0">one</gapText>
      <gapText identifier="T2" matchMax="0">two</gapText>
      <gapImg identifier="I1" matchMax="0"><object type="image/png" data="flag.png" width="10" height="10"/></gapImg>
      ${HOTSPOTS.replaceAll('matchMax="1"', 'matchMax="0"').replaceAll('matchMax="2"', 'matchMax="0"')}`,
);

/** No interaction limit; T1 may be used once, T2 any number of times, I1 twice; H3 takes one label. */
const MATCH_MAX_ITEM = item(
	' maxAssociations="0"',
	`<gapText identifier="T1" matchMax="1">one</gapText>
      <gapText identifier="T2" matchMax="0">two</gapText>
      <gapImg identifier="I1" matchMax="2"><object type="image/png" data="flag.png" width="10" height="10"/></gapImg>
      ${HOTSPOTS}`,
);

function errorsFor(itemXml: string, response: unknown): string[] {
	const player = new Player({ itemXml });
	const validation = player.validateResponses({ RESPONSE: response });
	return validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
}

describe.each([
	['QTI 2.2', MAX_ASSOCIATIONS_ITEM, MATCH_MAX_ITEM],
	['QTI 3.0', convertQti2ToQti3(MAX_ASSOCIATIONS_ITEM), convertQti2ToQti3(MATCH_MAX_ITEM)],
])('graphicGapMatchInteraction maxima (%s)', (_version, maxAssociationsItem, matchMaxItem) => {
	test('accepts up to maxAssociations associations', () => {
		expect(errorsFor(maxAssociationsItem, ['T1 H1'])).toEqual([]);
		expect(errorsFor(maxAssociationsItem, ['T1 H1', 'I1 H2'])).toEqual([]);
	});

	test('rejects more associations than maxAssociations', () => {
		const errors = errorsFor(maxAssociationsItem, ['T1 H1', 'T2 H2', 'I1 H3']);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('maxAssociations=2');
	});

	test('accepts each gap choice and hotspot up to its matchMax', () => {
		expect(errorsFor(matchMaxItem, ['T1 H1', 'T2 H1', 'T2 H2', 'I1 H2', 'I1 H3'])).toEqual([]);
	});

	test('rejects a gapText used more often than its matchMax', () => {
		const errors = errorsFor(matchMaxItem, ['T1 H1', 'T1 H2']);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('T1');
		expect(errors[0]).toContain('matchMax=1');
	});

	test('rejects a gapImg used more often than its matchMax', () => {
		const errors = errorsFor(matchMaxItem, ['I1 H1', 'I1 H2', 'I1 H1']);
		expect(errors.some((message) => message.includes('I1') && message.includes('matchMax=2'))).toBe(true);
	});

	test('rejects a hotspot given more labels than its matchMax', () => {
		const errors = errorsFor(matchMaxItem, ['T2 H3', 'I1 H3']);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('H3');
		expect(errors[0]).toContain('matchMax=1');
	});

	test('matchMax 0 and maxAssociations 0 do not restrict', () => {
		expect(errorsFor(matchMaxItem, ['T2 H1', 'T2 H2', 'T2 H1', 'T2 H2'])).toEqual([]);
	});

	test('ignores NULL, empty and malformed entries', () => {
		expect(errorsFor(maxAssociationsItem, null)).toEqual([]);
		expect(errorsFor(maxAssociationsItem, [])).toEqual([]);
		expect(errorsFor(maxAssociationsItem, ['T1 H1', '', 'T2 H2'])).toEqual([]);
		expect(errorsFor(matchMaxItem, ['T1 H1', 'T1'])).toEqual([]);
	});

	test('endAttempt with validateResponses rejects a response over the maxima and accepts a corrected one', () => {
		const session = createAssessmentItemDefinition({ itemXml: maxAssociationsItem }).openSession();
		try {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['T1 H1', 'T2 H2', 'I1 H3'] });
			expect(session.state().canSubmit).toBe(false);

			const rejected = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(rejected?.validation?.valid).toBe(false);
			expect(rejected?.validation?.entries.RESPONSE?.valid).toBe(false);
			expect(rejected?.scoring).toBeUndefined();
			expect(session.state().numAttempts).toBe(0);

			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['T1 H1', 'T2 H2'] });
			expect(session.state().canSubmit).toBe(true);
			const accepted = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(accepted?.validation?.valid).toBe(true);
			expect(session.state().numAttempts).toBe(1);
		} finally {
			session.dispose();
		}
	});
});
