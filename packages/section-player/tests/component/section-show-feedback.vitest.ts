/**
 * A section forwards the item player's standalone `showFeedback`: an item whose session the
 * item player owns (an item ref carrying `responses`) shows its integrated feedback after a
 * submit only when the section opts in, as QTI `itemSessionControl@showFeedback` (default
 * false) governs. The real item player element renders the item.
 */

import { afterEach, describe, expect, test } from 'vitest';
import SectionPlayerSplitPane from '../../src/components/SectionPlayerSplitPane.svelte';
import SectionPlayerVertical from '../../src/components/SectionPlayerVertical.svelte';
import { resolveQtiSectionComposition } from '../../src/composition/resolveQtiSectionComposition.js';
import { mountInto, settle, type Mounted } from './helpers';

const ITEM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="q1" title="Q1" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>Which planet is red?</p>
		<p><feedbackInline outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show">Not quite.</feedbackInline></p>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">CORRECT</baseValue></setOutcomeValue>
			</responseIf>
			<responseElse>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">INCORRECT</baseValue></setOutcomeValue>
			</responseElse>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const mounted: Mounted[] = [];
let assessmentCounter = 0;

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

function composition() {
	assessmentCounter += 1;
	return resolveQtiSectionComposition({
		assessmentId: `show-feedback-${assessmentCounter}`,
		section: {
			identifier: 'section-1',
			itemRefs: [{ identifier: 'q1', title: 'Question one', itemXml: ITEM_XML, responses: { RESPONSE: 'B' } }],
		},
	});
}

type ItemPlayerElement = HTMLElement & { submit(countAttempt?: boolean): unknown };

async function submittedItemText(layout: typeof SectionPlayerVertical, props: Record<string, unknown>): Promise<string> {
	const m = mountInto(layout, { composition: composition(), ...props });
	mounted.push(m);
	const start = Date.now();
	let player: ItemPlayerElement | null = null;
	while (!player?.querySelector('.qti-item-body-content')) {
		if (Date.now() - start > 5000) throw new Error('Timed out waiting for the item to render');
		await settle();
		player = m.host.querySelector<ItemPlayerElement>('pie-qti-item-player');
	}
	expect(player.textContent).toContain('Which planet is red?');
	player.submit();
	await settle();
	return player.querySelector('.qti-item-body-content')?.textContent ?? '';
}

describe('section showFeedback reaches the item player', () => {
	for (const [name, layout] of [
		['vertical', SectionPlayerVertical],
		['split pane', SectionPlayerSplitPane],
	] as const) {
		test(`${name}: showFeedback renders the item's integrated feedback after a submit`, async () => {
			expect(await submittedItemText(layout, { showFeedback: true })).toContain('Not quite.');
		});

		test(`${name}: without showFeedback the feedback stays hidden (the QTI default)`, async () => {
			expect(await submittedItemText(layout, {})).not.toContain('Not quite.');
		});
	}
});
