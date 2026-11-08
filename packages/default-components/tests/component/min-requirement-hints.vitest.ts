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
	GapMatchInteractionData,
	GraphicOrderInteractionData,
	HotspotInteractionData,
	MatchInteractionData,
	OrderInteractionData,
} from '@pie-qti/item-player';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import GapMatchInteraction from '../../src/plugins/gap-match/GapMatchInteraction.svelte';
import GraphicOrderInteraction from '../../src/plugins/graphic-order/GraphicOrderInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
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

	test('the author’s message wins', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData({ minSelectionsMessage: 'Make two pairs.' }),
		});
		await settle();
		expect(hint(mounted)?.textContent).toBe('Make two pairs.');
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
	function orderData(overrides: Partial<OrderInteractionData> = {}): OrderInteractionData {
		return {
			type: 'orderInteraction',
			responseId: 'RESPONSE',
			shuffle: false,
			minChoices: 2,
			maxChoices: 3,
			prompt: '<p>Order the steps.</p>',
			choices: [
				{ identifier: 'S1', text: '<p>First</p>' },
				{ identifier: 'S2', text: '<p>Second</p>' },
				{ identifier: 'S3', text: '<p>Third</p>' },
			],
			...overrides,
		};
	}

	test('states the minimum until the order is given, describing the list', async () => {
		const mounted = mountInteraction(OrderInteraction, { interaction: orderData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Put at least 2 items in order.');
		expect(describedByHint(mounted, q(mounted, '[role="list"]'))).toBe(true);

		clickButton(q(mounted, 'button[aria-label="Confirm this order as your answer"]'));
		await settle();

		expect(mounted.instance.response).toEqual(['S1', 'S2', 'S3']);
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

describe('GraphicOrderInteraction minimum (minChoices)', () => {
	function orderData(overrides: Partial<GraphicOrderInteractionData> = {}): GraphicOrderInteractionData {
		return {
			type: 'graphicOrderInteraction',
			responseId: 'RESPONSE',
			prompt: null,
			imageData: { type: 'image', src: 'strata.png', width: '600', height: '350', alt: 'Rock strata' },
			hotspotChoices: [
				{ identifier: 'A', shape: 'rect', coords: '0,0,100,50', label: 'Bedrock' },
				{ identifier: 'B', shape: 'rect', coords: '0,50,100,100', label: 'Top soil' },
				{ identifier: 'C', shape: 'rect', coords: '0,100,100,150', label: 'Sediment' },
			],
			minChoices: 2,
			...overrides,
		};
	}

	test('states the minimum until the order is given, describing the list', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		expect(hint(mounted)?.textContent).toBe('Put at least 2 items in order.');
		expect(describedByHint(mounted, q(mounted, '[role="list"]'))).toBe(true);

		clickButton(q(mounted, 'button[aria-label="Confirm this order as your answer"]'));
		await settle();

		expect(mounted.instance.response).toEqual(['A', 'B', 'C']);
		expect(hint(mounted)).toBeNull();
	});

	test('the author’s message wins; the localized default follows the catalog', async () => {
		const authored = mountInteraction(GraphicOrderInteraction, {
			interaction: orderData({ minSelectionsMessage: 'Order the layers.' }),
		});
		const dutch = mountInteraction(GraphicOrderInteraction, { interaction: orderData(), i18n: nl });
		await settle();
		expect(hint(authored)?.textContent).toBe('Order the layers.');
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
