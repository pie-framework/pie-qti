import { flushSync } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import type { GraphicAssociateInteractionData, GraphicOrderInteractionData, HotspotInteractionData } from '@pie-qti/item-player';
import '../../src/plugins/hotspot/HotspotInteraction.svelte';
import '../../src/plugins/graphic-order/GraphicOrderInteraction.svelte';
import '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';

/**
 * The components must lay out correctly with only their own shadow styles (no host CSS):
 * the graphic overlays are absolutely positioned within the image box (part="overlay",
 * part="areas"). Svelte injects each component's styles into its shadow root in an effect,
 * one `<style>` per component in the bundle's module graph; a cycle around that injection can
 * split it, leaving an overlay unpositioned — pinned here via the parsed CSS sheet rules.
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

/** Computed `position` of `element` from the shadow's own style sheets. */
function positionFromOwnStyles(root: ShadowRoot, element: Element): string | null {
	const matching = sheetRules(root).filter((rule) => {
		try {
			return !!rule.selectorText && element.matches(rule.selectorText);
		} catch {
			return false;
		}
	});
	// Last matching rule wins, as in the cascade.
	for (const rule of [...matching].reverse()) {
		if (rule.style.position) return rule.style.position;
	}
	return null;
}

function mount<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag) as HTMLElementTagNameMap[K] & Record<string, unknown>;
	document.body.appendChild(element);
	return element;
}

describe('graphic overlays are positioned by the components' + "'" + ' own shadow styles (no host CSS)', () => {
	test('hotspot: svg[part="overlay"] is absolute', async () => {
		const element = mount('pie-qti-hotspot');
		element.interaction = {
			type: 'hotspotInteraction',
			responseId: 'HS',
			maxChoices: 1,
			prompt: null,
			imageData: { type: 'svg', width: '240', height: '120', content: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
			hotspotChoices: [{ identifier: 'A', shape: 'rect', coords: '20,20,80,40' }],
		} satisfies HotspotInteractionData;
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();

		const overlay = element.shadowRoot!.querySelector('svg[part="overlay"]')!;
		expect(positionFromOwnStyles(element.shadowRoot!, overlay)).toBe('absolute');
	});

	test('graphic order: svg[part="overlay"] is absolute', async () => {
		const element = mount('pie-qti-graphic-order');
		element.interaction = {
			type: 'graphicOrderInteraction',
			responseId: 'GO',
			prompt: null,
			imageData: { type: 'svg', width: '240', height: '120', content: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
			hotspotChoices: [
				{ identifier: 'A', label: 'A', shape: 'rect', coords: '0,0,100,50' },
				{ identifier: 'B', label: 'B', shape: 'rect', coords: '0,50,100,100' },
			],
		} satisfies GraphicOrderInteractionData;
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();

		const overlay = element.shadowRoot!.querySelector('svg[part="overlay"]')!;
		expect(positionFromOwnStyles(element.shadowRoot!, overlay)).toBe('absolute');
	});

	test('graphic associate: svg[part="overlay"] and the areas layer are absolute', async () => {
		const element = mount('pie-qti-graphic-associate');
		element.interaction = {
			type: 'graphicAssociateInteraction',
			responseId: 'GA',
			prompt: null,
			maxAssociations: 2,
			minAssociations: 0,
			imageData: { type: 'svg', width: '240', height: '120', content: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
			associableHotspots: [{ identifier: 'H1', label: 'H1', shape: 'rect', coords: '20,20,80,40', matchMax: 2 }],
		} satisfies GraphicAssociateInteractionData;
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();

		const root = element.shadowRoot!;
		for (const part of ['overlay', 'areas']) {
			const layer = root.querySelector(`svg[part="${part}"]`);
			expect(layer, `svg[part="${part}"] rendered`).not.toBeNull();
			expect(positionFromOwnStyles(root, layer!), `svg[part="${part}"] positioned`).toBe('absolute');
		}
	});
});
