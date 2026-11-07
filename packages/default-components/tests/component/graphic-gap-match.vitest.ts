import type { GraphicGapMatchInteractionData } from '@pie-qti/item-player';
import { afterEach, describe, expect, test, vi } from 'vitest';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import { mountInteraction, pressKey, q, qa, settle } from './helpers';

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
		expect(imageLabel?.getAttribute('aria-label')).toMatch(/^Label\./);
		expect(imageLabel?.querySelector('img')?.getAttribute('alt')).toBe('Label');
		expect(mounted.host.innerHTML).not.toContain('CLOUD_IS_TOP_RIGHT');
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
});
