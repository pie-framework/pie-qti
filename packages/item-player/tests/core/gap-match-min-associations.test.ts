/**
 * gapMatchInteraction `minAssociations` (QTI 2.2; QTI 3.0 §5.57.2 `min-associations`): "The
 * minimum number of associations that the candidate is required to make to form a valid
 * response. If min-associations is 0 then the candidate is not required to make any associations."
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const item = (attributes: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="gap-min" title="Gap minimum" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
  <itemBody>
    <gapMatchInteraction responseIdentifier="RESPONSE" maxAssociations="0" ${attributes}>
      <gapText identifier="W1" matchMax="1">cat</gapText>
      <gapText identifier="W2" matchMax="1">dog</gapText>
      <p>The <gap identifier="G1"/> chased the <gap identifier="G2"/>.</p>
    </gapMatchInteraction>
  </itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', item('minAssociations="2"')],
	['QTI 3.0', convertQti2ToQti3(item('minAssociations="2"'))],
])('gapMatchInteraction minAssociations (%s)', (_version, itemXml) => {
	test('the interaction data carries the minimum', () => {
		const interaction = new Player({ itemXml }).getInteractionData()[0] as { minAssociations?: number };
		expect(interaction.minAssociations).toBe(2);
	});

	test('a response with fewer associations is incomplete', () => {
		const player = new Player({ itemXml });
		const entry = (value: string[]) => player.validateResponses({ RESPONSE: value }).entries.RESPONSE;
		expect(entry([])).toMatchObject({ required: true, complete: false });
		expect(entry(['W1 G1'])).toMatchObject({ required: true, complete: false });
		expect(entry(['W1 G1', 'W2 G2'])).toMatchObject({ required: true, complete: true });
	});
});

test('without minAssociations the response stays optional', () => {
	const player = new Player({ itemXml: item('') });
	expect((player.getInteractionData()[0] as { minAssociations?: number }).minAssociations).toBeUndefined();
	expect(player.validateResponses({ RESPONSE: [] }).entries.RESPONSE).toMatchObject({ required: false });
});
