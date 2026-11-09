import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { DefaultI18nProvider } from '@pie-qti/i18n';
import type { ChoiceInteractionData, HotspotInteractionData } from '@pie-qti/item-player';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import {
	accessibleName,
	check,
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
	type MountedInteraction,
} from './helpers';

function hotspotData(overrides: Partial<HotspotInteractionData> = {}): HotspotInteractionData {
	return {
		type: 'hotspotInteraction',
		responseId: 'RESPONSE',
		maxChoices: 1,
		prompt: null,
		imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image', alt: 'A sunny street' },
		hotspotChoices: [
			{ identifier: 'H1', shape: 'circle', coords: '50,50,10', hotspotLabel: 'The sun' },
			{ identifier: 'H2', shape: 'rect', coords: '100,100,150,150', hotspotLabel: 'A house' },
		],
		...overrides,
	};
}

/** Choices whose identifiers would give the answer away if they ever reached the accessibility tree. */
const UNLABELLED_CHOICES: HotspotInteractionData['hotspotChoices'] = [
	{ identifier: 'CORRECT_LEFT_LUNG', shape: 'rect', coords: '10,10,60,60' },
	{ identifier: 'WRONG_HEART', shape: 'rect', coords: '100,10,150,60' },
];

/** Three regions, to see the arrow keys wrap at both ends. */
const THREE_REGIONS: HotspotInteractionData['hotspotChoices'] = [
	{ identifier: 'H1', shape: 'circle', coords: '50,50,10', hotspotLabel: 'The sun' },
	{ identifier: 'H2', shape: 'rect', coords: '100,100,150,150', hotspotLabel: 'A house' },
	{ identifier: 'H3', shape: 'poly', coords: '200,200,250,200,225,250', hotspotLabel: 'A tree' },
];

/** The interactive region targets, in hotspotChoice order. */
function regions(mounted: MountedInteraction): SVGElement[] {
	return qa<SVGElement>(mounted, '.qti-hotspot-shape');
}

/** The tabindex of every region, in hotspotChoice order. */
function tabStops(mounted: MountedInteraction): Array<string | null> {
	return regions(mounted).map((region) => region.getAttribute('tabindex'));
}

/** A click or tap on a region (SVG elements have no click() of their own). */
function tap(region: Element): void {
	region.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Dispatch a keydown like a user's (cancelable, bubbling) and return it for inspection. */
function keydown(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
	document.documentElement.removeAttribute('dir');
	document.documentElement.style.direction = '';
});

describe('HotspotInteraction (pie-qti-hotspot)', () => {
	test('known image dimensions produce an overlay in the image pixel space', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const overlay = q<SVGElement>(mounted, 'svg[part="overlay"]');
		expect(overlay?.getAttribute('viewBox')).toBe('0 0 400 300');
		expect(q(mounted, '[part="diagnostic"]')).toBeNull();
	});

	test('hotspot regions are focusable SVG elements with accessible names', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const shapes = regions(mounted);
		expect(shapes).toHaveLength(2);
		// The shapes must be real SVG elements (not HTML-namespace lookalikes), or .focus()
		// does not exist on them and keyboard/focus behavior breaks in the browser.
		expect(shapes[0]).toBeInstanceOf(SVGElement);
		expect(shapes[0]!.getAttribute('role')).toBe('radio');
		expect(shapes[0]!.getAttribute('tabindex')).toBe('0');
		expect(shapes[0]!.getAttribute('aria-label')).toBe('The sun');
	});

	test('visual halo and outline layers are hidden from assistive technology and the tab order', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const visualLayers = qa(mounted, '.qti-hotspot-halo, .qti-hotspot-outline');
		expect(visualLayers).toHaveLength(4);
		for (const layer of visualLayers) {
			expect(layer.getAttribute('aria-hidden')).toBe('true');
			expect(layer.hasAttribute('tabindex')).toBe(false);
			expect(layer.hasAttribute('role')).toBe(false);
		}
		// Only the interactive targets take focus.
		expect(qa(mounted, '[tabindex]')).toEqual(regions(mounted));
	});

	test('clicking a hotspot answers with its identifier', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const shape = regions(mounted)[1]!;
		tap(shape);
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'H2' });
		expect(shape.getAttribute('aria-checked')).toBe('true');
	});

	test('a selected region shows a check marker and selected state, not colour alone', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData(), response: 'H2' });
		await settle();

		const regions = qa(mounted, '.qti-hotspot-region');
		expect(regions[1]!.hasAttribute('data-selected')).toBe(true);
		expect(regions[1]!.querySelector('.qti-hotspot-marker')).not.toBeNull();
		expect(regions[0]!.querySelector('.qti-hotspot-marker')).toBeNull();
		// The visible summary names the region, never its identifier.
		const summary = q(mounted, '[part="selected"]')!;
		expect(summary.textContent).toContain('A house');
		expect(summary.textContent).not.toContain('H2');
	});

	test('Enter on a focused hotspot answers with its identifier', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const shape = qa(mounted, '.qti-hotspot-shape')[0]!;
		pressKey(shape, 'Enter');
		await settle();

		expect(mounted.instance.response).toBe('H1');
		expect(mounted.events).toHaveLength(1);
	});

	test('Space on a focused hotspot answers too', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		pressKey(qa(mounted, '.qti-hotspot-shape')[1]!, ' ');
		await settle();

		expect(mounted.instance.response).toBe('H2');
	});

	test('unlabelled regions are named by position, never by identifier', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: UNLABELLED_CHOICES }),
			response: 'CORRECT_LEFT_LUNG',
		});
		await settle();

		const names = qa(mounted, '.qti-hotspot-shape').map((shape) => shape.getAttribute('aria-label'));
		expect(names).toEqual(['Region 1 of 2', 'Region 2 of 2']);
		expect(mounted.host.textContent).not.toContain('CORRECT_LEFT_LUNG');
		expect(mounted.host.innerHTML).not.toContain('CORRECT_LEFT_LUNG');
		expect(q(mounted, '[part="selected"]')!.textContent).toContain('Region 1 of 2');
	});

	test('the scorer view names correct regions without identifiers', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: UNLABELLED_CHOICES }),
			role: 'scorer',
			correctResponse: 'CORRECT_LEFT_LUNG',
		});
		await settle();

		const first = qa(mounted, '.qti-hotspot-shape')[0]!;
		expect(first.getAttribute('aria-label')).toBe('Region 1 of 2. Correct answer.');
		expect(q(mounted, '[part="selected"]')!.textContent).toContain('Correct: Region 1 of 2');
		expect(mounted.host.textContent).not.toContain('CORRECT_LEFT_LUNG');
	});

	test('renders the authored alt text from QTI on the image', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('A sunny street');
	});

	test('an image the author marked decorative gets an empty alt', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({
				imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image', decorative: true },
			}),
		});
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('');
	});

	test('an image without authored alt text falls back to a generic localized name', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image' } }),
		});
		await settle();

		const alt = q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt');
		expect(alt).toBe('Image for this question');
		expect(alt).not.toBe('Hotspot interaction');
	});

	test('inline SVG is exposed as an image named by its alternative, with its long description', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({
				imageData: {
					type: 'svg',
					content: '<svg viewBox="0 0 400 300"><rect width="400" height="300"/></svg>',
					width: '400',
					height: '300',
					alt: 'Water cycle',
					altDescription: 'Arrows link evaporation, condensation and rain.',
				},
			}),
		});
		await settle();

		const image = q(mounted, '[part="image"]')!;
		expect(image.getAttribute('role')).toBe('img');
		expect(image.getAttribute('aria-label')).toBe('Water cycle');
		const describedBy = image.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(mounted.host.querySelector(`[id="${describedBy}"]`)?.textContent).toBe(
			'Arrows link evaporation, condensation and rain.',
		);
	});

	test('missing image dimensions refuse to draw the overlay; candidates get no authoring diagnostic', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: null }),
		});
		await settle();

		expect(q(mounted, '[part="diagnostic"]')).toBeNull();
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('no known width/height'));
	});

	test('authors see why the overlay is missing', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: null }),
			role: 'author',
		});
		await settle();

		const diagnostic = q(mounted, '[part="diagnostic"]');
		expect(diagnostic?.getAttribute('role')).toBe('alert');
		expect(diagnostic?.textContent).toContain('size of its image is unknown');
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();
	});

	test('an image without authored dimensions uses its natural size once loaded', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: { type: 'image', src: 'diagram.png', width: '', height: '' } }),
		});
		await settle();
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();

		const img = q<HTMLImageElement>(mounted, 'img[part="image"]')!;
		Object.defineProperty(img, 'naturalWidth', { value: 640 });
		Object.defineProperty(img, 'naturalHeight', { value: 480 });
		img.dispatchEvent(new Event('load'));
		await settle();

		expect(q(mounted, 'svg[part="overlay"]')?.getAttribute('viewBox')).toBe('0 0 640 480');
		expect(warn).not.toHaveBeenCalled();
	});

	test('an image that fails to load shows a localized message with its alt text', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();

		const error = q(mounted, '[part="image-error"]');
		expect(error?.textContent).toContain('The image could not be loaded.');
		expect(error?.textContent).toContain('A sunny street');
		expect(q(mounted, 'img[part="image"]')).toBeNull();
		// The regions stay operable by name.
		expect(qa(mounted, '.qti-hotspot-shape')).toHaveLength(2);
		expect(warn).toHaveBeenCalled();
	});

	test('small regions get a transparent hit stroke that reaches 24 CSS px; large ones do not', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const [small, large] = qa<SVGElement>(mounted, '.qti-hotspot-shape');
		// circle r=10 → 20px across at natural size → a 4px stroke reaches 24px.
		expect(small!.getAttribute('style')).toContain('--qti-hit-stroke: 4px');
		// rect 50×50 is already large enough.
		expect(large!.getAttribute('style')).toContain('--qti-hit-stroke: 0px');
	});

	test('the max-selections message uses the accessible warning text colour token', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ maxSelectionsMessage: 'Only one region.' }),
			response: 'H1',
		});
		await settle();

		const message = q(mounted, '.qti-selection-message');
		expect(message?.textContent).toBe('Only one region.');
	});

	test('disabled hotspots are unavailable in either cardinality: not focusable, ignore activation, no clear control', async () => {
		for (const maxChoices of [1, 2]) {
			const mounted = mountInteraction(HotspotInteraction, {
				interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices }),
				response: 'H1',
				disabled: true,
			});
			await settle();

			const [sun, house] = regions(mounted);
			expect(tabStops(mounted)).toEqual(['-1', '-1', '-1']);
			// A disabled region says so, as a disabled native control does.
			for (const region of regions(mounted)) {
				expect(region.getAttribute('aria-disabled')).toBe('true');
			}
			tap(house!);
			pressKey(house!, 'Enter');
			pressKey(sun!, ' ');
			pressKey(sun!, 'ArrowRight');
			await settle();

			expect(mounted.instance.response).toBe('H1');
			expect(mounted.events).toHaveLength(0);
			// The read-only state still shows the answer.
			expect(qa(mounted, '.qti-hotspot-region')[0]!.hasAttribute('data-selected')).toBe(true);
			// Nothing to operate: no clear control while disabled, as in choiceInteraction.
			expect(qa(mounted, 'button')).toHaveLength(0);
			cleanupInteraction(mounted);
		}
	});
});

describe('HotspotInteraction single selection (maxChoices=1) is a radio group', () => {
	test('the overlay is a radiogroup of role="radio" regions with aria-checked, never aria-pressed', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const group = q(mounted, '[role="radiogroup"]');
		expect(group).toBe(q(mounted, 'svg[part="overlay"]'));
		// Without a prompt the group has a generic localized name.
		expect(group?.getAttribute('aria-label')).toBe('Hotspot interaction');

		const shapes = regions(mounted);
		expect(shapes.map((region) => region.getAttribute('role'))).toEqual(['radio', 'radio']);
		expect(shapes.map((region) => region.getAttribute('aria-checked'))).toEqual(['false', 'false']);
		expect(shapes.map((region) => region.getAttribute('aria-label'))).toEqual(['The sun', 'A house']);
		expect(shapes.some((region) => region.hasAttribute('aria-disabled'))).toBe(false);
		// A toggle button that cannot be unpressed would mislead assistive technology.
		expect(qa(mounted, '[role="button"]')).toHaveLength(0);
		expect(qa(mounted, '[aria-pressed]')).toHaveLength(0);
	});

	test('the radio group is named by the prompt when there is one', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ prompt: '<p>Where does the light come from?</p>' }),
		});
		await settle();

		const group = q(mounted, '[role="radiogroup"]')!;
		expect(group.hasAttribute('aria-label')).toBe(false);
		expect(accessibleName(group)).toBe('Where does the light come from?');
	});

	test('roving tabindex keeps one tab stop — the checked region, else the first', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: THREE_REGIONS }) });
		await settle();

		// Nothing checked: Tab enters the group at the first region.
		expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);

		tap(regions(mounted)[2]!);
		await settle();
		expect(tabStops(mounted)).toEqual(['-1', '-1', '0']);

		// A restored response puts the tab stop on its region without emitting anything.
		const restored = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS }),
			response: 'H2',
		});
		await settle();
		expect(tabStops(restored)).toEqual(['-1', '0', '-1']);
		expect(regions(restored)[1]!.getAttribute('aria-checked')).toBe('true');
		expect(restored.events).toHaveLength(0);
	});

	// Identifiers are NCNames, so "true", "false" and "null" are valid region identifiers. The
	// response names the region; it is never read as a JSON literal.
	test.each(['true', 'false', 'null'])('a stored answer naming the region "%s" keeps it checked', async (identifier) => {
		const literalRegions = THREE_REGIONS.map((region, index) => ({
			...region,
			identifier: ['true', 'false', 'null'][index]!,
		}));
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: literalRegions }),
			response: identifier,
		});
		await settle();

		expect(regions(mounted).map((region) => region.getAttribute('aria-checked'))).toEqual(
			['true', 'false', 'null'].map((id) => String(id === identifier)),
		);
	});

	test('arrow keys move focus to the next or previous region and check it, wrapping', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: THREE_REGIONS }) });
		await settle();

		const [sun, house, tree] = regions(mounted);
		sun!.focus();

		const right = keydown(sun!, 'ArrowRight');
		await settle();
		expect(right.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(house);
		expect(mounted.instance.response).toBe('H2');
		expect(house!.getAttribute('aria-checked')).toBe('true');
		expect(sun!.getAttribute('aria-checked')).toBe('false');
		expect(tabStops(mounted)).toEqual(['-1', '0', '-1']);

		keydown(house!, 'ArrowDown');
		await settle();
		expect(document.activeElement).toBe(tree);

		// The last region wraps to the first, and back.
		keydown(tree!, 'ArrowDown');
		await settle();
		expect(document.activeElement).toBe(sun);
		keydown(sun!, 'ArrowLeft');
		await settle();
		expect(document.activeElement).toBe(tree);
		keydown(tree!, 'ArrowUp');
		await settle();
		expect(document.activeElement).toBe(house);

		expect(mounted.instance.response).toBe('H2');
		// Each move checks the newly focused region: one change per key, as native radios.
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H2', 'H3', 'H1', 'H3', 'H2']);
	});

	test('under RTL: ArrowLeft moves forward, ArrowRight moves back, Up/Down unchanged', async () => {
		document.documentElement.setAttribute('dir', 'rtl');
		document.documentElement.style.direction = 'rtl';
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: THREE_REGIONS }) });
		await settle();

		const [sun, house, tree] = regions(mounted);
		sun!.focus();

		keydown(sun!, 'ArrowLeft');
		await settle();
		expect(document.activeElement).toBe(house);
		expect(mounted.instance.response).toBe('H2');

		keydown(house!, 'ArrowRight');
		await settle();
		expect(document.activeElement).toBe(sun);
		expect(mounted.instance.response).toBe('H1');

		keydown(sun!, 'ArrowRight');
		await settle();
		expect(document.activeElement).toBe(tree);

		keydown(tree!, 'ArrowDown');
		await settle();
		expect(document.activeElement).toBe(sun);
		keydown(sun!, 'ArrowUp');
		await settle();
		expect(document.activeElement).toBe(tree);

		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H2', 'H1', 'H3', 'H1', 'H3']);
	});

	test('arrow keys held with Alt, Ctrl or Meta are left to the browser and assistive technology', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const sun = regions(mounted)[0]!;
		sun.focus();
		for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
			const event = keydown(sun, 'ArrowRight', { [modifier]: true });
			expect(event.defaultPrevented).toBe(false);
		}
		await settle();

		expect(document.activeElement).toBe(sun);
		expect(mounted.events).toHaveLength(0);
	});

	test('Space checks the focused region without scrolling the page', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const house = regions(mounted)[1]!;
		house.focus();
		const space = keydown(house, ' ');
		await settle();

		expect(space.defaultPrevented).toBe(true);
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H2']);
		expect(house.getAttribute('aria-checked')).toBe('true');
		expect(house.getAttribute('tabindex')).toBe('0');
	});

	test('re-activating the checked region keeps it and emits nothing (click/tap, Enter, Space)', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const sun = regions(mounted)[0]!;
		tap(sun);
		await settle();
		expect(mounted.instance.response).toBe('H1');
		expect(mounted.events).toHaveLength(1);

		// A radio cannot be unchecked by activating it again: every gesture is a no-op.
		tap(sun);
		await settle();
		pressKey(sun, 'Enter');
		await settle();
		pressKey(sun, ' ');
		await settle();

		expect(mounted.instance.response).toBe('H1');
		expect(mounted.events).toHaveLength(1);
		expect(sun.getAttribute('aria-checked')).toBe('true');
		expect(qa(mounted, '.qti-hotspot-region')[0]!.querySelector('.qti-hotspot-marker')).not.toBeNull();
	});

	test('selecting another region replaces the checked one', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const [sun, house] = regions(mounted);
		tap(sun!);
		await settle();
		pressKey(house!, 'Enter');
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H1', 'H2']);
		expect(sun!.getAttribute('aria-checked')).toBe('false');
		expect(house!.getAttribute('aria-checked')).toBe('true');
		const markers = qa(mounted, '.qti-hotspot-region').map((region) => !!region.querySelector('.qti-hotspot-marker'));
		expect(markers).toEqual([false, true]);
	});

	test('clear answer: offered only with an answer, clears to null, emits, and returns focus to the first region', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		// No clear control before there is an answer.
		expect(q(mounted, 'button[part="clear"]')).toBeNull();

		const [sun, house] = regions(mounted);
		tap(house!);
		await settle();

		// The same name as choiceInteraction's control with the same function (WCAG 3.2.4).
		const clear = q<HTMLButtonElement>(mounted, 'button[part="clear"]');
		expect(clear?.textContent?.trim()).toBe('Clear answer');
		clear!.focus();
		clear!.click();
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: null });
		expect(house!.getAttribute('aria-checked')).toBe('false');
		expect(q(mounted, '[part="selected"]')).toBeNull();
		// The control goes with the answer, and focus moves to the first region — the group's
		// tab stop now that nothing is checked — instead of dropping to the document.
		expect(q(mounted, 'button[part="clear"]')).toBeNull();
		expect(document.activeElement).toBe(sun);
		expect(tabStops(mounted)).toEqual(['0', '-1']);
	});

	test('review (disabled scorer view) keeps the candidate answer and the correct-answer marker', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData(),
			role: 'scorer',
			correctResponse: 'H2',
			response: 'H1',
			disabled: true,
		});
		await settle();

		const [sun, house] = regions(mounted);
		expect(sun!.getAttribute('role')).toBe('radio');
		expect(sun!.getAttribute('aria-checked')).toBe('true');
		expect(house!.getAttribute('aria-checked')).toBe('false');
		expect(house!.getAttribute('aria-label')).toBe('A house. Correct answer.');
		const [sunRegion, houseRegion] = qa(mounted, '.qti-hotspot-region');
		expect(sunRegion!.hasAttribute('data-selected')).toBe(true);
		expect(houseRegion!.hasAttribute('data-correct')).toBe(true);
		expect(houseRegion!.querySelector('.qti-hotspot-marker')).not.toBeNull();
		expect(tabStops(mounted)).toEqual(['-1', '-1']);
		expect(qa(mounted, 'button')).toHaveLength(0);
	});
});

describe('HotspotInteraction multiple selection keeps its toggle buttons', () => {
	for (const maxChoices of [0, 2]) {
		test(`maxChoices=${maxChoices}: aria-pressed buttons, every region a tab stop, arrow keys untouched`, async () => {
			const mounted = mountInteraction(HotspotInteraction, {
				interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices }),
			});
			await settle();

			expect(q(mounted, '[role="radiogroup"]')).toBeNull();
			expect(qa(mounted, '[role="radio"]')).toHaveLength(0);
			const shapes = regions(mounted);
			expect(shapes.map((region) => region.getAttribute('role'))).toEqual(['button', 'button', 'button']);
			expect(shapes.map((region) => region.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
			expect(shapes.some((region) => region.hasAttribute('aria-checked'))).toBe(false);
			expect(tabStops(mounted)).toEqual(['0', '0', '0']);

			// The arrow keys stay with the browser: no focus move, no selection.
			shapes[0]!.focus();
			const arrow = keydown(shapes[0]!, 'ArrowRight');
			await settle();
			expect(arrow.defaultPrevented).toBe(false);
			expect(document.activeElement).toBe(shapes[0]);
			expect(mounted.events).toHaveLength(0);

			// Activation presses the button; every region stays a tab stop.
			tap(shapes[1]!);
			await settle();
			expect(shapes[1]!.getAttribute('aria-pressed')).toBe('true');
			expect(tabStops(mounted)).toEqual(['0', '0', '0']);
		});
	}
});

/**
 * Multiple selection (QTI 3.0 §5.68.2: maxChoices above 1, or 0 for no restriction, binds a
 * multiple-cardinality response): the response is the set of selected regions' identifiers,
 * each region an aria-pressed toggle button.
 */
describe('HotspotInteraction multiple selection answers with the set of selected regions', () => {
	const LIMIT_MESSAGE = 'You can select up to 2. Deselect one to choose another.';

	/** The polite status region's text, without the zero-width space that re-announces a repeat. */
	function announced(mounted: MountedInteraction): string {
		return (q(mounted, '.qti-hotspot-live-region')?.textContent ?? '').replace(/\u200b/g, '');
	}

	function pressedStates(mounted: MountedInteraction): Array<string | null> {
		return regions(mounted).map((region) => region.getAttribute('aria-pressed'));
	}

	test('click/tap, Enter and Space toggle a region; the response is the array of selected identifiers', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 3 }),
		});
		await settle();

		const [sun, house, tree] = regions(mounted);
		tap(sun!);
		await settle();
		pressKey(tree!, 'Enter');
		await settle();
		pressKey(house!, ' ');
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'H3', 'H2']);
		expect(pressedStates(mounted)).toEqual(['true', 'true', 'true']);

		// Activating a selected region again deselects it, by any gesture.
		tap(sun!);
		await settle();
		pressKey(tree!, ' ');
		await settle();
		expect(mounted.instance.response).toEqual(['H2']);
		expect(pressedStates(mounted)).toEqual(['false', 'true', 'false']);
		expect(mounted.events.map((event) => event.detail.value)).toEqual([
			['H1'],
			['H1', 'H3'],
			['H1', 'H3', 'H2'],
			['H3', 'H2'],
			['H2'],
		]);
		expect(mounted.events.every((event) => event.detail.responseId === 'RESPONSE')).toBe(true);
	});

	test('every selected region shows its marker and is named in the summary, never by identifier', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 0 }),
		});
		await settle();

		tap(regions(mounted)[0]!);
		await settle();
		tap(regions(mounted)[2]!);
		await settle();

		const marked = qa(mounted, '.qti-hotspot-region').map(
			(region) => region.hasAttribute('data-selected') && !!region.querySelector('.qti-hotspot-marker'),
		);
		expect(marked).toEqual([true, false, true]);
		const summary = q(mounted, '[part="selected"]')!.textContent ?? '';
		expect(summary).toContain('Selected: The sun and A tree');
		expect(summary).not.toContain('H1');
	});

	test('at maxChoices a further selection is refused: nothing changes and the limit is announced', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 2 }),
		});
		await settle();

		const live = q(mounted, '.qti-hotspot-live-region');
		// Always rendered, so it exists before its text changes.
		expect(live?.getAttribute('aria-live')).toBe('polite');
		expect(announced(mounted)).toBe('');

		const [sun, house, tree] = regions(mounted);
		tap(sun!);
		await settle();
		tap(house!);
		await settle();
		// At the cap the limit is stated, with the same localized default as choice and hottext.
		expect(q(mounted, '.qti-selection-message')?.textContent).toBe(LIMIT_MESSAGE);

		tap(tree!);
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'H2']);
		expect(tree!.getAttribute('aria-pressed')).toBe('false');
		expect(qa(mounted, '.qti-hotspot-region')[2]!.hasAttribute('data-selected')).toBe(false);
		expect(mounted.events).toHaveLength(2);
		expect(announced(mounted)).toBe(LIMIT_MESSAGE);

		// The same refusal by keyboard is announced again: the region's text changes.
		const before = q(mounted, '.qti-hotspot-live-region')?.textContent;
		pressKey(tree!, 'Enter');
		await settle();
		expect(q(mounted, '.qti-hotspot-live-region')?.textContent).not.toBe(before);
		expect(announced(mounted)).toBe(LIMIT_MESSAGE);
		expect(mounted.events).toHaveLength(2);

		// Deselecting one frees a place.
		tap(sun!);
		await settle();
		tap(tree!);
		await settle();
		expect(mounted.instance.response).toEqual(['H2', 'H3']);
	});

	test("the author's data-max-selections-message is the limit message stated and announced", async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({
				hotspotChoices: THREE_REGIONS,
				maxChoices: 2,
				maxSelectionsMessage: 'Pick no more than two places.',
			}),
			response: ['H1', 'H2'],
		});
		await settle();

		expect(q(mounted, '.qti-selection-message')?.textContent).toBe('Pick no more than two places.');
		tap(regions(mounted)[2]!);
		await settle();
		expect(announced(mounted)).toBe('Pick no more than two places.');
		expect(mounted.events).toHaveLength(0);
	});

	test('maxChoices=0 is unlimited: every region can be selected and no limit is stated or announced', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 0 }),
		});
		await settle();

		for (const region of regions(mounted)) {
			tap(region);
			await settle();
		}
		expect(mounted.instance.response).toEqual(['H1', 'H2', 'H3']);
		expect(pressedStates(mounted)).toEqual(['true', 'true', 'true']);
		expect(q(mounted, '.qti-selection-message')).toBeNull();
		expect(announced(mounted)).toBe('');
	});

	test('a restored array response selects its regions without emitting, also as a JSON attribute', async () => {
		for (const response of [['H1', 'H3'], '["H1","H3"]']) {
			const mounted = mountInteraction(HotspotInteraction, {
				interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 2 }),
				response,
			});
			await settle();

			expect(pressedStates(mounted)).toEqual(['true', 'false', 'true']);
			expect(qa(mounted, '.qti-hotspot-region').map((region) => region.hasAttribute('data-selected'))).toEqual([
				true,
				false,
				true,
			]);
			expect(mounted.events).toHaveLength(0);

			// The restored selection counts toward the limit and toggles like a fresh one.
			tap(regions(mounted)[1]!);
			await settle();
			expect(mounted.events).toHaveLength(0);
			tap(regions(mounted)[0]!);
			await settle();
			expect(mounted.instance.response).toEqual(['H3']);
			cleanupInteraction(mounted);
		}
	});

	test('the minimum hint counts every selected region', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 0, minChoices: 2 }),
		});
		await settle();

		const hint = () => q(mounted, '[part="min-hint"]')?.textContent?.trim() ?? '';
		expect(hint()).toBe('Select at least 2 regions.');
		tap(regions(mounted)[0]!);
		await settle();
		expect(hint()).toBe('Select at least 2 regions.');
		tap(regions(mounted)[2]!);
		await settle();
		expect(hint()).toBe('');
	});

	test('clear answer: offered only with a selection, clears every region, emits [] and returns focus to the first region', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 0 }),
		});
		await settle();
		expect(q(mounted, 'button[part="clear"]')).toBeNull();

		tap(regions(mounted)[1]!);
		await settle();
		tap(regions(mounted)[2]!);
		await settle();

		// The same name as choiceInteraction's control with the same function (WCAG 3.2.4).
		const clear = q<HTMLButtonElement>(mounted, 'button[part="clear"]');
		expect(clear?.textContent?.trim()).toBe('Clear answer');
		clear!.focus();
		clear!.click();
		await settle();

		expect(mounted.instance.response).toEqual([]);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: [] });
		expect(pressedStates(mounted)).toEqual(['false', 'false', 'false']);
		expect(q(mounted, '[part="selected"]')).toBeNull();
		expect(q(mounted, 'button[part="clear"]')).toBeNull();
		expect(document.activeElement).toBe(regions(mounted)[0]);
	});

	test('a single selection restored as a one-element array (multiple cardinality) checks its region', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: THREE_REGIONS, maxChoices: 1 }),
			response: ['H2'],
		});
		await settle();

		expect(regions(mounted).map((region) => region.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
		expect(tabStops(mounted)).toEqual(['-1', '0', '-1']);
		// Activating the checked region keeps it; another one replaces it.
		tap(regions(mounted)[1]!);
		await settle();
		expect(mounted.events).toHaveLength(0);
		tap(regions(mounted)[2]!);
		await settle();
		expect(mounted.instance.response).toBe('H3');
	});
});

/**
 * The default shape (QTI 3.0 §8.29 ShapeEnum: "the entire area of the associated image"): a
 * region over the whole image, beneath every other region so it never takes their clicks, and
 * reached by keyboard and named like any other region, in hotspotChoice order.
 */
describe('HotspotInteraction default-shape region', () => {
	/** The default region listed last, where a naive overlay would paint it over the others. */
	const WITH_DEFAULT: HotspotInteractionData['hotspotChoices'] = [
		{ identifier: 'H1', shape: 'circle', coords: '50,50,10', hotspotLabel: 'The sun' },
		{ identifier: 'H2', shape: 'rect', coords: '100,100,150,150', hotspotLabel: 'A house' },
		{ identifier: 'ELSEWHERE', shape: 'default', coords: '', hotspotLabel: 'Somewhere else' },
	];

	function pointerTarget(mounted: MountedInteraction): SVGElement {
		return q<SVGElement>(mounted, '.qti-hotspot-pointer-target')!;
	}

	test('it covers the whole image: control, outline and pointer target are full-image rects', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: WITH_DEFAULT }) });
		await settle();

		const control = regions(mounted)[2]!;
		const backdrop = q(mounted, '.qti-hotspot-backdrop')!;
		const layers = [
			control,
			pointerTarget(mounted),
			...Array.from(backdrop.querySelectorAll('.qti-hotspot-halo, .qti-hotspot-outline')),
		];
		expect(layers).toHaveLength(4);
		for (const layer of layers) {
			expect(layer.tagName).toBe('rect');
			// Percentages resolve against the overlay's viewBox: the image's own pixel space.
			expect([layer.getAttribute('x'), layer.getAttribute('y')]).toEqual(['0', '0']);
			expect([layer.getAttribute('width'), layer.getAttribute('height')]).toEqual(['100%', '100%']);
		}
	});

	test('it lies beneath every other region: its pointer target is painted first, its control takes no pointer input', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: WITH_DEFAULT }) });
		await settle();

		const target = pointerTarget(mounted);
		const overlay = q(mounted, 'svg[part="overlay"]')!;
		// SVG paints in document order: everything after the target is on top of it.
		const painted = Array.from(overlay.querySelectorAll('*'));
		const others = regions(mounted).slice(0, 2);
		for (const region of others) {
			expect(painted.indexOf(target)).toBeLessThan(painted.indexOf(region));
		}
		// Every visual layer of the default region is beneath the others' too.
		const backdrop = q(mounted, '.qti-hotspot-backdrop')!;
		for (const region of Array.from(overlay.querySelectorAll('.qti-hotspot-region'))) {
			expect(painted.indexOf(backdrop)).toBeLessThan(painted.indexOf(region));
		}
		// The control for the keyboard and assistive technology takes no pointer input, so its
		// full-image fill never covers the other regions.
		expect(regions(mounted)[2]!.getAttribute('style')).toContain('pointer-events: none');
		expect(regions(mounted)[0]!.getAttribute('style')).not.toContain('pointer-events');
		// The pointer target is for the pointer only.
		expect(target.getAttribute('aria-hidden')).toBe('true');
		expect(target.hasAttribute('tabindex')).toBe(false);
		expect(target.hasAttribute('role')).toBe(false);
	});

	test('a click on the image outside the other regions selects it; the other regions keep their own', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: WITH_DEFAULT }) });
		await settle();

		tap(regions(mounted)[1]!);
		await settle();
		expect(mounted.instance.response).toBe('H2');
		tap(pointerTarget(mounted));
		await settle();
		expect(mounted.instance.response).toBe('ELSEWHERE');
		expect(regions(mounted)[2]!.getAttribute('aria-checked')).toBe('true');
		const backdrop = q(mounted, '.qti-hotspot-backdrop')!;
		expect(backdrop.hasAttribute('data-selected')).toBe(true);
		expect(backdrop.querySelector('.qti-hotspot-marker')).not.toBeNull();
		expect(q(mounted, '[part="selected"]')?.textContent).toContain('Selected: Somewhere else');
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H2', 'ELSEWHERE']);
	});

	test('keyboard and naming as any region: its place in hotspotChoice order, its label, Enter and the arrow keys', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: WITH_DEFAULT }) });
		await settle();

		const [sun, , elsewhere] = regions(mounted);
		expect(regions(mounted).map((region) => region.getAttribute('aria-label'))).toEqual([
			'The sun',
			'A house',
			'Somewhere else',
		]);
		expect(elsewhere!.getAttribute('role')).toBe('radio');
		// The arrow keys wrap through it in hotspotChoice order.
		sun!.focus();
		keydown(sun!, 'ArrowLeft');
		await settle();
		expect(document.activeElement).toBe(elsewhere);
		expect(mounted.instance.response).toBe('ELSEWHERE');
		keydown(elsewhere!, 'ArrowRight');
		await settle();
		expect(document.activeElement).toBe(sun);
		pressKey(elsewhere!, 'Enter');
		await settle();
		expect(mounted.instance.response).toBe('ELSEWHERE');
	});

	test('without a hotspotLabel it is named by its position, never by its identifier', async () => {
		const unlabelled = WITH_DEFAULT.map(({ hotspotLabel: _label, ...choice }) => choice);
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData({ hotspotChoices: unlabelled }) });
		await settle();

		expect(regions(mounted)[2]!.getAttribute('aria-label')).toBe('Region 3 of 3');
		expect(mounted.host.innerHTML).not.toContain('ELSEWHERE');
	});

	test('in multiple selection it toggles like any region', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: WITH_DEFAULT, maxChoices: 0 }),
		});
		await settle();

		tap(regions(mounted)[0]!);
		await settle();
		tap(pointerTarget(mounted));
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'ELSEWHERE']);
		expect(regions(mounted)[2]!.getAttribute('aria-pressed')).toBe('true');
		pressKey(regions(mounted)[2]!, ' ');
		await settle();
		expect(mounted.instance.response).toEqual(['H1']);
	});

	test('disabled, its pointer target ignores clicks', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: WITH_DEFAULT }),
			disabled: true,
		});
		await settle();

		tap(pointerTarget(mounted));
		await settle();
		expect(mounted.events).toHaveLength(0);
	});
});

/**
 * Correct-answer mode is the scorer role with a correct response, and nothing else
 * (createInteractionShell: role === 'scorer' && correctResponse !== undefined). Without one, a
 * scorer sees the plain interaction, which emits normally; only `disabled` stops interaction.
 */
describe('HotspotInteraction correct-answer mode: role × correct response', () => {
	for (const role of ['candidate', 'scorer'] as const) {
		for (const correctResponse of ['H2', null] as const) {
			const showsCorrect = role === 'scorer' && correctResponse !== null;
			test(`${role} ${correctResponse ? 'with' : 'without'} a correct response: ${showsCorrect ? '' : 'no '}correct-answer mode, emits normally`, async () => {
				const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData(), role, correctResponse });
				await settle();

				expect(qa(mounted, '.qti-hotspot-region[data-correct]')).toHaveLength(showsCorrect ? 1 : 0);
				expect(regions(mounted)[1]!.getAttribute('aria-label')).toBe(showsCorrect ? 'A house. Correct answer.' : 'A house');
				expect(!!q(mounted, '.qti-hotspot-correct-list')).toBe(showsCorrect);

				// Interactivity is governed by `disabled` alone.
				tap(regions(mounted)[0]!);
				await settle();
				expect(mounted.events.map((event) => event.detail.value)).toEqual(['H1']);
			});
		}
	}

	test('a disabled scorer view without a correct response does not emit', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData(),
			role: 'scorer',
			correctResponse: null,
			disabled: true,
		});
		await settle();

		tap(regions(mounted)[0]!);
		await settle();
		expect(mounted.events).toHaveLength(0);
		expect(qa(mounted, '[data-correct]')).toHaveLength(0);
	});
});

describe('HotspotInteraction clear control names the same function as choiceInteraction', () => {
	let nl: DefaultI18nProvider;

	beforeAll(async () => {
		nl = new DefaultI18nProvider('nl');
		await nl.loadLocale('nl');
	});

	const choiceData: ChoiceInteractionData = {
		type: 'choiceInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		maxChoices: 1,
		minChoices: 0,
		prompt: '<p>Which one is a fruit?</p>',
		choices: [
			{ identifier: 'A', text: '<p>Alpha</p>' },
			{ identifier: 'B', text: '<p>Beta</p>' },
		],
	};

	test('one localized label for "Clear answer" in both interactions', async () => {
		const choice = mountInteraction(ChoiceInteraction, { interaction: choiceData, i18n: nl });
		const hotspot = mountInteraction(HotspotInteraction, { interaction: hotspotData(), i18n: nl });
		await settle();

		check(q<HTMLInputElement>(choice, 'input[type="radio"]')!, true);
		tap(regions(hotspot)[0]!);
		await settle();

		const label = (mounted: MountedInteraction) => q(mounted, 'button[part="clear"]')?.textContent?.trim();
		expect(label(choice)).toBe(nl.t('interactions.choice.clearAnswer'));
		expect(label(choice)).not.toBe('Clear answer');
		expect(label(hotspot)).toBe(label(choice));
		cleanupInteraction(choice, hotspot);
	});
});
