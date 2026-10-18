/**
 * Cross-package bridge: the response a mounted interaction component emits for
 * a candidate's click is exactly the response the QTI response-processing
 * engine scores. This is the seam between the delivered component and the
 * scoring pipeline — if either side changes its contract, this fails.
 */

import { describe, expect, test } from 'vitest';
import { createAssessmentItemDefinition } from '@pie-qti/item-player';
import type { ChoiceInteractionData } from '@pie-qti/item-player';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import { cleanupInteraction, mountInteraction, qa, settle } from './helpers';

// QTI 3.0-style item: a partial-credit choice scored through <mapping>.
const ITEM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:m="http://www.imsglobal.org/xsd/imsqti_v3p0"
  identifier="bridge-partial-credit" title="Partial credit bridge" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <mapping defaultValue="0">
      <mapEntry mapKey="BEST" mappedValue="2"/>
      <mapEntry mapKey="OK" mappedValue="1"/>
    </mapping>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>Which answer is best?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="BEST">The best answer</simpleChoice>
      <simpleChoice identifier="OK">An acceptable answer</simpleChoice>
      <simpleChoice identifier="BAD">A poor answer</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull><variable identifier="RESPONSE"/></isNull>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE"><mapResponse identifier="RESPONSE"/></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

// The interaction payload an item-player extractor produces for the item above.
const INTERACTION: ChoiceInteractionData = {
	type: 'choiceInteraction',
	responseId: 'RESPONSE',
	shuffle: false,
	maxChoices: 1,
	minChoices: 1,
	prompt: '<p>Which answer is best?</p>',
	choices: [
		{ identifier: 'BEST', text: 'The best answer' },
		{ identifier: 'OK', text: 'An acceptable answer' },
		{ identifier: 'BAD', text: 'A poor answer' },
	],
};

const scoreFor = (response: unknown): number | undefined => {
	const session = createAssessmentItemDefinition({ itemXml: ITEM_XML, role: 'scorer' }).openSession({
		responses: { RESPONSE: response },
	});
	try {
		return session.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false }).result
			?.scoring?.outcomeValues?.SCORE as number | undefined;
	} finally {
		session.dispose();
	}
};

describe('component response → response processing bridge', () => {
	test('the qti-change payload from a click scores through the item engine', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: INTERACTION });
		await settle();

		const inputs = qa<HTMLInputElement>(mounted, 'input[type="radio"]');
		inputs[1]!.click(); // "An acceptable answer"
		inputs[1]!.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();

		const emitted = mounted.events.at(-1)!.detail as { responseId: string; value: string };
		expect(emitted.responseId).toBe('RESPONSE');
		expect(emitted.value).toBe('OK');

		// The component's emitted value is the scoring engine's response.
		expect(scoreFor(emitted.value)).toBe(1);

		cleanupInteraction(mounted);
	});

	test('the full-credit choice scores its mapped value', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: INTERACTION });
		await settle();

		const inputs = qa<HTMLInputElement>(mounted, 'input[type="radio"]');
		inputs[0]!.click();
		inputs[0]!.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();

		const emitted = mounted.events.at(-1)!.detail as { value: string };
		expect(scoreFor(emitted.value)).toBe(2);

		cleanupInteraction(mounted);
	});
});
