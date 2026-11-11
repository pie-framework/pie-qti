import type { GraphicGapMatchInteractionData, HotspotInteractionData } from '@pie-qti/item-player';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import { cleanupInteraction, mountInteraction, q, settle, type MountedInteraction } from './helpers';

/**
 * The stage's `reportWidth` wiring: the interactions that size things in CSS px
 * (the 24px touch-target compensation, the selection marker, the drop-zone
 * badges) must receive the stage container's rendered width, or the shared
 * stage image pins `renderScale` to 1 and those sizes render unscaled whenever
 * the image is shown below its natural size.
 *
 * The 800×600 image is rendered at 400 CSS px (renderScale 0.5). A 20×20
 * natural-px region then misses the 24px touch target by 14 CSS px (pinned
 * renderScale 1 would say 4), and the hotspot's selection marker counter-scales
 * by 1 / 0.5 = 2 to keep its CSS size.
 */

const NATURAL = { width: 800, height: 600 };

/** Every HTML element reports this width, so the stage container does when its `observeWidth` action initializes at mount. */
function renderAt(width: number) {
	const height = (width * NATURAL.height) / NATURAL.width;
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		return {
			left: 0,
			top: 0,
			width,
			height,
			right: width,
			bottom: height,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect;
	});
}

function hotspotData(): HotspotInteractionData {
	return {
		type: 'hotspotInteraction',
		responseId: 'RESPONSE',
		maxChoices: 1,
		prompt: null,
		imageData: { type: 'image', src: 'map.png', width: String(NATURAL.width), height: String(NATURAL.height) },
		// A 20×20 natural-px region: below the 24px touch target at any scale, so the
		// compensation is visible, and its size depends on the rendered scale.
		hotspotChoices: [{ identifier: 'A', shape: 'rect', coords: '100,100,120,120' }],
	};
}

function gapMatchData(): GraphicGapMatchInteractionData {
	return {
		type: 'graphicGapMatchInteraction',
		responseId: 'RESPONSE',
		prompt: null,
		imageData: { type: 'image', src: 'map.png', width: String(NATURAL.width), height: String(NATURAL.height) },
		gapTexts: [{ identifier: 'L1', text: 'One', matchMax: 1 }],
		hotspots: [{ identifier: 'H1', shape: 'rect', coords: '100,100,120,120', matchMax: 1 }],
	};
}

/** The touch-target compensation a region's hit stroke asks for, in CSS px. */
function hitStrokePx(mounted: MountedInteraction, selector: string): string | null {
	const style = q<SVGElement>(mounted, selector)?.getAttribute('style') ?? '';
	return style.match(/--qti-hit-stroke:\s*(\d+)px/)?.[1] ?? null;
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('stage reportWidth: rendered-width reporting drives touch-target and marker scaling', () => {
	test('hotspot: a half-scale stage compensates its touch target at the rendered scale', async () => {
		renderAt(400); // 800 natural → renderScale 0.5
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		// 20 natural px at half scale is 10 CSS px; 24 − 10 = 14. A pinned renderScale would say 4.
		expect(hitStrokePx(mounted, '.qti-hotspot-shape')).toBe('14');
		cleanupInteraction(mounted);
	});

	test('hotspot: the selection marker counter-scales, keeping its CSS size at half scale', async () => {
		renderAt(400);
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const region = q<SVGElement>(mounted, '.qti-hotspot-shape')!;
		region.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		await settle();

		const marker = q<SVGElement>(mounted, '.qti-hotspot-marker')!;
		expect(marker.getAttribute('transform')).toContain('scale(2)');
		cleanupInteraction(mounted);
	});

	test('hotspot: a stage at full natural size compensates only the shortfall (renderScale 1)', async () => {
		renderAt(800);
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		// 20 natural px at full scale misses by 4.
		expect(hitStrokePx(mounted, '.qti-hotspot-shape')).toBe('4');
		cleanupInteraction(mounted);
	});

	test('graphic-gap-match: a half-scale stage compensates its hotspots at the rendered scale', async () => {
		renderAt(400);
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: gapMatchData() });
		await settle();

		expect(hitStrokePx(mounted, '.qti-ggm-hotspot')).toBe('14');
		cleanupInteraction(mounted);
	});

	test('graphic-gap-match: a stage at full natural size compensates only the shortfall (renderScale 1)', async () => {
		renderAt(800);
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: gapMatchData() });
		await settle();

		expect(hitStrokePx(mounted, '.qti-ggm-hotspot')).toBe('4');
		cleanupInteraction(mounted);
	});
});
