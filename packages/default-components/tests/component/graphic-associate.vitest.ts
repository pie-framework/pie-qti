import { afterEach, describe, expect, test, vi } from 'vitest';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import type { GraphicAssociateInteractionData } from '@pie-qti/item-player';
import {
	cleanupInteraction,
	mountInteraction,
	q,
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

/** Hotspots whose identifiers would give the answer away if they reached the accessibility tree. */
const UNLABELLED_HOTSPOTS: GraphicAssociateInteractionData['associableHotspots'] = [
	{ identifier: 'HEART_PAIRS_WITH_PUMP', shape: 'rect', coords: '10,10,30,30', matchMax: 1, label: '' },
	{ identifier: 'PUMP', shape: 'circle', coords: '70,20,10', matchMax: 1, label: '' },
];

afterEach(() => {
	vi.restoreAllMocks();
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

	test('hotspot accessible names are localized sentences with the usage count', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, { interaction: associateData() });
		await settle();

		const first = qa(mounted, 'button[part="hotspot"]')[0]!;
		expect(first.getAttribute('aria-label')).toBe('Hotspot 1 (0/1 connections).');
	});

	test('unlabelled hotspots are named by position, never by identifier', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({ associableHotspots: UNLABELLED_HOTSPOTS, maxAssociations: 1 }),
			response: ['HEART_PAIRS_WITH_PUMP PUMP'],
		});
		await settle();

		const hotspots = qa(mounted, 'button[part="hotspot"]');
		expect(hotspots[0]!.getAttribute('aria-label')).toBe('Region 1 (1/1 connections).');
		expect(hotspots[1]!.textContent?.trim()).toBe('Region 2');
		const remove = q<HTMLButtonElement>(mounted, '.qti-ga-remove')!;
		expect(remove.getAttribute('aria-label')).toBe('Remove association between Region 1 and Region 2');
		expect(mounted.host.textContent).not.toContain('HEART_PAIRS_WITH_PUMP');
		expect(mounted.host.innerHTML).not.toContain('HEART_PAIRS_WITH_PUMP');
	});

	test('the scorer view names correct hotspots and pairs without identifiers', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({ associableHotspots: UNLABELLED_HOTSPOTS }),
			role: 'scorer',
			correctResponse: ['HEART_PAIRS_WITH_PUMP PUMP'],
			response: ['HEART_PAIRS_WITH_PUMP PUMP'],
		});
		await settle();

		const first = qa(mounted, 'button[part="hotspot"]')[0]!;
		expect(first.getAttribute('aria-label')).toBe('Region 1 (1/1 connections). Correct answer.');
		expect(q(mounted, '.qti-ga-pair')?.textContent).toContain('Region 1 associated with Region 2. Correct answer.');
		expect(mounted.host.innerHTML).not.toContain('HEART_PAIRS_WITH_PUMP');
	});

	test('renders the authored alt text from QTI on the image', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({
				imageData: { type: 'image', src: 'body.png', width: '100', height: '50', alt: 'Outline of a human torso' },
			}),
		});
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('Outline of a human torso');
	});

	test('inline SVG is exposed as an image named by its alternative', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({
				imageData: { type: 'svg', content: '<svg/>', width: '100', height: '50', alt: 'Food web' },
			}),
		});
		await settle();

		const image = q(mounted, '[part="image"]')!;
		expect(image.getAttribute('role')).toBe('img');
		expect(image.getAttribute('aria-label')).toBe('Food web');
	});

	test('hotspots are positioned in percentages of the natural image, so they scale with it', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, { interaction: associateData() });
		await settle();

		// rect 0,0,40,20 on a 100×50 image: centred at (20%, 20%), 40% × 40% of the image.
		const style = qa(mounted, 'button[part="hotspot"]')[0]!.getAttribute('style') ?? '';
		expect(style).toContain('left: 20%');
		expect(style).toContain('top: 20%');
		expect(style).toContain('width: 40%');
		expect(style).toContain('height: 40%');
		expect(q(mounted, 'svg[part="overlay"]')?.getAttribute('viewBox')).toBe('0 0 100 50');
	});

	test('the selected state is exposed with aria-pressed and a status message', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, { interaction: associateData() });
		await settle();

		const first = qa(mounted, 'button[part="hotspot"]')[0]!;
		first.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(first.getAttribute('aria-pressed')).toBe('true');
		expect(first.classList.contains('qti-ga-hotspot-selected')).toBe(true);
		expect(q(mounted, '[role="status"]')?.textContent).toContain(
			'Selected: Hotspot 1. Select another hotspot to create an association.',
		);
	});

	test('a failed image shows a localized message', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({
				imageData: { type: 'image', src: 'missing.png', width: '100', height: '50', alt: 'Body diagram' },
			}),
		});
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();

		const error = q(mounted, '[part="image-error"]');
		expect(error?.textContent).toContain('The image could not be loaded.');
		expect(error?.textContent).toContain('Body diagram');
	});

	test('matchGroup names partner hotspots: only a named partner completes the pair', async () => {
		// QTI 2.2/3.0: an associableHotspot's matchGroup lists the hotspots it may be matched with.
		// The former label-only rule blocked Heart–Lungs ([H2] and [H1] share no token).
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({
				associableHotspots: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,40,20', matchMax: 1, label: 'Heart', matchGroup: ['H2'] },
					{ identifier: 'H2', shape: 'rect', coords: '50,0,90,20', matchMax: 1, label: 'Lungs', matchGroup: ['H1'] },
					{ identifier: 'H10', shape: 'rect', coords: '0,25,40,45', matchMax: 1, label: 'Liver', matchGroup: ['H3'] },
				],
			}),
		});
		await settle();

		const [heart, lungs, liver] = qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]');
		heart!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(lungs!.getAttribute('aria-disabled')).toBeNull();
		expect(liver!.getAttribute('aria-disabled')).toBe('true');
		expect(liver!.getAttribute('aria-label')).toContain('Not available due to a match group restriction.');

		liver!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(mounted.events).toHaveLength(0);

		lungs!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['H1 H2']);
	});
});
