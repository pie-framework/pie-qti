import type { GraphicGapMatchInteractionData } from '@pie-qti/item-player';
import { afterEach, describe, expect, test, vi } from 'vitest';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import { cleanupInteraction, mountInteraction, pressKey, q, qa, settle } from './helpers';

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

function ggmData(overrides: Partial<GraphicGapMatchInteractionData> = {}): GraphicGapMatchInteractionData {
	return {
		type: 'graphicGapMatchInteraction',
		responseId: 'RESPONSE',
		prompt: null,
		maxAssociations: 2,
		imageData: {
			type: 'image',
			src: 'water-cycle.png',
			width: '400',
			height: '200',
			alt: 'The water cycle over a lake',
		},
		gapTexts: [
			{ identifier: 'RAIN', text: 'Rain', matchMax: 1 },
			{ identifier: 'SUN', text: 'Sun', matchMax: 1 },
		],
		gapImages: [{ identifier: 'CLOUD_IS_TOP_RIGHT', src: 'cloud.png', alt: '', matchMax: 1 }],
		hotspots: [
			{ identifier: 'TOP_RIGHT_ANSWER', shape: 'circle', coords: '300,50,8', matchMax: 1 },
			{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1 },
		],
		...overrides,
	};
}

function hotspotTargets(mounted: { host: HTMLElement }): Element[] {
	return qa(mounted, '.qti-ggm-hotspot');
}

/** Begin dragging a palette label (the pointer drop's first half). */
function labelDrop(mounted: { host: HTMLElement }, name: string) {
	qa<HTMLButtonElement>(mounted, '[part="labels"] button')
		.find((button) => button.textContent?.trim() === name)!
		.dispatchEvent(new Event('dragstart', { bubbles: true }));
}

describe('GraphicGapMatchInteraction (pie-qti-graphic-gap-match)', () => {
	test('renders the authored alt text on the background image', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('The water cycle over a lake');
	});

	test('drop zones are focusable buttons named by position, never by identifier', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		const targets = hotspotTargets(mounted);
		expect(targets).toHaveLength(2);
		expect(targets[0]!.getAttribute('role')).toBe('button');
		expect(targets[0]!.getAttribute('tabindex')).toBe('0');
		expect(targets[0]!.getAttribute('aria-label')).toBe('Hotspot 1. Empty.');
		expect(mounted.host.innerHTML).not.toContain('TOP_RIGHT_ANSWER');
		// Visual layers are hidden from assistive tech
		for (const layer of qa(mounted, '.qti-ggm-halo, .qti-ggm-outline')) {
			expect(layer.getAttribute('aria-hidden')).toBe('true');
		}
	});

	test('a gap image without alt text is named generically, never by its identifier', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		const imageLabel = qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((button) => button.querySelector('img'));
		expect(imageLabel?.getAttribute('aria-label')).toBe('Label');
		expect(imageLabel?.querySelector('img')?.getAttribute('alt')).toBe('Label');
		expect(mounted.host.innerHTML).not.toContain('CLOUD_IS_TOP_RIGHT');
	});

	test('a palette label keeps its name as it is picked up and placed; the hint is its description', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		const rain = qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((b) => b.textContent?.trim() === 'Rain')!;
		/** The description text the button references (a hidden element, not read twice in browse mode). */
		const description = () => {
			const target = mounted.host.querySelector(`#${CSS.escape(rain.getAttribute('aria-describedby') ?? '')}`);
			expect(target?.hasAttribute('hidden')).toBe(true);
			return target?.textContent?.trim();
		};

		expect(rain.getAttribute('aria-label')).toBe('Rain');
		expect(rain.getAttribute('aria-pressed')).toBe('false');
		expect(description()).toBe('Press Space or Enter to pick up.');

		// Held: aria-pressed alone says it is picked up; the name does not repeat it.
		pressKey(rain, 'Enter');
		await settle();
		expect(rain.getAttribute('aria-pressed')).toBe('true');
		expect(rain.getAttribute('aria-label')).toBe('Rain');
		expect(description()).toBe('Tab to a hotspot and press Enter to place it.');

		// Placed: still the same name; the description says where it is.
		pressKey(hotspotTargets(mounted)[1]!, 'Enter');
		await settle();
		expect(rain.getAttribute('aria-label')).toBe('Rain');
		expect(description()).toContain('Already placed on a hotspot.');
	});

	test('keyboard: pick up a label, then place it on a drop zone', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		const rain = qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((b) => b.textContent?.trim() === 'Rain')!;
		pressKey(rain, 'Enter');
		await settle();
		expect(rain.getAttribute('aria-pressed')).toBe('true');
		expect(hotspotTargets(mounted)[1]!.getAttribute('aria-label')).toContain('Press Enter to place Rain here.');

		pressKey(hotspotTargets(mounted)[1]!, 'Enter');
		await settle();

		expect(mounted.instance.response).toEqual(['RAIN LAKE']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['RAIN LAKE'] });
		expect(hotspotTargets(mounted)[1]!.getAttribute('aria-label')).toBe('Hotspot 2. Contains Rain.');
		// A filled zone shows its label text on the image (not colour alone).
		expect(q(mounted, '.qti-ggm-zone[data-filled] .qti-ggm-zone-text')?.textContent?.trim()).toBe('Rain');
		expect(q(mounted, '[aria-live="polite"]')?.textContent).toContain('Rain placed on hotspot 2');
	});

	test("a default-shape hotspot lies beneath the others, like the hotspot one", async () => {
		// The default shape is the whole image (QTI 3.0 §8.29); drawn in authored order it
		// covers every hotspot listed before it — a click or drop there would fill the
		// whole-image zone instead. So its layers and pointer target are painted first, in
		// a backdrop group, while its control keeps its authored place for keyboard and AT.
		const mounted = mountInteraction(GraphicGapMatchInteraction, {
			interaction: ggmData({
				gapTexts: [{ identifier: 'RAIN', text: 'Rain', matchMax: 1 }],
				gapImages: [],
				hotspots: [
					{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1 },
					{ identifier: 'ALL', shape: 'default', coords: '', matchMax: 1 },
				],
			}),
		});
		await settle();

		const overlay = q(mounted, 'svg[part="overlay"]')!;
		const children = Array.from(overlay.children).map((node) => (node as SVGElement).getAttribute('class') ?? '');
		// The whole-image zone paints before the other zone's shapes...
		expect(children.findIndex((cls) => cls.includes('qti-ggm-backdrop'))).toBeLessThan(
			children.findIndex((cls) => cls.includes('qti-ggm-zone') && !cls.includes('qti-ggm-backdrop')),
		);
		// ...its pointer target takes the drops on the rest of the image,
		const backdropTarget = q(mounted, '.qti-ggm-backdrop [aria-hidden="true"].qti-ggm-hotspot')!;
		expect(backdropTarget).not.toBeNull();
		// ...and the whole-image zone's own control takes no pointer input, so a drop or
		// click on the lake stays the lake's.
		const controls = hotspotTargets(mounted).filter((target) => target.getAttribute('role') === 'button');
		expect(controls).toHaveLength(2);
		const defaultControl = controls.find((c) => c.getAttribute('aria-label')?.startsWith('Hotspot 2.'))!;
		expect(defaultControl.getAttribute('style')).toContain('pointer-events: none');
		// The lake's control takes pointer input as before.
		const lakeControl = controls.find((c) => c.getAttribute('aria-label')?.startsWith('Hotspot 1.'))!;
		expect(lakeControl.getAttribute('style')).not.toContain('pointer-events: none');

		// Drops land on the real zones: the lake, then the whole image elsewhere.
		labelDrop(mounted, 'Rain');
		lakeControl.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['RAIN LAKE']);
	});

	test('a drop on the whole-image backdrop fills the default-shape zone', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, {
			interaction: ggmData({
				gapTexts: [{ identifier: 'RAIN', text: 'Rain', matchMax: 1 }],
				gapImages: [],
				hotspots: [
					{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1 },
					{ identifier: 'ALL', shape: 'default', coords: '', matchMax: 1 },
				],
			}),
		});
		await settle();

		labelDrop(mounted, 'Rain');
		const backdropTarget = q(mounted, '.qti-ggm-backdrop [aria-hidden="true"].qti-ggm-hotspot')!;
		backdropTarget.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		await settle();

		expect(mounted.instance.response).toEqual(['RAIN ALL']);
		expect(q(mounted, '.qti-ggm-zone[data-filled] .qti-ggm-zone-text')?.textContent?.trim()).toBe('Rain');
		cleanupInteraction(mounted);
	});

	test('small drop zones grow to a 24 CSS px pointer target without changing their geometry', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		const [small, large] = hotspotTargets(mounted);
		// circle r=8 → 16px across at natural size → an 8px hit stroke reaches 24px.
		expect(small!.getAttribute('style')).toContain('--qti-hit-stroke: 8px');
		expect(small!.getAttribute('r')).toBe('8');
		expect(large!.getAttribute('style')).toContain('--qti-hit-stroke: 0px');
	});

	test('the overlay uses the natural image space and the stage scales with its container', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		expect(q(mounted, 'svg[part="overlay"]')?.getAttribute('viewBox')).toBe('0 0 400 200');
		// Capped at the natural width plus the 2px frame border on each side (jsdom folds the calc()).
		expect(q(mounted, '[part="stage"]')?.getAttribute('style')).toMatch(/max-width: calc\((404px|400px \+ 4px)\)/);
		expect(q(mounted, '.qti-ggm-canvas')?.getAttribute('style')).toContain('aspect-ratio: 400 / 200');
	});

	test('missing image dimensions: no misplaced overlay, no candidate diagnostic, a console warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(GraphicGapMatchInteraction, {
			interaction: ggmData({
				imageData: { type: 'svg', content: '<svg><rect width="10" height="10"/></svg>', width: '', height: '' },
			}),
		});
		await settle();

		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();
		expect(q(mounted, '[part="diagnostic"]')).toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('no known width/height'));
	});

	test('a failed background image shows a localized message', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();

		const error = q(mounted, '[part="image-error"]');
		expect(error?.textContent).toContain('The image could not be loaded.');
		expect(error?.textContent).toContain('The water cycle over a lake');
	});

	test('two renderings of the same item keep their own instruction and description ids', async () => {
		const data = ggmData({
			imageData: { ...ggmData().imageData!, altDescription: 'Clouds form above the lake, then rain falls.' },
		});
		const first = mountInteraction(GraphicGapMatchInteraction, { interaction: data });
		const second = mountInteraction(GraphicGapMatchInteraction, { interaction: data });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
		for (const mounted of [first, second]) {
			const instructions = document.getElementById(q(mounted, '[part="region"]')?.getAttribute('aria-describedby') ?? '');
			expect(mounted.host.contains(instructions)).toBe(true);
			expect(instructions?.textContent).toContain('Press Space or Enter to pick up a label.');
			const description = document.getElementById(q(mounted, 'img[part="image"]')?.getAttribute('aria-describedby') ?? '');
			expect(mounted.host.contains(description)).toBe(true);
			expect(description?.textContent).toBe('Clouds form above the lake, then rain falls.');
		}
	});

	describe('matchGroup (the rule response validation applies)', () => {
		// QTI: a label's matchGroup lists the hotspots it may be matched with, a hotspot's the labels.
		function groupedData(): GraphicGapMatchInteractionData {
			return ggmData({
				gapTexts: [
					{ identifier: 'RAIN', text: 'Rain', matchMax: 1, matchGroup: ['LAKE'] },
					{ identifier: 'SUN', text: 'Sun', matchMax: 1, matchGroup: ['SKY', 'LAKE'] },
				],
				gapImages: [],
				hotspots: [
					{ identifier: 'SKY', shape: 'circle', coords: '300,50,8', matchMax: 1, matchGroup: ['SUN'] },
					{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1, matchGroup: ['RAIN'] },
				],
			});
		}

		function label(mounted: { host: HTMLElement }, text: string): HTMLButtonElement {
			return qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((b) => b.textContent?.trim() === text)!;
		}

		test('a held label marks the hotspots that refuse it, and they refuse the placement', async () => {
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: groupedData() });
			await settle();

			pressKey(label(mounted, 'Rain'), 'Enter');
			await settle();
			const [sky, lake] = hotspotTargets(mounted);
			expect(sky!.getAttribute('aria-disabled')).toBe('true');
			expect(sky!.getAttribute('aria-label')).toBe('Hotspot 1. Empty. Not available due to a match group restriction.');
			expect(lake!.getAttribute('aria-disabled')).toBeNull();
			expect(lake!.getAttribute('aria-label')).toContain('Press Enter to place Rain here.');

			// Refused: nothing is placed and Rain stays held.
			pressKey(sky!, 'Enter');
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(label(mounted, 'Rain').getAttribute('aria-pressed')).toBe('true');
			expect(q(mounted, '[aria-live="polite"]')?.textContent?.trim()).toBe('Not available due to a match group restriction.');

			pressKey(hotspotTargets(mounted)[1]!, 'Enter');
			await settle();
			expect(mounted.instance.response).toEqual(['RAIN LAKE']);
		});

		test('the hotspot side constrains too: a hotspot accepts only the labels its matchGroup names', async () => {
			// Sun names both hotspots, but the lake names only Rain. The renderer used to ignore a
			// hotspot's matchGroup entirely.
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: groupedData() });
			await settle();

			pressKey(label(mounted, 'Sun'), 'Enter');
			await settle();
			const [sky, lake] = hotspotTargets(mounted);
			expect(sky!.getAttribute('aria-disabled')).toBeNull();
			expect(lake!.getAttribute('aria-disabled')).toBe('true');
		});

		test('a pointer drop onto a hotspot that refuses the label is ignored', async () => {
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: groupedData() });
			await settle();

			label(mounted, 'Rain').dispatchEvent(new Event('dragstart', { bubbles: true }));
			await settle();
			hotspotTargets(mounted)[0]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
			await settle();

			expect(mounted.events).toHaveLength(0);
		});

		test('a dragged label is judged on its own, not on a label still held from the keyboard', async () => {
			// Rain is held (the sky refuses it); Sun is then dragged, and the sky accepts Sun.
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: groupedData() });
			await settle();

			pressKey(label(mounted, 'Rain'), 'Enter');
			await settle();
			label(mounted, 'Sun').dispatchEvent(new Event('dragstart', { bubbles: true }));
			await settle();

			const [sky, lake] = hotspotTargets(mounted);
			const overSky = new Event('dragover', { bubbles: true, cancelable: true });
			sky!.dispatchEvent(overSky);
			expect(overSky.defaultPrevented).toBe(true);
			const overLake = new Event('dragover', { bubbles: true, cancelable: true });
			lake!.dispatchEvent(overLake);
			expect(overLake.defaultPrevented).toBe(false);

			sky!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
			await settle();
			expect(mounted.instance.response).toEqual(['SUN SKY']);
		});

		test('labels sharing a token stay available after one is placed', async () => {
			// Rain and Sun share "LAKE"; the former renderer made Sun unavailable once Rain was placed,
			// though response validation accepts Sun on the sky.
			const mounted = mountInteraction(GraphicGapMatchInteraction, {
				interaction: groupedData(),
				response: ['RAIN LAKE'],
			});
			await settle();

			const sun = label(mounted, 'Sun');
			expect(sun.hasAttribute('aria-disabled')).toBe(false);
			expect(sun.getAttribute('aria-label')).not.toContain('match group');
			pressKey(sun, 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[0]!, 'Enter');
			await settle();
			expect(mounted.instance.response).toEqual(['RAIN LAKE', 'SUN SKY']);
		});
	});

	test('removing a label announces it and keeps focus on its label (round 6)', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		// Place Rain on the first hotspot via the keyboard flow.
		const rain = qa<HTMLButtonElement>(mounted, '[part="labels"] button').find(
			(button) => button.textContent?.trim() === 'Rain',
		)!;
		rain.click();
		await settle();
		hotspotTargets(mounted)[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['RAIN TOP_RIGHT_ANSWER']);

		const remove = q<HTMLButtonElement>(mounted, '[part="label-remove"]');
		expect(remove).not.toBeNull();
		remove.focus();
		remove.click();
		await settle();

		// The removal is announced; the remove button is gone; focus returned to the
		// now-enabled label button instead of the document body.
		const live = Array.from(mounted.host.querySelectorAll('[aria-live="polite"]')).at(0);
		expect(live?.textContent).toContain('Rain removed from hotspot.');
		expect(q(mounted, '[part="label-remove"]')).toBeNull();
		expect(document.activeElement).toBe(rain);
		expect(rain.disabled).toBe(false);
	});

	describe('maxAssociations cap', () => {
		function labelButton(mounted: { host: HTMLElement }, text: string): HTMLButtonElement {
			return qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((b) => b.textContent?.trim() === text)!;
		}

		test('a pointer drop that would exceed the cap is refused and announced', async () => {
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData({ maxAssociations: 1 }) });
			await settle();

			// Setup: Rain goes to the lake (one pair = the whole cap).
			pressKey(labelButton(mounted, 'Rain'), 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[1]!, 'Enter');
			await settle();
			expect(mounted.instance.response).toEqual(['RAIN LAKE']);

			// Sun onto the free hotspot would make two pairs: refused.
			labelButton(mounted, 'Sun').dispatchEvent(new Event('dragstart', { bubbles: true }));
			await settle();
			hotspotTargets(mounted)[0]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
			await settle();

			expect(mounted.instance.response).toEqual(['RAIN LAKE']);
			expect(q(mounted, '[aria-live="polite"]')?.textContent?.trim()).toBe(
				'Association not possible: the limit of 1 is reached.',
			);
			expect(hotspotTargets(mounted)[0]!.getAttribute('aria-label')).toBe('Hotspot 1. Empty.');
			cleanupInteraction(mounted);
		});

		test('a keyboard placement at the cap is refused and the label stays held', async () => {
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData({ maxAssociations: 1 }) });
			await settle();

			pressKey(labelButton(mounted, 'Rain'), 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[1]!, 'Enter');
			await settle();

			const sun = labelButton(mounted, 'Sun');
			pressKey(sun, 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[0]!, 'Enter');
			await settle();

			expect(mounted.instance.response).toEqual(['RAIN LAKE']);
			expect(sun.getAttribute('aria-pressed')).toBe('true');
			expect(q(mounted, '[aria-live="polite"]')?.textContent?.trim()).toBe(
				'Association not possible: the limit of 1 is reached.',
			);
			cleanupInteraction(mounted);
		});

		test('replacing a placement within the cap is allowed', async () => {
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData({ maxAssociations: 1 }) });
			await settle();

			pressKey(labelButton(mounted, 'Rain'), 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[1]!, 'Enter');
			await settle();

			// Sun replaces Rain on the lake: the response never exceeds one pair.
			labelButton(mounted, 'Sun').dispatchEvent(new Event('dragstart', { bubbles: true }));
			await settle();
			hotspotTargets(mounted)[1]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
			await settle();

			expect(mounted.instance.response).toEqual(['SUN LAKE']);
			cleanupInteraction(mounted);
		});

		test('the author’s data-max-selections-message wins over the localized refusal', async () => {
			const mounted = mountInteraction(GraphicGapMatchInteraction, {
				interaction: ggmData({ maxAssociations: 1, maxSelectionsMessage: 'No more than one label may be placed.' }),
			});
			await settle();

			pressKey(labelButton(mounted, 'Rain'), 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[1]!, 'Enter');
			await settle();
			labelButton(mounted, 'Sun').dispatchEvent(new Event('dragstart', { bubbles: true }));
			await settle();
			hotspotTargets(mounted)[0]!.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
			await settle();

			expect(mounted.instance.response).toEqual(['RAIN LAKE']);
			expect(q(mounted, '[aria-live="polite"]')?.textContent?.trim()).toBe('No more than one label may be placed.');
			cleanupInteraction(mounted);
		});

		test('maxAssociations=0 means unlimited: both labels place', async () => {
			const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData({ maxAssociations: 0 }) });
			await settle();

			pressKey(labelButton(mounted, 'Rain'), 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[1]!, 'Enter');
			await settle();
			pressKey(labelButton(mounted, 'Sun'), 'Enter');
			await settle();
			pressKey(hotspotTargets(mounted)[0]!, 'Enter');
			await settle();

			expect(mounted.instance.response).toEqual(['RAIN LAKE', 'SUN TOP_RIGHT_ANSWER']);
			cleanupInteraction(mounted);
		});
	});
});

// createInteractionShell's rule: correct-answer mode is the scorer's view of an item that has a
// correct response. Hosts pass null when the item declares none; a scorer then sees the
// interaction as a candidate does. Outside that view only `disabled` stops interaction.
describe('GraphicGapMatchInteraction correct-answer mode: role × correct response', () => {
	function rainLabel(mounted: { host: HTMLElement }): HTMLButtonElement | undefined {
		return qa<HTMLButtonElement>(mounted, '[part="labels"] button').find((b) => b.textContent?.trim() === 'Rain');
	}

	test.each([
		['candidate', ['RAIN LAKE'], false],
		['candidate', null, false],
		['scorer', ['RAIN LAKE'], true],
		['scorer', null, false],
	] as const)('%s, correct response %j: correct-answer mode is %s', async (role, correctResponse, correctMode) => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData(), role, correctResponse });
		await settle();

		// The correct-answer view shows the key on the hotspots and puts the label palette away.
		expect(qa(mounted, '.qti-ggm-zone[data-correct]')).toHaveLength(correctMode ? 1 : 0);
		expect(hotspotTargets(mounted)[1]!.getAttribute('aria-label')).toBe(
			correctMode ? 'Hotspot 2. Correct answer: Rain.' : 'Hotspot 2. Empty.',
		);
		expect(q(mounted, '[part="labels"]') === null).toBe(correctMode);
		cleanupInteraction(mounted);
	});

	test.each([
		['candidate', ['RAIN LAKE']],
		['candidate', null],
		['scorer', null],
	] as const)('%s, correct response %j: placing a label emits', async (role, correctResponse) => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData(), role, correctResponse });
		await settle();

		pressKey(rainLabel(mounted)!, 'Enter');
		await settle();
		pressKey(hotspotTargets(mounted)[1]!, 'Enter');
		await settle();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['RAIN LAKE'] });
		cleanupInteraction(mounted);
	});

	test('disabled stops placement for a scorer without a correct response too', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, {
			interaction: ggmData(),
			role: 'scorer',
			correctResponse: null,
			disabled: true,
		});
		await settle();

		pressKey(rainLabel(mounted)!, 'Enter');
		await settle();
		pressKey(hotspotTargets(mounted)[1]!, 'Enter');
		await settle();
		expect(mounted.events).toHaveLength(0);
		cleanupInteraction(mounted);
	});
});
