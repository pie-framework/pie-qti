/**
 * Pins of the "at the limit" rule the selection and association interactions share, before it
 * moves into one helper: a positive limit (maxChoices, maxAssociations, matchMax) refuses past
 * it, 0 is no limit, and the limit message is the author's data-max-selections-message, else
 * a localized default. Choice, hottext and hotspot state an authored message at the cap for any
 * cardinality and the default only where a selection can be refused (above 1); match states
 * only an authored message, at its maxAssociations. The refusals themselves are pinned in each
 * interaction's own suite.
 */
import type {
	ChoiceInteractionData,
	HotspotInteractionData,
	HottextInteractionData,
	MatchInteractionData,
} from '@pie-qti/item-player';
import { afterEach, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import GraphicOrderInteraction from '../../src/plugins/graphic-order/GraphicOrderInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import HottextInteraction from '../../src/plugins/hottext/HottextInteraction.svelte';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import { check, cleanupInteraction, mountInteraction, q, qa, settle } from './helpers';

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

const alertText = (mounted: { host: HTMLElement }) => q(mounted, '[role="alert"]')?.textContent?.trim() ?? null;

describe('choice: limit message', () => {
	const data = (overrides: Partial<ChoiceInteractionData>): ChoiceInteractionData => ({
		type: 'choiceInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		maxChoices: 1,
		prompt: null,
		choices: [
			{ identifier: 'A', text: 'a' },
			{ identifier: 'B', text: 'b' },
			{ identifier: 'C', text: 'c' },
		],
		...overrides,
	});

	test('single selection states no default at the cap', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: data({ maxChoices: 1 }) });
		await settle();
		check(qa<HTMLInputElement>(mounted, 'input[type="radio"]')[0]!, true);
		await settle();
		expect(alertText(mounted)).toBeNull();
		cleanupInteraction(mounted);
	});

	test('maxChoices=0 refuses nothing and states nothing', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: data({ maxChoices: 0 }) });
		await settle();
		for (const input of qa<HTMLInputElement>(mounted, 'input[type="checkbox"]')) {
			check(input, true);
			await settle();
		}
		expect(mounted.instance.response).toEqual(['A', 'B', 'C']);
		expect(alertText(mounted)).toBeNull();
		cleanupInteraction(mounted);
	});

	test('below the cap nothing is stated; at it the authored message is', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: data({ maxChoices: 2, maxSelectionsMessage: 'Two at most.' }),
		});
		await settle();
		const inputs = qa<HTMLInputElement>(mounted, 'input[type="checkbox"]');
		check(inputs[0]!, true);
		await settle();
		expect(alertText(mounted)).toBeNull();
		check(inputs[1]!, true);
		await settle();
		expect(alertText(mounted)).toBe('Two at most.');
		cleanupInteraction(mounted);
	});
});

describe('hottext: limit message', () => {
	const data = (overrides: Partial<HottextInteractionData>): HottextInteractionData => ({
		type: 'hottextInteraction',
		responseId: 'RESPONSE',
		prompt: null,
		maxChoices: 1,
		minChoices: 0,
		contentHtml:
			'<p><hottext identifier="H1">fern</hottext> <hottext identifier="H2">oak</hottext> <hottext identifier="H3">rock</hottext></p>',
		hottextChoices: [{ identifier: 'H1' }, { identifier: 'H2' }, { identifier: 'H3' }],
		...overrides,
	});
	const hottexts = (mounted: { host: HTMLElement }) => qa<HTMLElement>(mounted, 'hottext');

	test('single selection states no default at the cap', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: data({ maxChoices: 1 }) });
		await settle();
		hottexts(mounted)[0]!.click();
		await settle();
		expect(alertText(mounted)).toBeNull();
		cleanupInteraction(mounted);
	});

	test('maxChoices=0 refuses nothing and states nothing', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: data({ maxChoices: 0 }) });
		await settle();
		for (const element of hottexts(mounted)) {
			element.click();
			await settle();
		}
		expect(mounted.instance.response).toEqual(['H1', 'H2', 'H3']);
		expect(alertText(mounted)).toBeNull();
		cleanupInteraction(mounted);
	});

	test('at a cap above 1 the default is stated, and a further selection is refused', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: data({ maxChoices: 2 }) });
		await settle();
		hottexts(mounted)[0]!.click();
		await settle();
		expect(alertText(mounted)).toBeNull();
		hottexts(mounted)[1]!.click();
		await settle();
		expect(alertText(mounted)).toBe('You can select up to 2. Deselect one to choose another.');
		hottexts(mounted)[2]!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'H2']);
		cleanupInteraction(mounted);
	});
});

describe('hotspot: limit message', () => {
	const data = (overrides: Partial<HotspotInteractionData>): HotspotInteractionData => ({
		type: 'hotspotInteraction',
		responseId: 'RESPONSE',
		maxChoices: 1,
		prompt: null,
		imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image', alt: 'A street' },
		hotspotChoices: [
			{ identifier: 'H1', shape: 'circle', coords: '50,50,10', hotspotLabel: 'The sun' },
			{ identifier: 'H2', shape: 'rect', coords: '100,100,150,150', hotspotLabel: 'A house' },
		],
		...overrides,
	});
	const regions = (mounted: { host: HTMLElement }) => qa<SVGElement>(mounted, '.qti-hotspot-shape');

	test('single selection states an authored message at the cap, and no default', async () => {
		const authored = mountInteraction(HotspotInteraction, {
			interaction: data({ maxChoices: 1, maxSelectionsMessage: 'One region only.' }),
		});
		const plain = mountInteraction(HotspotInteraction, { interaction: data({ maxChoices: 1 }) });
		await settle();
		for (const mounted of [authored, plain]) {
			regions(mounted)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
		await settle();
		expect(alertText(authored)).toBe('One region only.');
		expect(alertText(plain)).toBeNull();
		cleanupInteraction(authored, plain);
	});
});

describe('match: limit message and source capacity', () => {
	const data = (overrides: Partial<MatchInteractionData>): MatchInteractionData => ({
		type: 'matchInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		maxAssociations: 1,
		prompt: null,
		sourceSet: [
			{ identifier: 'paris', text: '<p>Paris</p>', matchMax: 1 },
			{ identifier: 'rome', text: '<p>Rome</p>', matchMax: 0 },
		],
		targetSet: [
			{ identifier: 'france', text: '<p>France</p>', matchMax: 1 },
			{ identifier: 'italy', text: '<p>Italy</p>', matchMax: 1 },
		],
		...overrides,
	});
	const message = (mounted: { host: HTMLElement }) => q(mounted, '.qti-selection-message')?.textContent?.trim() ?? null;

	test('only an authored message is stated, and only at maxAssociations', async () => {
		const cases: Array<[Partial<MatchInteractionData>, string[], string | null]> = [
			[{ maxAssociations: 1, maxSelectionsMessage: 'One match only.' }, ['paris france'], 'One match only.'],
			[{ maxAssociations: 2, maxSelectionsMessage: 'Two matches only.' }, ['paris france'], null],
			[{ maxAssociations: 0, maxSelectionsMessage: 'Unused.' }, ['paris france', 'rome italy'], null],
			[{ maxAssociations: 1 }, ['paris france'], null],
		];
		for (const [overrides, response, expected] of cases) {
			const mounted = mountInteraction(MatchInteraction, { interaction: data(overrides), response });
			await settle();
			expect(message(mounted), JSON.stringify(overrides)).toBe(expected);
			if (expected) expect(q(mounted, '.qti-selection-message')?.getAttribute('role')).toBe('alert');
			cleanupInteraction(mounted);
		}
	});

	test('a source at its matchMax stops being draggable; matchMax=0 never does', async () => {
		const mounted = mountInteraction(MatchInteraction, {
			interaction: data({ maxAssociations: 0 }),
			response: ['paris france', 'rome italy'],
		});
		await settle();
		expect(q(mounted, '[data-source-id="paris"]')?.getAttribute('draggable')).toBe('false');
		expect(q(mounted, '[data-source-id="rome"]')?.getAttribute('draggable')).toBe('true');
		cleanupInteraction(mounted);
	});
});

/**
 * The authored selection messages the QTI 3.0 elements define, end to end: real QTI through
 * the extractors delivers the field under its spec name, and the component states it where the
 * refusal or minimum shows. Interactions whose element defines no message (associate, graphic
 * order) state their localized text even when the attribute is authored.
 */
import type { OrderInteractionData } from '@pie-qti/item-player';
import OrderInteraction from '../../src/plugins/order/OrderInteraction.svelte';
import { createAssessmentItemDefinition } from '@pie-qti/item-player';

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
const IMAGE = '<object type="image/png" data="i.png" width="400" height="100"/>';

function delivered(declaration: string, body: string): Record<string, any> {
	const itemXml = `<assessmentItem xmlns="${QTI22}" identifier="messages" adaptive="false" timeDependent="false">
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

describe('authored selection messages, end to end', () => {
	test('order: the authored cap message is announced when an add is refused', async () => {
		const interaction = delivered(
			'cardinality="ordered" baseType="identifier"',
			'<orderInteraction responseIdentifier="RESPONSE" minChoices="1" maxChoices="2" data-max-selections-message="Two stops at most."><simpleChoice identifier="C1">One</simpleChoice><simpleChoice identifier="C2">Two</simpleChoice><simpleChoice identifier="C3">Three</simpleChoice></orderInteraction>',
		);
		expect(interaction.maxSelectionsMessage).toBe('Two stops at most.');
		const mounted = mountInteraction(OrderInteraction, { interaction });
		await settle();
		const add = (id: string) =>
			q<HTMLButtonElement>(mounted, `button[part="pool-add"][data-id="${id}"]`)!.click();
		add('C1');
		await settle();
		add('C2');
		await settle();
		expect(mounted.instance.response).toEqual(['C1', 'C2']);

		add('C3');
		await settle();
		expect(mounted.instance.response).toEqual(['C1', 'C2']);
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent).toContain('Two stops at most.');
		cleanupInteraction(mounted);
	});

	test('order: without an authored message the localized cap refusal shows', async () => {
		const interaction = delivered(
			'cardinality="ordered" baseType="identifier"',
			'<orderInteraction responseIdentifier="RESPONSE" minChoices="1" maxChoices="2"><simpleChoice identifier="C1">One</simpleChoice><simpleChoice identifier="C2">Two</simpleChoice><simpleChoice identifier="C3">Three</simpleChoice></orderInteraction>',
		);
		expect(interaction).not.toHaveProperty('maxSelectionsMessage');
		const mounted = mountInteraction(OrderInteraction, { interaction });
		await settle();
		for (const id of ['C1', 'C2', 'C3']) {
			q<HTMLButtonElement>(mounted, `button[part="pool-add"][data-id="${id}"]`)!.click();
			await settle();
		}
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent).toContain(
			'Your order can hold up to 2 items. Remove one to add another.',
		);
		cleanupInteraction(mounted);
	});

	test('match: the spec attribute name states the authored message at maxAssociations', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="directedPair"',
			'<matchInteraction responseIdentifier="RESPONSE" maxAssociations="1" data-max-selections-message="One match only."><simpleMatchSet><simpleAssociableChoice identifier="S" matchMax="1">s</simpleAssociableChoice></simpleMatchSet><simpleMatchSet><simpleAssociableChoice identifier="T" matchMax="1">t</simpleAssociableChoice></simpleMatchSet></matchInteraction>',
		);
		expect(interaction.maxSelectionsMessage).toBe('One match only.');
		const mounted = mountInteraction(MatchInteraction, { interaction, response: ['S T'] });
		await settle();
		expect(q(mounted, '.qti-selection-message')?.textContent?.trim()).toBe('One match only.');
		cleanupInteraction(mounted);
	});

	test('hottext: the authored minimum message states the badge', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="identifier"',
			'<hottextInteraction responseIdentifier="RESPONSE" maxChoices="2" minChoices="2" data-min-selections-message="Pick both names."><p><hottext identifier="A">a</hottext> <hottext identifier="B">b</hottext></p></hottextInteraction>',
		);
		expect(interaction.minSelectionsMessage).toBe('Pick both names.');
		const mounted = mountInteraction(HottextInteraction, { interaction });
		await settle();
		// The unmet-minimum badge states the authored message instead of the localized
		// "Select at least 2", before and between selections.
		const footer = () => q(mounted, '.qti-hottext-footer')?.textContent ?? '';
		expect(footer()).toContain('Pick both names.');
		expect(footer()).not.toContain('Select at least 2');
		qa<HTMLElement>(mounted, 'hottext')[0]!.click();
		await settle();
		expect(footer()).toContain('Pick both names.');
		qa<HTMLElement>(mounted, 'hottext')[1]!.click();
		await settle();
		expect(footer()).not.toContain('Pick both names.');
		expect(footer()).toContain('Minimum met');
		cleanupInteraction(mounted);
	});

	test('associate: no message is stated from an attribute its element does not define', async () => {
		const interaction = delivered(
			'cardinality="multiple" baseType="pair"',
			'<associateInteraction responseIdentifier="RESPONSE" minAssociations="2" data-min-selections-message="Make two pairs."><simpleAssociableChoice identifier="A" matchMax="1">a</simpleAssociableChoice><simpleAssociableChoice identifier="B" matchMax="1">b</simpleAssociableChoice><simpleAssociableChoice identifier="C" matchMax="1">c</simpleAssociableChoice></associateInteraction>',
		);
		expect(interaction).not.toHaveProperty('minSelectionsMessage');
		const mounted = mountInteraction(AssociateInteraction, { interaction });
		await settle();
		// The localized minimum hint states the requirement, not the authored text.
		expect(q(mounted, '[part="min-hint"]')?.textContent).toBe('Make at least 2 associations.');
		cleanupInteraction(mounted);
	});

	test('graphic order: no message is stated from an attribute its element does not define', async () => {
		const interaction = delivered(
			'cardinality="ordered" baseType="identifier"',
			`<graphicOrderInteraction responseIdentifier="RESPONSE" minChoices="2" data-min-selections-message="Order two stops.">${IMAGE}<hotspotChoice identifier="H1" shape="rect" coords="0,0,90,90"/><hotspotChoice identifier="H2" shape="rect" coords="100,0,190,90"/><hotspotChoice identifier="H3" shape="rect" coords="200,0,290,90"/></graphicOrderInteraction>`,
		);
		expect(interaction).not.toHaveProperty('minSelectionsMessage');
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction });
		await settle();
		// Two of three hotspots makes it a subset order, whose hint names the range;
		// either way the localized text states the requirement, not the authored one.
		expect(q(mounted, '[part="min-hint"]')?.textContent).toBe(
			'Choose between 2 and 3 items and put them in order.',
		);
		cleanupInteraction(mounted);
	});
});
