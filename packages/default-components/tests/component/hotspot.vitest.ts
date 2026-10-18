import { afterEach, describe, expect, test } from 'vitest';
import type { HotspotInteractionData } from '@pie-qti/item-player';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import {
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
} from './helpers';

function hotspotData(overrides: Partial<HotspotInteractionData> = {}): HotspotInteractionData {
	return {
		type: 'hotspotInteraction',
		responseId: 'RESPONSE',
		maxChoices: 1,
		prompt: null,
		imageData: { width: 400, height: 300, src: 'diagram.png', type: 'image' } as HotspotInteractionData['imageData'],
		hotspotChoices: [
			{ identifier: 'H1', shape: 'circle', coords: '50,50,10', hotspotLabel: 'The sun' },
			{ identifier: 'H2', shape: 'rect', coords: '100,100,150,150', hotspotLabel: 'A house' },
		],
		...overrides,
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('HotspotInteraction (pie-qti-hotspot)', () => {
	test('known image dimensions produce an overlay in the image pixel space', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const overlay = q<SVGElement>(mounted, 'svg[part="overlay"]');
		expect(overlay?.getAttribute('viewBox')).toBe('0 0 400 300');
		expect(q(mounted, '[part="diagnostic"]')).toBeNull();
	});

	test('hotspot regions are keyboard-reachable buttons with accessible names', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const shapes = qa(mounted, '.qti-hotspot-shape');
		expect(shapes).toHaveLength(2);
		expect(shapes[0]!.getAttribute('role')).toBe('button');
		expect(shapes[0]!.getAttribute('tabindex')).toBe('0');
		expect(shapes[0]!.getAttribute('aria-label')).toBe('The sun');
	});

	test('clicking a hotspot answers with its identifier', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const shape = qa(mounted, '.qti-hotspot-shape')[1]!;
		shape.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'H2' });
		expect(shape.getAttribute('aria-pressed')).toBe('true');
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

	test('missing image dimensions refuse to draw the overlay and say why', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: null }),
		});
		await settle();

		const diagnostic = q(mounted, '[part="diagnostic"]');
		expect(diagnostic?.getAttribute('role')).toBe('alert');
		expect(diagnostic?.textContent).toContain('size of its image is unknown');
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();
	});

	test('disabled hotspots ignore activation', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData(),
			disabled: true,
		});
		await settle();

		const shape = qa(mounted, '.qti-hotspot-shape')[0]!;
		expect(shape.getAttribute('tabindex')).toBe('-1');
		shape.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		pressKey(shape, 'Enter');
		await settle();

		expect(mounted.instance.response).toBeUndefined();
		expect(mounted.events).toHaveLength(0);
	});
});
