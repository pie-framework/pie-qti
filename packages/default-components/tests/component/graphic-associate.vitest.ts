import { afterEach, describe, expect, test } from 'vitest';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import type { GraphicAssociateInteractionData } from '@pie-qti/item-player';
import {
	cleanupInteraction,
	mountInteraction,
	qa,
	settle,
} from './helpers';

function associateData(overrides: Partial<GraphicAssociateInteractionData> = {}): GraphicAssociateInteractionData {
	return {
		type: 'graphicAssociateInteraction',
		responseId: 'RESPONSE',
		prompt: '<p>Associate the two hotspots.</p>',
		maxAssociations: 1,
		minAssociations: 0,
		imageData: { type: 'svg', content: '<svg/>', width: '100', height: '50' },
		associableHotspots: [
			{ identifier: 'H1', shape: 'rect', coords: '0,0,40,20', matchMax: 1, label: 'Hotspot 1' },
			{ identifier: 'H2', shape: 'rect', coords: '50,0,90,20', matchMax: 1, label: 'Hotspot 2' },
			{ identifier: 'H10', shape: 'rect', coords: '0,25,40,45', matchMax: 1, label: 'Hotspot 10' },
		],
		...overrides,
	};
}

afterEach(() => {
	// Remove any hosts appended during the test.
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('GraphicAssociateInteraction (pie-qti-graphic-associate)', () => {
	test('click two hotspots to create a pair; the pair emits and renders', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, { interaction: associateData() });
		await settle();

		const hotspots = qa(mounted, 'button[part="hotspot"]');
		expect(hotspots).toHaveLength(3);

		hotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		hotspots[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toEqual(['H1 H2']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['H1 H2'] });
		cleanupInteraction(mounted);
	});

	test('usage counting is token-exact: H1 stays selectable while H10 is paired', async () => {
		// Regression for substring usage counting: the pair "H10 H2" contains "H1" as a substring,
		// but H1 is a different identifier and must remain selectable (not reported maxed out).
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData(),
			response: ['H10 H2'],
		});
		await settle();

		const hotspots = qa(mounted, 'button[part="hotspot"]');
		hotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(hotspots[0].getAttribute('aria-pressed')).toBe('true');
		expect(mounted.instance.response).toEqual(['H10 H2']);
		cleanupInteraction(mounted);
	});
});
