/**
 * graphicGapMatchInteraction `minAssociations` (QTI 2.2; QTI 3.0 `min-associations`): "The minimum
 * number of associations that the candidate is required to make to form a valid response. If
 * min-associations is 0 then the candidate is not required to make any associations." QTI 2.1
 * defines no such attribute on graphicGapMatchInteraction.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';

const item = (attributes: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="ggm-min" title="Graphic gap minimum" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE" maxAssociations="0" ${attributes}>
      <prompt>Label the planets.</prompt>
      <object type="image/png" data="planets.png" width="200" height="100"/>
      <gapText identifier="W1" matchMax="1">Mercury</gapText>
      <gapText identifier="W2" matchMax="1">Venus</gapText>
      <associableHotspot identifier="H1" shape="circle" coords="40,50,20" matchMax="1"/>
      <associableHotspot identifier="H2" shape="circle" coords="140,50,20" matchMax="1"/>
    </graphicGapMatchInteraction>
  </itemBody>
</assessmentItem>`;

const minimumOf = (itemXml: string): number | undefined =>
	(new Player({ itemXml }).getInteractionData()[0] as { minAssociations?: number }).minAssociations;

describe.each([
	['QTI 2.2', item('minAssociations="2"')],
	['QTI 3.0', convertQti2ToQti3(item('minAssociations="2"'))],
])('graphicGapMatchInteraction minAssociations (%s)', (_version, itemXml) => {
	test('the interaction data carries the minimum', () => {
		expect(minimumOf(itemXml)).toBe(2);
	});

	test('a response with fewer associations is incomplete', () => {
		const player = new Player({ itemXml });
		const entry = (value: string[]) => player.validateResponses({ RESPONSE: value }).entries.RESPONSE;
		expect(entry([])).toMatchObject({ required: true, complete: false });
		expect(entry(['W1 H1'])).toMatchObject({ required: true, complete: false });
		expect(entry(['W1 H1', 'W2 H2'])).toMatchObject({ required: true, complete: true });
	});

	test('endAttempt with validateResponses rejects one association and accepts two', () => {
		const session = createAssessmentItemDefinition({ itemXml }).openSession();
		try {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['W1 H1'] });
			const rejected = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(rejected?.validation?.valid).toBe(false);
			expect(rejected?.validation?.issues).toContainEqual(
				expect.objectContaining({ responseId: 'RESPONSE', code: 'incomplete', severity: 'error' }),
			);
			expect(session.state().numAttempts).toBe(0);

			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['W1 H1', 'W2 H2'] });
			const accepted = session.dispatch({ action: 'endAttempt', validateResponses: true }).result;
			expect(accepted?.validation?.valid).toBe(true);
			expect(session.state().numAttempts).toBe(1);
		} finally {
			session.dispose();
		}
	});
});

describe.each([
	['absent', ''],
	['0', 'minAssociations="0"'],
])('graphicGapMatchInteraction minAssociations %s', (_label, attributes) => {
	test.each([
		['QTI 2.2', item(attributes)],
		['QTI 3.0', convertQti2ToQti3(item(attributes))],
	])('%s: no minimum, so the response stays optional', (_version, itemXml) => {
		expect(minimumOf(itemXml)).toBeUndefined();
		const player = new Player({ itemXml });
		expect(player.validateResponses({ RESPONSE: [] }).entries.RESPONSE).toMatchObject({ required: false });
		expect(player.validateResponses({ RESPONSE: ['W1 H1'] }).entries.RESPONSE).toMatchObject({ complete: true });
	});
});
