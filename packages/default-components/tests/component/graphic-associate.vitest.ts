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

/** Hotspots whose caps are all explicit zeros: the QTI reading of 0 is "no restriction". */
const UNLIMITED_HOTSPOTS: GraphicAssociateInteractionData['associableHotspots'] = [
	{ identifier: 'H1', shape: 'rect', coords: '0,0,40,20', matchMax: 0, label: 'Hotspot 1' },
	{ identifier: 'H2', shape: 'rect', coords: '50,0,90,20', matchMax: 0, label: 'Hotspot 2' },
	{ identifier: 'H10', shape: 'rect', coords: '0,25,40,45', matchMax: 0, label: 'Hotspot 10' },
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
	test('making a pair announces it and never disables the focused hotspot (round 6)', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({ maxAssociations: 5 }),
		});
		await settle();

		const hotspots = qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]');
		hotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		// A pointer click focuses the activated hotspot; mirror that, since the paired
		// hotspot is what the candidate is on when it maxes out.
		hotspots[1].focus();
		hotspots[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toEqual(['H1 H2']);
		// The pairing is announced from the always-rendered polite region.
		expect(q(mounted, '.qti-ga-live-region')?.textContent).toContain('Association made.');
		// The just-used hotspot (matchMax 1, now maxed) is stated unavailable with
		// aria-disabled; the disabled property is never set, so focus keeps its control.
		const hotspotsAfter = qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]');
		expect(hotspotsAfter[0].disabled).toBe(false);
		expect(hotspotsAfter[0].getAttribute('aria-disabled')).toBe('true');
		expect(hotspotsAfter[1].disabled).toBe(false);
		expect(document.activeElement).toBe(hotspotsAfter[1]);
		cleanupInteraction(mounted);
	});

	test('removing a pair announces it and keeps focus on a control (round 6)', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({ maxAssociations: 5, minAssociations: 0 }),
			response: ['H1 H2', 'H2 H10'],
		});
		await settle();

		// Removing the first pair: focus moves to the remove button now in that row.
		const removes = qa<HTMLButtonElement>(mounted, 'button[part="association-remove"]');
		expect(removes).toHaveLength(2);
		removes[0].focus();
		removes[0].click();
		await settle();

		expect(q(mounted, '.qti-ga-live-region')?.textContent).toContain('Association removed.');
		const remaining = qa<HTMLButtonElement>(mounted, 'button[part="association-remove"]');
		expect(remaining).toHaveLength(1);
		expect(document.activeElement).toBe(remaining[0]);

		// Removing the last pair: focus returns to the hotspots, not the document body.
		remaining[0].focus();
		remaining[0].click();
		await settle();
		expect(document.activeElement?.getAttribute('part')).toBe('hotspot');
		cleanupInteraction(mounted);
	});

	test('refusals are announced: per-hotspot limit and interaction limit (round 6)', async () => {
		// Per-hotspot matchMax refusal: H1 is already paired, activating it again refuses.
		const maxed = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({ maxAssociations: 5 }),
			response: ['H1 H2'],
		});
		await settle();
		const hotspots = qa<HTMLButtonElement>(maxed, 'button[part="hotspot"]');
		hotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(q(maxed, '.qti-ga-live-region')?.textContent).toContain('cannot be in more associations');
		expect(maxed.instance.response).toEqual(['H1 H2']);
		cleanupInteraction(maxed);

		// Interaction maxAssociations refusal: the hotspots can take more (matchMax 2),
		// so reaching the cap is what refuses the third pairing.
		const capped = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({
				maxAssociations: 1,
				associableHotspots: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,40,20', matchMax: 2, label: 'Hotspot 1' },
					{ identifier: 'H2', shape: 'rect', coords: '50,0,90,20', matchMax: 2, label: 'Hotspot 2' },
					{ identifier: 'H10', shape: 'rect', coords: '0,25,40,45', matchMax: 2, label: 'Hotspot 10' },
				],
			}),
			response: ['H1 H2'],
		});
		await settle();
		const cappedHotspots = qa<HTMLButtonElement>(capped, 'button[part="hotspot"]');
		cappedHotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		cappedHotspots[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(q(capped, '.qti-ga-live-region')?.textContent).toContain('limit of 1 is reached');
		expect(capped.instance.response).toEqual(['H1 H2']);
		cleanupInteraction(capped);
	});

	test('maxAssociations=0 is unlimited: pairs keep forming and no "limit of 0" refusal (round 8)', async () => {
		// QTI reads maxAssociations=0 as "no upper bound", the same reading response
		// validation and the sibling pairing surfaces apply. The former literal guard
		// made every second click announce "the limit of 0 is reached".
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({
				maxAssociations: 0,
				associableHotspots: UNLIMITED_HOTSPOTS,
			}),
		});
		await settle();

		const hotspots = qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]');
		hotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		hotspots[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['H1 H2']);

		// A second association still forms past the "0".
		hotspots[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		hotspots[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(mounted.instance.response).toEqual(['H1 H2', 'H2 H10']);
		expect(q(mounted, '.qti-ga-live-region')?.textContent).not.toContain('limit of 0');

		// The counter states the count without a misleading "/0" maximum.
		expect(q(mounted, 'h3.card-title')?.textContent?.trim()).toBe('Associations (2)');
		cleanupInteraction(mounted);
	});

	test('a matchMax=0 hotspot is unlimited: reusable and never refused by name (round 8)', async () => {
		const mounted = mountInteraction(GraphicAssociateInteraction, {
			interaction: associateData({
				maxAssociations: 0,
				associableHotspots: UNLIMITED_HOTSPOTS,
			}),
			response: ['H1 H2'],
		});
		await settle();

		const hotspots = qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]');
		// The accessible name states unlimited instead of a misleading "0/0 connections".
		expect(hotspots[0].getAttribute('aria-label')).toBe('Hotspot 1 (1 connections, unlimited).');
		expect(hotspots[0].getAttribute('aria-disabled')).toBeNull();

		// H1 is already used once, yet a literal "0" reading must not refuse it again.
		hotspots[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		hotspots[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(mounted.instance.response).toEqual(['H1 H2', 'H1 H10']);
		expect(q(mounted, '.qti-ga-live-region')?.textContent).toContain('Association made.');
		cleanupInteraction(mounted);
	});
});
