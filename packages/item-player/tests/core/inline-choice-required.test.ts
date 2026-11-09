/**
 * inlineChoiceInteraction `required` (QTI 2.1; QTI 3.0 §5.74.2): "If 'true' then a choice must be
 * selected by the candidate in order to form a valid response to the interaction." QTI 3.0 adds
 * `min-choices` (§5.74.3): "The minimum number of choices that the candidate is required to select
 * to form a valid response."
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const item = (attributes: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="inline-required" title="Inline required" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p>The capital of France is
      <inlineChoiceInteraction responseIdentifier="RESPONSE" ${attributes}>
        <inlineChoice identifier="A">Paris</inlineChoice>
        <inlineChoice identifier="B">Lyon</inlineChoice>
      </inlineChoiceInteraction>.</p>
  </itemBody>
</assessmentItem>`;

describe.each([
	['QTI 2.2 required', item('required="true"')],
	['QTI 3.0 required', convertQti2ToQti3(item('required="true"'))],
	['QTI 3.0 min-choices', convertQti2ToQti3(item('minChoices="1"'))],
])('inlineChoiceInteraction that requires a choice (%s)', (_version, itemXml) => {
	test('an unanswered dropdown is incomplete; a chosen one is complete', () => {
		const player = new Player({ itemXml });
		const entry = (value: unknown) => player.validateResponses({ RESPONSE: value }).entries.RESPONSE;
		expect(entry(null)).toMatchObject({ required: true, complete: false });
		expect(entry('')).toMatchObject({ required: true, complete: false });
		expect(entry('A')).toMatchObject({ required: true, complete: true });
		expect(player.canSubmitResponses({ RESPONSE: null })).toBe(false);
		expect(player.canSubmitResponses({ RESPONSE: 'B' })).toBe(true);
	});

	test('the interaction data carries the minimum', () => {
		const interaction = new Player({ itemXml }).getInteractionData()[0] as { minChoices?: number };
		expect(interaction.minChoices).toBe(1);
	});
});

test('a dropdown that does not require a choice may stay unanswered', () => {
	const player = new Player({ itemXml: item('') });
	expect(player.validateResponses({ RESPONSE: null }).entries.RESPONSE).toMatchObject({ required: false });
	expect((player.getInteractionData()[0] as { minChoices?: number }).minChoices).toBeUndefined();
});
