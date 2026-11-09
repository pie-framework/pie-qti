import type { GraphicAssociateInteractionData, GraphicGapMatchInteractionData, HotspotInteractionData } from '@pie-qti/item-player';
import { afterEach, describe, expect, test } from 'vitest';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import { cleanupInteraction, mountInteraction, q, qa, settle } from './helpers';

/**
 * Focus on a graphic region (WCAG 2.4.7): the indicator must be clearly distinct
 * from the selected state — a region that is both selected and focused otherwise
 * shows two nearly identical thick outlines. The shared rule (in ImageStage's one
 * style sheet) draws an offset outer ring: a focus-coloured ring around the
 * region's halo for the SVG-shape interactions, an outline ring on the HTML
 * button controls — by geometry, not colour alone. This pins the shared classes
 * the rule keys on and the rule itself, parsed from the shadow style sheet.
 */

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

/** Rules from every style sheet in the shadow root, as parsed CSS (jsdom supports this). */
function sheetRules(root: ShadowRoot): CSSStyleRule[] {
	return Array.from(root.querySelectorAll('style')).flatMap(
		(style) => Array.from((style as HTMLStyleElement).sheet?.cssRules ?? []) as CSSStyleRule[],
	);
}

function hotspotData(): HotspotInteractionData {
	return {
		type: 'hotspotInteraction',
		responseId: 'RESPONSE',
		maxChoices: 2,
		prompt: null,
		imageData: { type: 'image', src: 'map.png', width: '400', height: '300', alt: 'Map' },
		hotspotChoices: [
			{ identifier: 'A', shape: 'rect', coords: '20,20,180,140' },
			{ identifier: 'B', shape: 'circle', coords: '300,150,60' },
		],
	};
}

function ggmData(): GraphicGapMatchInteractionData {
	return {
		type: 'graphicGapMatchInteraction',
		responseId: 'RESPONSE',
		prompt: null,
		imageData: { type: 'image', src: 'cycle.png', width: '400', height: '200', alt: 'Cycle' },
		gapTexts: [{ identifier: 'RAIN', text: 'Rain', matchMax: 1 }],
		hotspots: [
			{ identifier: 'LAKE', shape: 'rect', coords: '20,120,220,190', matchMax: 1 },
			{ identifier: 'ALL', shape: 'default', coords: '', matchMax: 1 },
		],
	};
}

function gaData(): GraphicAssociateInteractionData {
	return {
		type: 'graphicAssociateInteraction',
		responseId: 'RESPONSE',
		prompt: null,
		maxAssociations: 2,
		imageData: { type: 'svg', content: '<svg/>', width: '100', height: '50' },
		associableHotspots: [
			{ identifier: 'A', shape: 'rect', coords: '10,5,90,45', matchMax: 2 },
			{ identifier: 'B', shape: 'circle', coords: '92,8,8', matchMax: 2 },
		],
	};
}

describe('the graphic focus indicator is one shared offset ring', () => {
	test('hotspot regions and their halos carry the shared focus classes', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const regions = qa(mounted, '.qti-hotspot-region');
		expect(regions.length).toBeGreaterThan(0);
		for (const region of regions) expect(region.classList.contains('qti-graphic-region')).toBe(true);
		// Every visual halo layer is the shared rule's ring target.
		const halos = qa(mounted, '.qti-hotspot-halo');
		expect(halos.length).toBeGreaterThanOrEqual(regions.length);
		for (const halo of halos) expect(halo.classList.contains('qti-graphic-halo')).toBe(true);
		cleanupInteraction(mounted);
	});

	test('graphic gap match zones carry the shared classes, the whole-image backdrop included', async () => {
		const mounted = mountInteraction(GraphicGapMatchInteraction, { interaction: ggmData() });
		await settle();

		// The whole-image backdrop zone plus every authored zone (the default-shape
		// hotspot keeps its authored control).
		const zones = qa(mounted, '.qti-ggm-zone');
		expect(zones).toHaveLength(3);
		for (const zone of zones) expect(zone.classList.contains('qti-graphic-region')).toBe(true);
		expect(qa(mounted, '.qti-ggm-zone.qti-ggm-backdrop')).toHaveLength(1);
		for (const halo of qa(mounted, '.qti-ggm-halo')) expect(halo.classList.contains('qti-graphic-halo')).toBe(true);
		cleanupInteraction(mounted);
	});

	test('graphic associate buttons are shared-rule controls', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, { interaction: gaData() });
		await settle();

		const buttons = qa(mounted, 'button[part="hotspot"]');
		expect(buttons).toHaveLength(2);
		for (const button of buttons) expect(button.classList.contains('qti-graphic-control')).toBe(true);
		cleanupInteraction(mounted);
	});

	test("the shared rule lives once in the stage own style sheet, with an offset ring", async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const root = (q(mounted, '.qti-hotspot-interaction')!.getRootNode()) as ShadowRoot;
		const rules = sheetRules(root).map((rule) => rule.selectorText ?? '');
		// The SVG-shape ring: focus-within on the region colours and widens its halo —
		// a ring around the region, distinct from the selected outline by geometry.
		const ring = rules.find((selector) => selector.includes('.qti-graphic-region') && selector.includes('.qti-graphic-halo') && selector.includes('focus-within'));
		expect(ring).toBeDefined();
		const ringRule = sheetRules(root).find((rule) => rule.selectorText === ring)!;
		expect(ringRule.style.stroke).toBeTruthy();
		expect(ringRule.style.strokeWidth).toBe('12px');
		// The control ring: an outline offset off the control, for HTML-button regions.
		const controlRing = rules.find((selector) => selector.includes('.qti-graphic-control') && selector.includes('focus-visible'));
		expect(controlRing).toBeDefined();
		const controlRule = sheetRules(root).find((rule) => rule.selectorText === controlRing)!;
		// jsdom keeps the outline shorthand unexpanded; the offset ring is on it.
		expect(controlRule.style.cssText).toContain('outline: 3px solid');
		// One rule, not per-interaction copies: the interactions' own sheets no longer
		// style focus on the shapes.
		for (const selector of rules) {
			expect(selector.includes('qti-hotspot-shape:focus-visible')).toBe(false);
			expect(selector.includes('qti-ggm-hotspot:focus-visible')).toBe(false);
		}
		cleanupInteraction(mounted);
	});

	test('the ring is drawn from the theme focus token, never a colour literal', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();
		const root = (q(mounted, '.qti-hotspot-interaction')!.getRootNode()) as ShadowRoot;
		const ringRule = sheetRules(root).find((rule) => rule.selectorText?.includes('.qti-graphic-region') && rule.style.stroke);
		expect(ringRule?.style.stroke).toContain('--pie-qti-focus');
		cleanupInteraction(mounted);
	});
});
