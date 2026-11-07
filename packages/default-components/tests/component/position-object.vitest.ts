import type { PositionObjectInteractionData } from '@pie-qti/item-player';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import PositionObjectInteraction from '../../src/plugins/position-object/PositionObjectInteraction.svelte';
import { mountInteraction, pressKey, q, qa, settle } from './helpers';

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
		centerPoint: true,
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

		remove.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		expect(qa(mounted, '[part="placed"]')).toHaveLength(0);
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
});
