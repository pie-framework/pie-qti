/**
 * One capacity rule for every interaction: only a positive limit restricts, and the limit
 * message is the author's when it has text. Malformed content used to read differently per
 * interaction: a non-numeric maxChoices/maxAssociations/matchMax (delivered as NaN) refused
 * everything in hottext, position object and graphic associate and stopped a match source from
 * dragging, while every other interaction read it as no restriction; and a blank authored
 * data-max-selections-message showed an empty alert in choice, hottext, hotspot and match where
 * gap match and graphic gap match fell back to the localized default. Each case starts from real
 * QTI through the item-player extractors.
 */
import { createAssessmentItemDefinition } from '@pie-qti/item-player';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import HottextInteraction from '../../src/plugins/hottext/HottextInteraction.svelte';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import PositionObjectInteraction from '../../src/plugins/position-object/PositionObjectInteraction.svelte';
import { check, cleanupInteraction, mountInteraction, q, qa, settle } from './helpers';

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
const IMAGE = '<object type="image/png" data="i.png" width="400" height="100"/>';

function delivered(declaration: string, body: string): Record<string, any> {
	const itemXml = `<assessmentItem xmlns="${QTI22}" identifier="rule" adaptive="false" timeDependent="false">
		<responseDeclaration identifier="RESPONSE" ${declaration}/>
		<itemBody>${body}</itemBody>
	</assessmentItem>`;
	const session = createAssessmentItemDefinition({ itemXml }).openSession();
	try {
		const node = session.present().flow.find((entry) => entry.kind === 'interaction');
		if (!node || node.kind !== 'interaction') throw new Error('no interaction delivered');
		return node.mount.interaction as Record<string, any>;
	} finally {
		session.dispose();
	}
}

const click = (element: Element | null | undefined) => element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const alertText = (mounted: { host: HTMLElement }) => q(mounted, '[role="alert"]')?.textContent ?? null;

describe('a limit that is not a number restricts nothing', () => {
	test('hottext: maxChoices="any" lets every hottext be selected', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="identifier"',
			'<hottextInteraction responseIdentifier="RESPONSE" maxChoices="any"><p><hottext identifier="A">a</hottext> <hottext identifier="B">b</hottext></p></hottextInteraction>',
		);
		expect(interaction.maxChoices).toBeNaN();
		const mounted = mountInteraction(HottextInteraction, { interaction });
		await settle();
		for (const element of qa<HTMLElement>(mounted, 'hottext')) {
			element.click();
			await settle();
		}
		expect(mounted.instance.response).toEqual(['A', 'B']);
		cleanupInteraction(mounted);
	});

	test('position object: maxChoices="any" lets the object be placed', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="point"',
			`<positionObjectStage>${IMAGE}<positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="any"><object type="image/png" data="o.png" width="20" height="20"/></positionObjectInteraction></positionObjectStage>`,
		);
		expect(interaction.maxChoices).toBeNaN();
		const mounted = mountInteraction(PositionObjectInteraction, { interaction });
		await settle();
		q<HTMLElement>(mounted, '[part="palette-item"]')!.click();
		await settle();
		const canvas = q<HTMLElement>(mounted, '[part="canvas"]')!;
		vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
			left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100, x: 0, y: 0, toJSON: () => ({}),
		} as DOMRect);
		canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 50 }));
		await settle();
		expect(mounted.instance.response).toEqual(['200 50']);
		cleanupInteraction(mounted);
	});

	test('graphic associate: maxAssociations="any" lets associations form', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="pair"',
			`<graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="any">${IMAGE}<associableHotspot identifier="H1" shape="rect" coords="0,0,90,90" matchMax="0"/><associableHotspot identifier="H2" shape="rect" coords="100,0,190,90" matchMax="0"/></graphicAssociateInteraction>`,
		);
		expect(interaction.maxAssociations).toBeNaN();
		const mounted = mountInteraction(GraphicAssociateInteraction, { interaction });
		await settle();
		const hotspots = qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]');
		click(hotspots[0]);
		await settle();
		click(hotspots[1]);
		await settle();
		expect(mounted.instance.response).toEqual(['H1 H2']);
		cleanupInteraction(mounted);
	});

	test('match: a source with matchMax="any" stays draggable', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="directedPair"',
			'<matchInteraction responseIdentifier="RESPONSE" maxAssociations="0"><simpleMatchSet><simpleAssociableChoice identifier="S" matchMax="any">s</simpleAssociableChoice></simpleMatchSet><simpleMatchSet><simpleAssociableChoice identifier="T1" matchMax="1">t1</simpleAssociableChoice><simpleAssociableChoice identifier="T2" matchMax="1">t2</simpleAssociableChoice></simpleMatchSet></matchInteraction>',
		);
		expect(interaction.sourceSet[0].matchMax).toBeNaN();
		const mounted = mountInteraction(MatchInteraction, { interaction, response: ['S T1'] });
		await settle();
		expect(q(mounted, '[data-source-id="S"]')?.getAttribute('draggable')).toBe('true');
		cleanupInteraction(mounted);
	});
});

describe('a blank authored limit message falls back to the default', () => {
	const choiceBody = (maxChoices: number, message: string) =>
		`<choiceInteraction responseIdentifier="RESPONSE" maxChoices="${maxChoices}" data-max-selections-message="${message}"><simpleChoice identifier="A">a</simpleChoice><simpleChoice identifier="B">b</simpleChoice><simpleChoice identifier="C">c</simpleChoice></choiceInteraction>`;

	test('choice: the default at a cap above 1; nothing for a single selection; an authored message trimmed', async () => {
		const multiple = mountInteraction(ChoiceInteraction, {
			interaction: delivered('cardinality="multiple" baseType="identifier"', choiceBody(2, '   ')),
		});
		const single = mountInteraction(ChoiceInteraction, {
			interaction: delivered('cardinality="single" baseType="identifier"', choiceBody(1, '   ')),
		});
		const padded = mountInteraction(ChoiceInteraction, {
			interaction: delivered('cardinality="multiple" baseType="identifier"', choiceBody(2, ' Two at most. ')),
		});
		await settle();
		for (const mounted of [multiple, padded]) {
			const inputs = qa<HTMLInputElement>(mounted, 'input[type="checkbox"]');
			check(inputs[0]!, true);
			check(inputs[1]!, true);
		}
		check(qa<HTMLInputElement>(single, 'input[type="radio"]')[0]!, true);
		await settle();
		expect(alertText(multiple)).toBe('You can select up to 2. Deselect one to choose another.');
		expect(alertText(single)).toBeNull();
		expect(alertText(padded)).toBe('Two at most.');
		cleanupInteraction(multiple, single, padded);
	});

	test('hottext: the default at a cap above 1; nothing for a single selection', async () => {
		const body = (maxChoices: number) =>
			`<hottextInteraction responseIdentifier="RESPONSE" maxChoices="${maxChoices}" data-max-selections-message="  "><p><hottext identifier="A">a</hottext> <hottext identifier="B">b</hottext></p></hottextInteraction>`;
		const multiple = mountInteraction(HottextInteraction, { interaction: delivered('cardinality="multiple" baseType="identifier"', body(2)) });
		const single = mountInteraction(HottextInteraction, { interaction: delivered('cardinality="single" baseType="identifier"', body(1)) });
		await settle();
		for (const element of qa<HTMLElement>(multiple, 'hottext')) element.click();
		qa<HTMLElement>(single, 'hottext')[0]!.click();
		await settle();
		expect(alertText(multiple)).toBe('You can select up to 2. Deselect one to choose another.');
		expect(alertText(single)).toBeNull();
		cleanupInteraction(multiple, single);
	});

	test('hotspot: the default is stated and announced at a cap above 1; nothing for a single selection', async () => {
		const body = (maxChoices: number) =>
			`<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="${maxChoices}" data-max-selections-message=" ">${IMAGE}<hotspotChoice identifier="H1" shape="rect" coords="0,0,90,90"/><hotspotChoice identifier="H2" shape="rect" coords="100,0,190,90"/><hotspotChoice identifier="H3" shape="rect" coords="200,0,290,90"/></hotspotInteraction>`;
		const multiple = mountInteraction(HotspotInteraction, { interaction: delivered('cardinality="multiple" baseType="identifier"', body(2)) });
		const single = mountInteraction(HotspotInteraction, { interaction: delivered('cardinality="single" baseType="identifier"', body(1)) });
		await settle();
		for (const region of qa(multiple, '.qti-hotspot-shape')) {
			click(region);
			await settle();
		}
		click(qa(single, '.qti-hotspot-shape')[0]);
		await settle();
		const expected = 'You can select up to 2. Deselect one to choose another.';
		expect(alertText(multiple)).toBe(expected);
		expect(q(multiple, '[aria-live="polite"]')?.textContent).toBe(expected);
		expect(alertText(single)).toBeNull();
		cleanupInteraction(multiple, single);
	});

	test('match: a blank authored message states nothing at maxAssociations', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="directedPair"',
			'<matchInteraction responseIdentifier="RESPONSE" maxAssociations="1" data-qti-max-selections-message="  "><simpleMatchSet><simpleAssociableChoice identifier="S" matchMax="1">s</simpleAssociableChoice></simpleMatchSet><simpleMatchSet><simpleAssociableChoice identifier="T" matchMax="1">t</simpleAssociableChoice></simpleMatchSet></matchInteraction>',
		);
		const mounted = mountInteraction(MatchInteraction, { interaction, response: ['S T'] });
		await settle();
		expect(q(mounted, '.qti-selection-message')).toBeNull();
		cleanupInteraction(mounted);
	});
});
