import type { PositionObjectInteractionData } from '@pie-qti/item-player';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import PositionObjectInteraction from '../../src/plugins/position-object/PositionObjectInteraction.svelte';
import { cleanupInteraction, mountInteraction, pressKey, q, qa, settle } from './helpers';

beforeAll(() => {
	// jsdom implements neither DragEvent nor hit-testing; the shared touchDrag helper
	// synthesizes drag events, so give it a minimal DragEvent (no dataTransfer).
	if (typeof (globalThis as { DragEvent?: unknown }).DragEvent === 'undefined') {
		(globalThis as { DragEvent?: unknown }).DragEvent = class DragEvent extends MouseEvent {};
	}
});

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

function positionData(overrides: Partial<PositionObjectInteractionData> = {}): PositionObjectInteractionData {
	return {
		type: 'positionObjectInteraction',
		responseId: 'AIRPORT_SITE_RESPONSE',
		prompt: null,
		maxChoices: 2,
		minChoices: 0,
		centerPoint: null,
		imageData: { type: 'image', src: 'region-map.png', width: '600', height: '400', alt: 'Map of the region' },
		positionObjectStages: [
			{
				identifier: 'AIRPORT_SITE_RESPONSE',
				label: '',
				matchMax: 2,
				objectData: { type: 'image', src: 'plane.png', width: '40', height: '40' },
			},
		],
		...overrides,
	};
}

function canvas(mounted: { host: HTMLElement }): HTMLElement {
	return q<HTMLElement>(mounted, '[part="canvas"]')!;
}

function paletteItem(mounted: { host: HTMLElement }): HTMLElement {
	return q<HTMLElement>(mounted, '[part="palette-item"]')!;
}

function mockRect(element: Element, left: number, top: number, width: number, height: number) {
	vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect);
}

/** A touch event the shared touchDrag helper can read (jsdom has no Touch constructor). */
function touchEvent(type: string, x: number, y: number): Event {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const touch = { identifier: 1, clientX: x, clientY: y };
	Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [touch] });
	Object.defineProperty(event, 'changedTouches', { value: [touch] });
	return event;
}

describe('PositionObjectInteraction (pie-qti-position-object)', () => {
	test('renders the authored alt text on the stage image', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, { interaction: positionData() });
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('Map of the region');
	});

	test('an unnamed object is named generically, never by its response identifier', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData(),
			response: ['300 200'],
		});
		await settle();

		expect(paletteItem(mounted).getAttribute('aria-label')).toMatch(/^Object 1 \(1\/2 used\)\./);
		expect(q(mounted, '[part="placed"]')?.getAttribute('aria-label')).toBe('Object 1 at 50%, 50%.');
		expect(mounted.host.innerHTML).not.toContain('AIRPORT_SITE_RESPONSE');
	});

	test('keyboard: select in the palette, move the crosshair, Enter records the object centre point', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, { interaction: positionData() });
		await settle();

		pressKey(paletteItem(mounted), 'Enter');
		await settle();
		const area = canvas(mounted);
		expect(area.getAttribute('role')).toBe('application');
		expect(document.activeElement).toBe(area);

		pressKey(area, 'ArrowRight');
		await settle();
		pressKey(area, 'Enter');
		await settle();

		// 55% of 600 and 50% of 400: the object's centre, in natural image pixels.
		expect(mounted.instance.response).toEqual(['330 200']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['330 200'] });
		expect(q(mounted, '[aria-live="polite"]')?.textContent).toBe('Object 1 placed at 55%, 50%.');
	});

	test('single-pointer alternative: tap an object, then tap the scaled canvas to place it', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, { interaction: positionData() });
		await settle();

		paletteItem(mounted).click();
		await settle();
		// The 600×400 stage is rendered at half size (300×200) at (0, 0).
		const area = canvas(mounted);
		mockRect(area, 0, 0, 300, 200);
		area.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 50 }));
		await settle();

		expect(mounted.instance.response).toEqual(['300 100']);
	});

	test('touch: dragging an object onto the canvas places it through the shared touch-drag helper', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, { interaction: positionData() });
		await settle();

		const item = paletteItem(mounted);
		const area = canvas(mounted);
		expect(item.getAttribute('draggable')).toBe('true');
		mockRect(area, 0, 0, 300, 200);
		(document as { elementFromPoint?: unknown }).elementFromPoint = vi.fn(() => area);

		item.dispatchEvent(touchEvent('touchstart', 5, 5));
		document.dispatchEvent(touchEvent('touchmove', 60, 60));
		document.dispatchEvent(touchEvent('touchend', 75, 150));
		await settle();

		// Finger at (75, 150) on the half-size stage → (150, 300) in natural image pixels.
		expect(mounted.instance.response).toEqual(['150 300']);
	});

	test('placed objects scale with the stage and are centred on their point', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData(),
			response: ['150 100'],
		});
		await settle();

		const placed = q<HTMLElement>(mounted, '[part="placed"]')!;
		const style = placed.getAttribute('style') ?? '';
		expect(style).toContain('left: 25%');
		expect(style).toContain('top: 25%');
		expect(style).toMatch(/width: 6\.66+7?%/);
		expect(style).toContain('transform: translate(-50%, -50%)');
	});

	test('an authored centerPoint is the point placed on the recorded position', async () => {
		// The 40×40 plane's reference point is 10px in, 5px down: QTI centerPoint="10 5".
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({ centerPoint: { x: 10, y: 5 } }),
			response: ['150 100'],
		});
		await settle();

		const style = q<HTMLElement>(mounted, '[part="placed"]')?.getAttribute('style') ?? '';
		// The box corner starts on the point and shifts back by (10/40, 5/40) of its size.
		expect(style).toContain('left: 25%');
		expect(style).toContain('top: 25%');
		expect(style).toContain('transform: translate(-25%, -12.5%)');
	});

	test('keyboard placement with a centerPoint records the crosshair as the reference point', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({ centerPoint: { x: 10, y: 5 } }),
		});
		await settle();

		pressKey(paletteItem(mounted), 'Enter');
		await settle();
		pressKey(canvas(mounted), 'ArrowRight');
		await settle();
		pressKey(canvas(mounted), 'Enter');
		await settle();

		// The crosshair (55%, 50%) is the response, and the object's reference point sits on it.
		expect(mounted.instance.response).toEqual(['330 200']);
		const style = q<HTMLElement>(mounted, '[part="placed"]')?.getAttribute('style') ?? '';
		expect(Number(style.match(/left: ([\d.]+)%/)?.[1])).toBeCloseTo(55, 6);
		expect(Number(style.match(/top: ([\d.]+)%/)?.[1])).toBeCloseTo(50, 6);
		expect(style).toContain('transform: translate(-25%, -12.5%)');
	});

	test('a dragged object is held by its reference point', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({ centerPoint: { x: 10, y: 5 } }),
		});
		await settle();

		const setDragImage = vi.fn();
		const dragStart = new Event('dragstart', { bubbles: true, cancelable: true });
		Object.defineProperty(dragStart, 'dataTransfer', { value: { effectAllowed: 'none', setDragImage } });
		paletteItem(mounted).dispatchEvent(dragStart);

		// jsdom renders nothing, so the scale is 1: the 40×40 object is held 10px in, 5px down.
		expect(setDragImage).toHaveBeenCalledWith(expect.any(HTMLElement), 10, 5);
	});

	test('hand-built data without a valid centerPoint falls back to the object centre', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			// A host passing JSON may still send the legacy boolean.
			interaction: JSON.stringify({ ...positionData(), centerPoint: true }),
			response: ['150 100'],
		});
		await settle();

		expect(q<HTMLElement>(mounted, '[part="placed"]')?.getAttribute('style')).toContain('transform: translate(-50%, -50%)');
	});

	test('two renderings of the same item keep their own image description ids', async () => {
		const data = positionData({
			imageData: { ...positionData().imageData!, altDescription: 'Two runways cross north of the lake.' },
		});
		const first = mountInteraction(PositionObjectInteraction, { interaction: data });
		const second = mountInteraction(PositionObjectInteraction, { interaction: data });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
		for (const mounted of [first, second]) {
			const description = document.getElementById(q(mounted, 'img[part="image"]')?.getAttribute('aria-describedby') ?? '');
			expect(mounted.host.contains(description)).toBe(true);
			expect(description?.textContent).toBe('Two runways cross north of the lake.');
		}
	});

	test('a placed object is a group holding its remove button, not a button inside a button', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData(),
			response: ['150 100'],
		});
		await settle();

		const placed = q<HTMLElement>(mounted, '[part="placed"]')!;
		expect(placed.getAttribute('role')).toBe('group');
		expect(placed.hasAttribute('tabindex')).toBe(false);
		const remove = placed.querySelector<HTMLButtonElement>('[part="remove"]')!;
		expect(remove.getAttribute('aria-label')).toBe('Remove Object 1');

		remove.focus();
		remove.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		expect(qa(mounted, '[part="placed"]')).toHaveLength(0);
		// The remove button is gone with the object: focus lands on the canvas, not
		// the document body (round 6).
		expect(document.activeElement).toBe(canvas(mounted));
	});

	test('a failed stage image shows a localized message', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(PositionObjectInteraction, { interaction: positionData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();

		const error = q(mounted, '[part="image-error"]');
		expect(error?.textContent).toContain('The image could not be loaded.');
		expect(error?.textContent).toContain('Map of the region');
	});

	test('a keyboard placement refused at maxChoices announces the cap and keeps the placement mode (round 8)', async () => {
		// The palette object can still be picked up (matchMax 2), but a restored response
		// has used up maxChoices=1: Enter used to do nothing, silently.
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({
				maxChoices: 1,
				positionObjectStages: [
					{
						identifier: 'AIRPORT_SITE_RESPONSE',
						label: 'Plane',
						matchMax: 2,
						objectData: { type: 'image', src: 'plane.png', width: '40', height: '40' },
					},
				],
			}),
			response: ['150 100'],
		});
		await settle();

		pressKey(paletteItem(mounted), 'Enter');
		await settle();
		const area = canvas(mounted);
		expect(area.getAttribute('role')).toBe('application');

		pressKey(area, 'Enter');
		await settle();

		expect(mounted.instance.response).toEqual(['150 100']);
		const live = q(mounted, '[aria-live="polite"]')!;
		expect(live.textContent).toBe('The maximum of 1 placement is reached.');

		// Pressing Enter again re-announces: the same text would be no change, so a
		// toggled zero-width space (not read by screen readers) makes it one.
		const firstText = live.textContent;
		pressKey(canvas(mounted), 'Enter');
		await settle();
		expect(live.textContent).not.toBe(firstText);
		expect(live.textContent?.replace(/\u200b/g, '')).toBe('The maximum of 1 placement is reached.');
		expect(mounted.instance.response).toEqual(['150 100']);

		// The crosshair stays active, so the candidate can still leave with Escape.
		expect(canvas(mounted).getAttribute('role')).toBe('application');
		pressKey(canvas(mounted), 'Escape');
		await settle();
		expect(q(mounted, '[aria-live="polite"]')?.textContent).toBe('Placement cancelled.');
		expect(canvas(mounted).getAttribute('role')).toBeNull();
		cleanupInteraction(mounted);
	});

	test('a click-to-place refused at maxChoices announces the cap too (round 8)', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({
				maxChoices: 1,
				positionObjectStages: [
					{
						identifier: 'AIRPORT_SITE_RESPONSE',
						label: 'Plane',
						matchMax: 2,
						objectData: { type: 'image', src: 'plane.png', width: '40', height: '40' },
					},
				],
			}),
			response: ['150 100'],
		});
		await settle();

		paletteItem(mounted).click();
		await settle();
		const area = canvas(mounted);
		mockRect(area, 0, 0, 300, 200);
		area.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 50 }));
		await settle();

		expect(mounted.instance.response).toEqual(['150 100']);
		expect(q(mounted, '[aria-live="polite"]')?.textContent).toBe('The maximum of 1 placement is reached.');
		cleanupInteraction(mounted);
	});

	test('a drop refused at maxChoices announces the cap as well (round 8)', async () => {
		const mounted = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({
				maxChoices: 1,
				positionObjectStages: [
					{
						identifier: 'AIRPORT_SITE_RESPONSE',
						label: 'Plane',
						matchMax: 2,
						objectData: { type: 'image', src: 'plane.png', width: '40', height: '40' },
					},
				],
			}),
			response: ['150 100'],
		});
		await settle();

		const area = canvas(mounted);
		mockRect(area, 0, 0, 300, 200);
		paletteItem(mounted).dispatchEvent(new Event('dragstart', { bubbles: true }));
		area.dispatchEvent(new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 150, clientY: 100 }));
		await settle();

		expect(mounted.instance.response).toEqual(['150 100']);
		expect(q(mounted, '[aria-live="polite"]')?.textContent).toBe('The maximum of 1 placement is reached.');
		cleanupInteraction(mounted);
	});

	test('the maximum is stated up front even when the item declares no minimum (round 8)', async () => {
		const maxOnly = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({ minChoices: 0, maxChoices: 2 }),
		});
		await settle();
		expect(q(maxOnly, '.mt-2')?.textContent).toContain('Maximum: 2');
		expect(q(maxOnly, '.mt-2')?.textContent).not.toContain('Minimum required');
		cleanupInteraction(maxOnly);

		const both = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({ minChoices: 1, maxChoices: 2 }),
		});
		await settle();
		expect(q(both, '.mt-2')?.textContent).toContain('Minimum required: 1');
		expect(q(both, '.mt-2')?.textContent).toContain('Maximum: 2');

		const neither = mountInteraction(PositionObjectInteraction, {
			interaction: positionData({ minChoices: 0, maxChoices: 0 }),
		});
		await settle();
		expect(q(neither, '.mt-2')).toBeNull();
		cleanupInteraction(both, neither);
	});
});
