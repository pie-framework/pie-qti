/**
 * An interaction states an unmet minimum on the question itself (WCAG 3.3.2, 3.3.3): the
 * minChoices / minAssociations / matchMin the response validation enforces before an answer
 * counts as complete. The hint shows while the response falls short and goes once it is met;
 * the author's `data-min-selections-message` wins over the localized default; the answer group
 * names it in `aria-describedby`; and it is announced politely once when a change leaves the
 * minimum unmet, not on every change.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DefaultI18nProvider } from '@pie-qti/i18n';
import type {
	AssociateInteractionData,
	ChoiceInteractionData,
	ExtendedTextInteractionData,
	GapMatchInteractionData,
	GraphicAssociateInteractionData,
	GraphicGapMatchInteractionData,
	GraphicOrderInteractionData,
	HotspotInteractionData,
	HottextInteractionData,
	MatchInteractionData,
	OrderInteractionData,
} from '@pie-qti/item-player';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import ExtendedTextInteraction from '../../src/plugins/extended-text/ExtendedTextInteraction.svelte';
import GapMatchInteraction from '../../src/plugins/gap-match/GapMatchInteraction.svelte';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import GraphicOrderInteraction from '../../src/plugins/graphic-order/GraphicOrderInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import HottextInteraction from '../../src/plugins/hottext/HottextInteraction.svelte';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import OrderInteraction from '../../src/plugins/order/OrderInteraction.svelte';
import { check, cleanupInteraction, type MountedInteraction, mountInteraction, q, qa, settle } from './helpers';

let nl: DefaultI18nProvider;

beforeAll(async () => {
	nl = new DefaultI18nProvider('nl');
	await nl.loadLocale('nl');
});

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

/** The visible hint, or null when none shows. */
function hint(mounted: MountedInteraction): HTMLElement | null {
	return q<HTMLElement>(mounted, '[part="min-hint"]');
}

/** The text of the hint's own polite live region. */
function announcement(mounted: MountedInteraction): string {
	return q(mounted, '.qti-min-hint-live')?.textContent?.trim() ?? '';
}

/** Whether `element` names the visible hint in its `aria-describedby`. */
function describedByHint(mounted: MountedInteraction, element: Element | null | undefined): boolean {
	const id = hint(mounted)?.id;
	if (!id || !element) return false;
	return (element.getAttribute('aria-describedby') ?? '').split(/\s+/).includes(id);
}

/** Counts text changes of the hint's live region: each is one announcement. */
function watchAnnouncements(mounted: MountedInteraction): { readonly count: number; stop(): void } {
	let count = 0;
	const region = q(mounted, '.qti-min-hint-live')!;
	const observer = new MutationObserver((records) => {
		if (records.length > 0 && region.textContent?.trim()) count += 1;
	});
	observer.observe(region, { childList: true, characterData: true, subtree: true });
	return {
		get count() {
			// Deliver what is queued before reading.
			const pending = observer.takeRecords();
			if (pending.length > 0 && region.textContent?.trim()) count += 1;
			return count;
		},
		stop: () => observer.disconnect(),
	};
}

function clickButton(element: Element | null | undefined) {
	(element as HTMLElement | null | undefined)?.click();
}

describe('ChoiceInteraction minimum (minChoices)', () => {
	function choiceData(overrides: Partial<ChoiceInteractionData> = {}): ChoiceInteractionData {
		return {
			type: 'choiceInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			maxChoices: 3,
			minChoices: 2,
			prompt: '<p>Which are planets?</p>',
			choices: [
				{ identifier: 'A', text: '<p>Mars</p>' },
				{ identifier: 'B', text: '<p>Venus</p>' },
				{ identifier: 'C', text: '<p>The Moon</p>' },
			],
			...overrides,
		};
	}

	test('states the minimum while fewer are selected and describes the answer group with it', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		const group = q(mounted, '[role="group"]');
		expect(hint(mounted)?.textContent).toBe('Select at least 2 answers.');
		expect(describedByHint(mounted, group)).toBe(true);

		const inputs = qa<HTMLInputElement>(mounted, 'input[type="checkbox"]');
		check(inputs[0]!, true);
		await settle();
		expect(hint(mounted)?.textContent).toBe('Select at least 2 answers.');

		check(inputs[1]!, true);
		await settle();
		expect(hint(mounted)).toBeNull();
		expect(group?.hasAttribute('aria-describedby')).toBe(false);
	});

	test('keeps an authored description alongside the hint', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ accessibility: { description: 'Two of these orbit the Sun.' } }),
		});
		await settle();

		const ids = (q(mounted, '[role="group"]')?.getAttribute('aria-describedby') ?? '').split(/\s+/);
		expect(ids).toHaveLength(2);
		expect(ids).toContain(hint(mounted)!.id);
	});

	test('the author’s data-min-selections-message wins over the default', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ minSelectionsMessage: 'Pick both planets.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Pick both planets.');
	});

	test('the default comes from the localized catalog, with the plural form of the minimum', async () => {
		const two = mountInteraction(ChoiceInteraction, { interaction: choiceData(), i18n: nl });
		const three = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ minChoices: 3 }),
			i18n: nl,
		});
		await settle();
		expect(hint(two)?.textContent).toBe('Selecteer minimaal 2 antwoorden.');
		expect(hint(three)?.textContent).toBe('Selecteer minimaal 3 antwoorden.');
	});

	// minChoices=1 (the single-choice reading) shows no default hint — the radio affordance
	// already says "pick one" — but an authored message still shows, and validation still
	// enforces the minimum.
	test('minChoices=1 shows no default hint, yet an authored message still shows', async () => {
		const plain = mountInteraction(ChoiceInteraction, { interaction: choiceData({ minChoices: 1 }) });
		const authored = mountInteraction(
			ChoiceInteraction,
			{
				interaction: choiceData({ minChoices: 1, minSelectionsMessage: 'Kies precies één antwoord.' }),
				i18n: nl,
			},
		);
		await settle();
		expect(hint(plain)).toBeNull();
		expect(hint(authored)?.textContent).toBe('Kies precies één antwoord.');
		cleanupInteraction(plain, authored);
	});

	// The delivered path assigns interaction props after the custom element is created, so an
	// authored message read outside a reactive context would be captured as undefined forever
	// and the minChoices=1 authored hint would never render. This regression mounts without
	// the interaction and assigns it afterwards — the production order.
	test('an authored message assigned after mount still shows (late-props delivery path)', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {});
		await settle();
		expect(hint(mounted)).toBeNull();

		mounted.instance.interaction = choiceData({
			minChoices: 1,
			minSelectionsMessage: 'Choose exactly one answer.',
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Choose exactly one answer.');
		cleanupInteraction(mounted);
	});

	test('is announced once when a change leaves the minimum unmet, not on every change or on load', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();
		// On load the hint is the group's description, not an announcement.
		expect(announcement(mounted)).toBe('');
		const announcements = watchAnnouncements(mounted);
		const inputs = qa<HTMLInputElement>(mounted, 'input[type="checkbox"]');

		check(inputs[0]!, true);
		await settle();
		expect(announcement(mounted)).toBe('Select at least 2 answers.');
		expect(announcements.count).toBe(1);

		// Still short: silent.
		check(inputs[0]!, false);
		await settle();
		check(inputs[2]!, true);
		await settle();
		expect(announcements.count).toBe(1);

		// Met, then short again: a new announcement.
		check(inputs[1]!, true);
		await settle();
		expect(announcement(mounted)).toBe('');
		check(inputs[1]!, false);
		await settle();
		expect(announcement(mounted)).toBe('Select at least 2 answers.');
		expect(announcements.count).toBe(2);
		announcements.stop();
	});

	test('shows no hint without a minimum, when disabled, or outside the candidate role', async () => {
		const none = mountInteraction(ChoiceInteraction, { interaction: choiceData({ minChoices: 0 }) });
		const disabled = mountInteraction(ChoiceInteraction, { interaction: choiceData(), disabled: true });
		const scorer = mountInteraction(ChoiceInteraction, { interaction: choiceData(), role: 'scorer' });
		await settle();
		expect([hint(none), hint(disabled), hint(scorer)]).toEqual([null, null, null]);
	});
});

describe('MatchInteraction minimum (minAssociations)', () => {
	function matchData(overrides: Partial<MatchInteractionData> = {}): MatchInteractionData {
		return {
			type: 'matchInteraction',
			responseId: 'MATCH',
			shuffle: false,
			maxAssociations: 2,
			minAssociations: 2,
			prompt: '<p>Match each capital with its country.</p>',
			sourceSet: [
				{ identifier: 'paris', text: '<p>Paris</p>', matchMax: 1 },
				{ identifier: 'rome', text: '<p>Rome</p>', matchMax: 1 },
			],
			targetSet: [
				{ identifier: 'france', text: '<p>France</p>', matchMax: 1 },
				{ identifier: 'italy', text: '<p>Italy</p>', matchMax: 1 },
			],
			...overrides,
		};
	}

	test('states the minimum while there are fewer matches and goes once it is met', async () => {
		const mounted = mountInteraction(MatchInteraction, { interaction: matchData(), response: ['paris france'] });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Make at least 2 matches.');
		expect(describedByHint(mounted, q(mounted, '[part="grid"]'))).toBe(true);

		clickButton(q(mounted, '[data-source-id="rome"]'));
		await settle();
		clickButton(qa(mounted, '[part="target"]')[1]);
		await settle();

		expect(mounted.instance.response).toEqual(['paris france', 'rome italy']);
		expect(hint(mounted)).toBeNull();
		expect(describedByHint(mounted, q(mounted, '[part="grid"]'))).toBe(false);
	});

	test('the author’s message wins', async () => {
		const mounted = mountInteraction(MatchInteraction, {
			interaction: matchData({ minSelectionsMessage: 'Match both capitals.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Match both capitals.');
	});

	test('names the choices short of their matchMin, which validation also enforces', async () => {
		const mounted = mountInteraction(MatchInteraction, {
			interaction: matchData({
				minAssociations: 0,
				sourceSet: [
					{ identifier: 'paris', text: '<p>Paris</p>', matchMax: 1, matchMin: 1 },
					{ identifier: 'rome', text: '<p>Rome</p>', matchMax: 1 },
				],
			}),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Needs more matches: Paris.');

		clickButton(q(mounted, '[data-source-id="paris"]'));
		await settle();
		clickButton(qa(mounted, '[part="target"]')[0]);
		await settle();
		expect(mounted.instance.response).toEqual(['paris france']);
		expect(hint(mounted)).toBeNull();
	});
});

describe('AssociateInteraction minimum (minAssociations)', () => {
	function associateData(overrides: Partial<AssociateInteractionData> = {}): AssociateInteractionData {
		return {
			type: 'associateInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			maxAssociations: 0,
			minAssociations: 2,
			prompt: '<p>Pair each capital with its country.</p>',
			choices: [
				{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 1 },
				{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1 },
				{ identifier: 'B_cap', text: '<p>Rome</p>', matchMax: 1 },
				{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 1 },
			],
			...overrides,
		};
	}

	test('states the minimum while there are fewer associations; each choice is described by it', async () => {
		const mounted = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Make at least 2 associations.');
		const choices = qa<HTMLButtonElement>(mounted, '[part="choice"]');
		expect(choices.every((choice) => describedByHint(mounted, choice))).toBe(true);

		clickButton(choices[0]);
		await settle();
		clickButton(choices[1]);
		await settle();
		expect(hint(mounted)?.textContent).toBe('Make at least 2 associations.');
		expect(announcement(mounted)).toBe('Make at least 2 associations.');

		clickButton(choices[2]);
		await settle();
		clickButton(choices[3]);
		await settle();
		expect(mounted.instance.response).toEqual(['A_cap A_country', 'B_cap B_country']);
		expect(hint(mounted)).toBeNull();
		expect(qa(mounted, '[part="choice"]').some((choice) => describedByHint(mounted, choice))).toBe(false);
	});

	test('the localized default states the requirement; the element defines no authored message', async () => {
		// No QTI version defines a selections message on associateInteraction, so hand-built
		// data carrying one is ignored and the localized hint states the minimum.
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData({ minSelectionsMessage: 'Make two pairs.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Make at least 2 associations.');
	});

	test('names the choices short of their matchMin alongside the association minimum', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData({
				minAssociations: 1,
				choices: [
					{ identifier: 'Red', text: '<p>Red</p>', matchMax: 4, matchMin: 2 },
					{ identifier: 'Apple', text: '<p>Apple</p>', matchMax: 1 },
					{ identifier: 'Cherry', text: '<p>Cherry</p>', matchMax: 1 },
				],
			}),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Make at least 1 association. Needs more associations: Red.');

		const [red, apple, cherry] = qa<HTMLButtonElement>(mounted, '[part="choice"]');
		clickButton(red);
		await settle();
		clickButton(apple);
		await settle();
		// One association made; Red still needs a second.
		expect(hint(mounted)?.textContent).toBe('Needs more associations: Red.');

		clickButton(red);
		await settle();
		clickButton(cherry);
		await settle();
		expect(mounted.instance.response).toEqual(['Red Apple', 'Red Cherry']);
		expect(hint(mounted)).toBeNull();
	});
});

describe('OrderInteraction minimum (minChoices)', () => {
	// minChoices at the choice count is full ordering: every choice is required, so the
	// unmet-minimum hint reads while the response is ungiven and clears once it is committed.
	// (A minChoices below the count is subset ordering; its own limits hint is covered by the
	// order subset tests.)
	function orderData(overrides: Partial<OrderInteractionData> = {}): OrderInteractionData {
		return {
			type: 'orderInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			minChoices: 2,
			maxChoices: 2,
			prompt: '<p>Order the steps.</p>',
			choices: [
				{ identifier: 'S1', text: '<p>First</p>' },
				{ identifier: 'S2', text: '<p>Second</p>' },
			],
			...overrides,
		};
	}

	test('states the minimum until the order is given, describing the list', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: orderData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Put at least 2 items in order.');
		expect(describedByHint(mounted, q(mounted, '[role="list"]'))).toBe(true);

		clickButton(q(mounted, 'button[part="confirm"]'));
		await settle();

		expect(mounted.instance.response).toEqual(['S1', 'S2']);
		expect(hint(mounted)).toBeNull();
		expect(describedByHint(mounted, q(mounted, '[role="list"]'))).toBe(false);
	});

	test('the author’s message wins', async () => {
		const mounted = mountInteraction(OrderInteraction, {
			interaction: orderData({ minSelectionsMessage: 'Put the steps in order.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Put the steps in order.');
	});
});

describe('GapMatchInteraction minimum (matchMin per choice)', () => {
	function gapData(overrides: Partial<GapMatchInteractionData> = {}): GapMatchInteractionData {
		return {
			type: 'gapMatchInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			prompt: null,
			promptText: 'The sky is [GAP:G1] and the grass is [GAP:G2].',
			gapTexts: [
				{ identifier: 'W1', text: 'blue', matchMax: 1, matchMin: 1 },
				{ identifier: 'W2', text: 'green', matchMax: 1, matchMin: 1 },
				{ identifier: 'W3', text: 'red', matchMax: 1 },
			],
			gaps: ['G1', 'G2'],
			...overrides,
		};
	}

	async function place(mounted: MountedInteraction, wordId: string, gapId: string) {
		clickButton(q(mounted, `button[data-word-id="${wordId}"]`));
		await settle();
		clickButton(q(mounted, `button[data-gap-id="${gapId}"]`));
		await settle();
	}

	test('names the choices still to place, describing the word palette, until each is placed', async () => {
		const mounted = mountInteraction(GapMatchInteraction, { interaction: gapData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Still to place in the blanks: blue and green.');
		expect(describedByHint(mounted, q(mounted, '[part="palette"]'))).toBe(true);

		await place(mounted, 'W1', 'G1');
		expect(hint(mounted)?.textContent).toBe('Still to place in the blanks: green.');
		expect(announcement(mounted)).toBe('Still to place in the blanks: green.');

		await place(mounted, 'W2', 'G2');
		expect(mounted.instance.response).toEqual(['W1 G1', 'W2 G2']);
		expect(hint(mounted)).toBeNull();
		expect(describedByHint(mounted, q(mounted, '[part="palette"]'))).toBe(false);
	});

	test('the author’s message wins; choices without matchMin require nothing', async () => {
		const authored = mountInteraction(GapMatchInteraction, {
			interaction: gapData({ minSelectionsMessage: 'Use blue and green.' }),
		});
		const unconstrained = mountInteraction(GapMatchInteraction, {
			interaction: gapData({
				gapTexts: [
					{ identifier: 'W1', text: 'blue', matchMax: 1 },
					{ identifier: 'W2', text: 'green', matchMax: 1 },
				],
				minSelectionsMessage: 'Never shown without a minimum.',
			}),
		});
		await settle();
		expect(hint(authored)?.textContent).toBe('Use blue and green.');
		expect(hint(unconstrained)).toBeNull();
	});
});

describe('HotspotInteraction minimum (minChoices)', () => {
	function hotspotData(overrides: Partial<HotspotInteractionData> = {}): HotspotInteractionData {
		return {
			type: 'hotspotInteraction',
			responseId: 'RESPONSE',
			maxChoices: 1,
			minChoices: 1,
			prompt: null,
			imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image', alt: 'A sunny street' },
			hotspotChoices: [
				{ identifier: 'H1', shape: 'circle', coords: '50,50,10', hotspotLabel: 'The sun' },
				{ identifier: 'H2', shape: 'rect', coords: '100,100,150,150', hotspotLabel: 'A house' },
			],
			...overrides,
		};
	}

	test('states the minimum until a region is selected; each region is described by it', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Select at least 1 region.');
		const regions = qa(mounted, '.qti-hotspot-shape');
		expect(regions).toHaveLength(2);
		expect(regions.every((region) => describedByHint(mounted, region))).toBe(true);

		regions[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(hint(mounted)).toBeNull();
		expect(qa(mounted, '.qti-hotspot-shape').some((region) => region.hasAttribute('aria-describedby'))).toBe(false);
	});

	test('the author’s message wins', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ minSelectionsMessage: 'Choose the sun or the house.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Choose the sun or the house.');
	});
});

describe('HottextInteraction minimum (minChoices)', () => {
	function hottextData(overrides: Partial<HottextInteractionData> = {}): HottextInteractionData {
		return {
			type: 'hottextInteraction',
			responseId: 'RESPONSE',
			prompt: '<p>Click every plant.</p>',
			maxChoices: 3,
			minChoices: 2,
			contentHtml:
				'<p>The <hottext identifier="H1">fern</hottext> and the <hottext identifier="H2">oak</hottext> are plants; a <hottext identifier="H3">rock</hottext> is not.</p>',
			hottextChoices: [{ identifier: 'H1' }, { identifier: 'H2' }, { identifier: 'H3' }],
			...overrides,
		};
	}

	test('states the minimum while fewer are selected and describes the answer group with it', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const group = q(mounted, '[role="group"]');
		expect(hint(mounted)?.textContent).toBe('Select at least 2');
		expect(describedByHint(mounted, group)).toBe(true);

		const spans = qa<HTMLElement>(mounted, 'hottext');
		spans[0]!.click();
		await settle();
		// Still short: the hint stays and keeps describing the group.
		expect(hint(mounted)?.textContent).toBe('Select at least 2');
		expect(describedByHint(mounted, group)).toBe(true);

		spans[1]!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'H2']);
		expect(hint(mounted)).toBeNull();
		expect(group?.hasAttribute('aria-describedby')).toBe(false);

		// Toggling one off leaves the response short again: the hint returns with its description.
		spans[1]!.click();
		await settle();
		expect(hint(mounted)?.textContent).toBe('Select at least 2');
		expect(describedByHint(mounted, group)).toBe(true);
	});

	test('the author’s message wins', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ minSelectionsMessage: 'Select both plants.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Select both plants.');
	});

	test('the default comes from the localized catalog', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData(), i18n: nl });
		await settle();
		expect(hint(mounted)?.textContent).toBe('Selecteer minimaal 2');
	});

	test('is announced once when a change leaves the minimum unmet, not on every change or on load', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();
		// On load the hint is the group's description, not an announcement.
		expect(announcement(mounted)).toBe('');
		const announcements = watchAnnouncements(mounted);
		const spans = qa<HTMLElement>(mounted, 'hottext');

		spans[0]!.click();
		await settle();
		expect(announcement(mounted)).toBe('Select at least 2');
		expect(announcements.count).toBe(1);

		// Still short: silent.
		spans[0]!.click();
		await settle();
		spans[2]!.click();
		await settle();
		expect(announcements.count).toBe(1);

		// Met, then short again: a new announcement.
		spans[1]!.click();
		await settle();
		expect(announcement(mounted)).toBe('');
		spans[1]!.click();
		await settle();
		expect(announcement(mounted)).toBe('Select at least 2');
		expect(announcements.count).toBe(2);
		announcements.stop();
	});

	test('shows no hint without a minimum, when disabled, or outside the candidate role', async () => {
		const none = mountInteraction(HottextInteraction, { interaction: hottextData({ minChoices: 0 }) });
		const disabled = mountInteraction(HottextInteraction, { interaction: hottextData(), disabled: true });
		const scorer = mountInteraction(HottextInteraction, { interaction: hottextData(), role: 'scorer' });
		await settle();
		expect([hint(none), hint(disabled), hint(scorer)]).toEqual([null, null, null]);
		cleanupInteraction(none, disabled, scorer);
	});
});

describe('GraphicOrderInteraction minimum (minChoices)', () => {
	// minChoices at the hotspot count is full ordering: every hotspot is required, so the
	// unmet-minimum hint reads while the response is ungiven and clears once it is committed.
	// (A minChoices below the count is subset ordering; its own limits hint is covered by the
	// graphic-order subset tests.)
	function orderData(overrides: Partial<GraphicOrderInteractionData> = {}): GraphicOrderInteractionData {
		return {
			type: 'graphicOrderInteraction',
			responseId: 'RESPONSE',
			prompt: null,
			imageData: { type: 'image', src: 'strata.png', width: '600', height: '350', alt: 'Rock strata' },
			hotspotChoices: [
				{ identifier: 'A', shape: 'rect', coords: '0,0,100,50', label: 'Bedrock' },
				{ identifier: 'B', shape: 'rect', coords: '0,50,100,100', label: 'Top soil' },
			],
			minChoices: 2,
			maxChoices: 2,
			...overrides,
		};
	}

	test('states the minimum until the order is given, describing the list', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Put at least 2 items in order.');
		expect(describedByHint(mounted, q(mounted, '[role="list"]'))).toBe(true);

		clickButton(q(mounted, 'button[part="confirm-button"]'));
		await settle();

		expect(mounted.instance.response).toEqual(['A', 'B']);
		expect(hint(mounted)).toBeNull();
	});

	test('the localized default states the requirement and follows the catalog', async () => {
		// No QTI version defines a selections message on graphicOrderInteraction, so hand-built
		// data carrying one is ignored and the localized hint states the minimum.
		const authored = mountInteraction(GraphicOrderInteraction, {
			interaction: orderData({ minSelectionsMessage: 'Order the layers.' }),
		});
		const dutch = mountInteraction(GraphicOrderInteraction, { interaction: orderData(), i18n: nl });
		await settle();
		expect(hint(authored)?.textContent).toBe('Put at least 2 items in order.');
		expect(hint(dutch)?.textContent).toBe('Zet minimaal 2 items in volgorde.');
	});
});

describe('the hint’s presentation', () => {
	test('draws in the warning-text token with logical spacing, the live region visually hidden', () => {
		const source = readFileSync(
			resolve(__dirname, '../../src/shared/components/MinimumRequirementHint.svelte'),
			'utf8',
		);
		const style = source.slice(source.indexOf('<style>'));
		expect(style).toContain('color: var(--pie-qti-warning-text, #92400e);');
		expect(style).toContain('margin-block: 0.5rem 0;');
		expect(style).not.toMatch(/(?:margin|padding)-(?:top|bottom|left|right)\s*:/);
		expect(source).toContain('aria-live="polite"');
	});
});
describe('GraphicAssociateInteraction minimum (minAssociations and matchMin per hotspot)', () => {
	function graphicAssociateData(
		overrides: Partial<GraphicAssociateInteractionData> = {},
	): GraphicAssociateInteractionData {
		return {
			type: 'graphicAssociateInteraction',
			responseId: 'RESPONSE',
			prompt: null,
			maxAssociations: 4,
			minAssociations: 1,
			imageData: { type: 'svg', content: '<svg/>', width: '100', height: '50' },
			associableHotspots: [
				{ identifier: 'H1', shape: 'rect', coords: '0,0,40,20', matchMax: 2, matchMin: 1, label: 'Heart' },
				{ identifier: 'H2', shape: 'rect', coords: '50,0,90,20', matchMax: 2, label: 'Pump' },
			],
			...overrides,
		};
	}

	test('states the association minimum and the hotspots short of their matchMin', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, { interaction: graphicAssociateData() });
		await settle();

		// Heart needs one association (matchMin 1) on top of the interaction minimum.
		expect(hint(mounted)?.textContent).toBe('Make at least 1 association. Needs more associations: Heart.');

		const hotspots = qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]');
		hotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		hotspots[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toEqual(['H1 H2']);
		expect(hint(mounted)).toBeNull();
	});

});

describe('GraphicGapMatchInteraction minimum (matchMin per label)', () => {
	function graphicGapMatchData(
		overrides: Partial<GraphicGapMatchInteractionData> = {},
	): GraphicGapMatchInteractionData {
		return {
			type: 'graphicGapMatchInteraction',
			responseId: 'RESPONSE',
			prompt: null,
			maxAssociations: 2,
			imageData: {
				type: 'image',
				src: 'cycle.png',
				width: '600',
				height: '200',
				alt: 'The water cycle over a lake',
			},
			gapTexts: [
				{ identifier: 'RAIN', text: 'Rain', matchMax: 1, matchMin: 1 },
				{ identifier: 'SUN', text: 'Sun', matchMax: 1 },
			],
			gapImages: [],
			hotspots: [
				{ identifier: 'TOP_RIGHT', shape: 'circle', coords: '300,50,8', matchMax: 1 },
				{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1 },
			],
			...overrides,
		};
	}

	function hotspotTargets(mm: MountedInteraction): Element[] {
		return qa(mm, '.qti-ggm-hotspot');
	}

	test('names the labels still to place, describing the label palette, until placed', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: graphicGapMatchData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Still to place on the hotspots: Rain.');
		expect(describedByHint(mounted, q(mounted, '[part="labels"]'))).toBe(true);

		// Keyboard placement: pick Rain up, drop it on the first hotspot (an SVG shape,
		// so the click is dispatched rather than .click()).
		clickButton(qa(mounted, '[part="labels"] button').find((button) => button.textContent?.trim() === 'Rain'));
		await settle();
		hotspotTargets(mounted)[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toEqual(['RAIN TOP_RIGHT']);
		expect(hint(mounted)).toBeNull();
		expect(describedByHint(mounted, q(mounted, '[part="labels"]'))).toBe(false);
	});

	test('the author’s data-min-selections-message wins', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, {
			interaction: graphicGapMatchData({ minSelectionsMessage: 'Put the rain on the lake.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Put the rain on the lake.');
	});
});

describe('ExtendedTextInteraction minimum (minStrings)', () => {
	function extendedTextData(
		overrides: Partial<ExtendedTextInteractionData> = {},
	): ExtendedTextInteractionData {
		return {
			type: 'extendedTextInteraction',
			responseId: 'RESPONSE',
			cardinality: 'multiple',
			base: 10,
			baseType: 'string',
			minStrings: 2,
			maxStrings: 3,
			expectedLines: 0,
			expectedLength: 0,
			prompt: '<p>Name two things.</p>',
			placeholderText: '',
			format: 'plain',
			...overrides,
		};
	}

	test('states the minimum while fewer fields hold responses, and refuses removal below it', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, { interaction: extendedTextData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Write at least 2 responses.');

		// Both fields are required: removing the second refuses and keeps the field.
		const removeButtons = qa(mounted, 'button[part="remove-string"]');
		expect(removeButtons).toHaveLength(2);
		clickButton(removeButtons[1]);
		await settle();

		expect(qa(mounted, 'textarea')).toHaveLength(2);
		expect(q(mounted, '[part="announcer"]')?.textContent).toContain('at least 2 responses are required');
		expect(hint(mounted)?.textContent).toBe('Write at least 2 responses.');

		// Filling both fields meets the minimum: the hint goes. Removal at the minimum
		// would still fall below it, so removal only opens up past the minimum.
		const textareas = qa(mounted, 'textarea');
		textareas[0].value = 'clouds';
		textareas[0].dispatchEvent(new Event('input', { bubbles: true }));
		textareas[1].value = 'rain';
		textareas[1].dispatchEvent(new Event('input', { bubbles: true }));
		await settle();

		expect(hint(mounted)).toBeNull();
		clickButton(qa(mounted, 'button[part="remove-string"]')[1]);
		await settle();
		expect(qa(mounted, 'textarea')).toHaveLength(2);
		expect(q(mounted, '[part="announcer"]')?.textContent).toContain('at least 2 responses are required');

		// A third response leaves room to remove one again.
		clickButton(q(mounted, 'button[part="add-string"]'));
		await settle();
		expect(qa(mounted, 'textarea')).toHaveLength(3);
		clickButton(qa(mounted, 'button[part="remove-string"]')[2]);
		await settle();
		expect(qa(mounted, 'textarea')).toHaveLength(2);
		expect(q(mounted, '[part="announcer"]')?.textContent).toContain('Response 3 removed.');
	});

	test('describes each field with the hint while the minimum is unmet, and drops it once met', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, { interaction: extendedTextData() });
		await settle();

		const textareas = qa<HTMLTextAreaElement>(mounted, 'textarea');
		expect(textareas.length).toBe(2);
		expect(textareas.every((field) => describedByHint(mounted, field))).toBe(true);

		// Still short with one field filled: the fields keep the description.
		textareas[0]!.value = 'clouds';
		textareas[0]!.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		expect(qa<HTMLTextAreaElement>(mounted, 'textarea').every((field) => describedByHint(mounted, field))).toBe(true);

		textareas[1]!.value = 'rain';
		textareas[1]!.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();
		expect(hint(mounted)).toBeNull();
		expect(qa(mounted, 'textarea').some((field) => field.hasAttribute('aria-describedby'))).toBe(false);
	});

	test('the hint joins the field’s counter description, it does not replace it', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, {
			interaction: extendedTextData({ expectedLength: 40, interactionClasses: ['qti-counter-up'] }),
		});
		await settle();

		const field = qa<HTMLTextAreaElement>(mounted, 'textarea')[0]!;
		const ids = (field.getAttribute('aria-describedby') ?? '').split(/\s+/);
		expect(ids).toHaveLength(2);
		expect(ids).toContain(hint(mounted)!.id);
		expect(ids).toContain(q(mounted, '[part="counter"]')!.id);
	});

	test('without a minimum the single response clears without a refusal', async () => {
		const mounted = mountInteraction(ExtendedTextInteraction, {
			interaction: extendedTextData({ minStrings: 0, maxStrings: 1 }),
		});
		await settle();

		expect(hint(mounted)).toBeNull();
		clickButton(q(mounted, 'button[part="remove-string"]'));
		await settle();
		// The only field resets to empty; no refusal, no hint.
		expect(qa(mounted, 'textarea')).toHaveLength(1);
		expect((q(mounted, 'textarea') as HTMLTextAreaElement).value).toBe('');
		expect(hint(mounted)).toBeNull();
	});
});
