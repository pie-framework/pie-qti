/**
 * gap `required` (QTI 2.1 gap; QTI 3.0 §5.55.5): "If true then this gap must be filled by the
 * candidate in order to form a valid response to the interaction." Default false.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const GAP_MATCH_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="gap-required" title="Gap required" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>
  <itemBody>
    <gapMatchInteraction responseIdentifier="RESPONSE">
      <gapText identifier="W1" matchMax="1">cat</gapText>
      <gapText identifier="W2" matchMax="1">dog</gapText>
      <p>The <gap identifier="G1" required="true"/> chased the <gap identifier="G2"/>.</p>
    </gapMatchInteraction>
  </itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2', GAP_MATCH_ITEM],
	['QTI 3.0', convertQti2ToQti3(GAP_MATCH_ITEM)],
])('gapMatchInteraction gap required (%s)', (_version, itemXml) => {
	test('delivers the gaps the candidate must fill', () => {
		const player = new Player({ itemXml });
		const interaction = player.getInteractionData()[0] as { requiredGaps?: string[] };
		expect(interaction.requiredGaps).toEqual(['G1']);
	});

	test('a response that leaves a required gap empty is incomplete', () => {
		const player = new Player({ itemXml });
		const entry = (value: string[]) => player.validateResponses({ RESPONSE: value }).entries.RESPONSE;
		expect(entry([])).toMatchObject({ required: true, complete: false });
		expect(entry(['W2 G2'])).toMatchObject({ required: true, complete: false });
		expect(entry(['W1 G1'])).toMatchObject({ required: true, complete: true });
		expect(entry(['W1 G1', 'W2 G2'])).toMatchObject({ required: true, complete: true });
		expect(player.canSubmitResponses({ RESPONSE: ['W2 G2'] })).toBe(false);
		expect(player.canSubmitResponses({ RESPONSE: ['W1 G1'] })).toBe(true);
	});
});

test('gaps that are not required leave the response optional', () => {
	const player = new Player({ itemXml: GAP_MATCH_ITEM.replace(' required="true"', '') });
	const interaction = player.getInteractionData()[0] as { requiredGaps?: string[] };
	expect(interaction.requiredGaps).toBeUndefined();
	expect(player.validateResponses({ RESPONSE: [] }).entries.RESPONSE).toMatchObject({ required: false });
});
