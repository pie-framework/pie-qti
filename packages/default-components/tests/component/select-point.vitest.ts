import type { SelectPointInteractionData } from '@pie-qti/item-player';
import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SelectPointInteraction from '../../src/plugins/select-point/SelectPointInteraction.svelte';
import { cleanupInteraction, mountInteraction, pressKey, q, qa, settle } from './helpers';

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

function selectPointData(overrides: Partial<SelectPointInteractionData> = {}): SelectPointInteractionData {
	return {
		type: 'selectPointInteraction',
		responseId: 'RESPONSE',
		prompt: '<p>Mark the capital.</p>',
		maxChoices: 1,
		minChoices: 0,
		imageData: { type: 'image', src: 'map.png', width: '500', height: '300', alt: 'Map of the country' },
		...overrides,
	};
}

function surface(mounted: { host: HTMLElement }): HTMLElement {
	return q<HTMLElement>(mounted, '[part="selection-area"]')!;
}

function liveRegion(mounted: { host: HTMLElement }): string {
	return q(mounted, '[aria-live="polite"]')?.textContent?.trim() ?? '';
}

/** Pretend the image is rendered at `width`×`height` CSS px at (left, top). */
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

describe('SelectPointInteraction (pie-qti-select-point)', () => {
	test('renders the authored alt text on the image', async () => {
		const mounted = mountInteraction(SelectPointInteraction, { interaction: selectPointData() });
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('Map of the country');
	});

	test('the selection area is a focusable application with documented keys, not a button', async () => {
		const mounted = mountInteraction(SelectPointInteraction, { interaction: selectPointData() });
		await settle();

		const area = surface(mounted);
		expect(area.getAttribute('role')).toBe('application');
		expect(area.getAttribute('tabindex')).toBe('0');
		expect(area.getAttribute('aria-label')).toBe('Point selection area');
		const instructions = mounted.host.querySelector(`[id="${area.getAttribute('aria-describedby')}"]`);
		expect(instructions?.textContent).toContain('arrow keys');
		expect(instructions?.textContent).toContain('Enter or Space');
		// No role="button" anywhere around the image.
		expect(q(mounted, '[part="stage"][role="button"], .qti-sp-canvas [role="button"]')).toBeNull();
	});

	test('no interactive element is nested inside the selection area or the image stage', async () => {
		const mounted = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData({ maxChoices: 2 }),
			response: ['100 100', '200 150'],
		});
		await settle();

		const stage = q(mounted, '[part="stage"]')!;
		expect(stage.querySelectorAll('button, [role="button"], a[href], input')).toHaveLength(0);
		// The markers on the image are decorative mirrors of the accessible point list.
		expect(stage.querySelector('[part="point"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
	});

	test('keyboard placement: arrows move the crosshair, Enter places a point in image pixels', async () => {
		const mounted = mountInteraction(SelectPointInteraction, { interaction: selectPointData() });
		await settle();

		const area = surface(mounted);
		area.focus();
		await settle();
		pressKey(area, 'ArrowRight');
		pressKey(area, 'ArrowRight');
		pressKey(area, 'ArrowDown');
		await settle();
		expect(liveRegion(mounted)).toBe('Position: 60%, 55%.');

		pressKey(area, 'Enter');
		await settle();

		// 60% of 500 and 55% of 300, in the image's natural pixel space
		expect(mounted.instance.response).toBe('300 165');
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: '300 165' });
		expect(liveRegion(mounted)).toBe('Point 1 placed at 60%, 55%.');
	});

	test('keyboard placement: Shift gives fine steps, and the crosshair clamps at the stage edges', async () => {
		// Unlimited (maxChoices 0) so each Enter places another point.
		const mounted = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData({ maxChoices: 0 }),
		});
		await settle();

		const area = surface(mounted);
		area.focus();
		await settle();
		// One fine step from the centre (50%, 50%): 51% of 500 and 50% of 300.
		pressKey(area, 'ArrowRight', { shiftKey: true });
		pressKey(area, 'Enter');
		await settle();
		expect(mounted.instance.response).toEqual(['255 150']);

		// Twelve large steps right from 51% clamp at the right edge: 100% of 500.
		for (let step = 0; step < 12; step++) pressKey(area, 'ArrowRight');
		pressKey(area, 'Enter');
		await settle();
		expect(mounted.instance.response).toEqual(['255 150', '500 150']);

		// Twelve large steps down from 50% clamp at the bottom edge.
		for (let step = 0; step < 12; step++) pressKey(area, 'ArrowDown');
		pressKey(area, 'Enter');
		await settle();
		expect(mounted.instance.response).toEqual(['255 150', '500 150', '500 300']);

		// Twenty large steps left clamp at the left edge: 0%, never past the image.
		for (let step = 0; step < 20; step++) pressKey(area, 'ArrowLeft');
		pressKey(area, 'Enter');
		await settle();
		expect(mounted.instance.response).toEqual(['255 150', '500 150', '500 300', '0 300']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['255 150', '500 150', '500 300', '0 300'] });
	});

	test('pointer placement maps the scaled rendering back to natural image coordinates', async () => {
		const mounted = mountInteraction(SelectPointInteraction, { interaction: selectPointData() });
		await settle();

		// The 500×300 image is rendered at half size (250×150) at (10, 20).
		const area = surface(mounted);
		mockRect(area, 10, 20, 250, 150);
		area.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10 + 125, clientY: 20 + 75 }));
		await settle();

		expect(mounted.instance.response).toBe('250 150');
	});

	test('placed points are listed with "Remove point N" buttons; removal is announced', async () => {
		const mounted = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData({ maxChoices: 2 }),
			response: ['100 60', '400 240'],
		});
		await settle();

		const items = qa(mounted, '[part="points"] li');
		expect(items).toHaveLength(2);
		expect(items[0]!.textContent).toContain('Point 1 at 20%, 20%');
		const removeButtons = qa<HTMLButtonElement>(mounted, '[part="remove-point"]');
		expect(removeButtons.map((button) => button.textContent?.trim())).toEqual(['Remove point 1', 'Remove point 2']);

		removeButtons[0]!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['400 240']);
		expect(liveRegion(mounted)).toBe('Point 1 removed.');
		expect(qa(mounted, '[part="points"] li')).toHaveLength(1);
	});

	test('a response is read only in the QTI "x y" point form', async () => {
		// `{x, y}` objects are not a QTI point value: they place nothing.
		const objects = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData({ maxChoices: 2 }),
			response: [{ x: 100, y: 60 }] as unknown as string[],
		});
		const single = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData(),
			response: { x: 100, y: 60 } as unknown as string,
		});
		const canonical = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData(),
			response: '100 60',
		});
		await settle();

		expect(qa(objects, '[part="points"] li')).toHaveLength(0);
		expect(qa(single, '[part="points"] li')).toHaveLength(0);
		expect(qa(canonical, '[part="points"] li')).toHaveLength(1);
	});

	test('reaching maxChoices announces the limit instead of placing', async () => {
		const mounted = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData(),
			response: '100 100',
		});
		await settle();

		const area = surface(mounted);
		pressKey(area, 'Enter');
		await settle();

		expect(mounted.events).toHaveLength(0);
		expect(liveRegion(mounted)).toContain('Maximum points reached');
	});

	test('maxChoices=0 means no restriction: points keep placing and the response is an array', async () => {
		// The QTI 2.2/3.0 default for an absent maxChoices on a multiple-point response.
		const mounted = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData({ maxChoices: 0 }),
			response: ['100 60', '400 240'],
		});
		await settle();

		pressKey(surface(mounted), 'Enter');
		await settle();

		expect(Array.isArray(mounted.instance.response)).toBe(true);
		expect(mounted.instance.response).toHaveLength(3);
		expect(liveRegion(mounted)).not.toContain('Maximum points reached');
	});

	test('a failed image shows a localized message; the selection area keeps working', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(SelectPointInteraction, { interaction: selectPointData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();

		expect(q(mounted, '[part="image-error"]')?.textContent).toContain('The image could not be loaded.');
		expect(surface(mounted)).not.toBeNull();
		expect(warn).toHaveBeenCalled();
	});

	test('disabled: the selection area leaves the tab order and ignores input', async () => {
		const mounted = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData(),
			disabled: true,
		});
		await settle();

		const area = surface(mounted);
		expect(area.getAttribute('tabindex')).toBe('-1');
		pressKey(area, 'Enter');
		area.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }));
		await settle();

		expect(mounted.events).toHaveLength(0);
	});

	test('the clear control is "Clear answer", the name choice, hottext and hotspot use for it (WCAG 3.2.4)', async () => {
		const nl = new DefaultI18nProvider('nl');
		await nl.loadLocale('nl');
		for (const i18n of [undefined, nl]) {
			const mounted = mountInteraction(SelectPointInteraction, {
				interaction: selectPointData({ maxChoices: 2 }),
				response: ['100 100', '200 150'],
				i18n,
			});
			await settle();

			const expected = i18n ? i18n.t('interactions.choice.clearAnswer') : 'Clear answer';
			expect(expected).not.toBe('interactions.choice.clearAnswer');
			const clear = qa<HTMLButtonElement>(mounted, 'button').find((button) => button.textContent?.trim() === expected);
			expect(clear).toBeDefined();
			expect(mounted.host.textContent).not.toContain('Clear All');

			clear!.click();
			await settle();
			expect(mounted.instance.response).toEqual([]);
			expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: [] });
			expect(qa(mounted, 'button').some((button) => button.textContent?.trim() === expected)).toBe(false);
			cleanupInteraction(mounted);
		}
	});
});

// createInteractionShell's rule: correct-answer mode is the scorer's view of an item that has a
// correct response. Hosts pass null when the item declares none; a scorer then sees the
// interaction as a candidate does. Only `disabled` stops interaction.
describe('SelectPointInteraction correct-answer mode: role × correct response', () => {
	test.each([
		['candidate', ['100 100'], false],
		['candidate', null, false],
		['scorer', ['100 100'], true],
		['scorer', null, false],
	] as const)('%s, correct response %j: correct-answer mode is %s, and placing emits', async (role, correctResponse, correctMode) => {
		const mounted = mountInteraction(SelectPointInteraction, { interaction: selectPointData(), role, correctResponse });
		await settle();

		expect(q(mounted, '[part="correct-points"]') !== null).toBe(correctMode);
		expect(qa(mounted, '[part="correct-point"]')).toHaveLength(correctMode ? 1 : 0);

		const area = surface(mounted);
		area.focus();
		await settle();
		pressKey(area, 'Enter');
		await settle();
		// The crosshair starts at the centre: 50% of 500 and of 300, in natural image pixels.
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: '250 150' });
		cleanupInteraction(mounted);
	});

	test('disabled stops placement for a scorer without a correct response too', async () => {
		const mounted = mountInteraction(SelectPointInteraction, {
			interaction: selectPointData(),
			role: 'scorer',
			correctResponse: null,
			disabled: true,
		});
		await settle();

		pressKey(surface(mounted), 'Enter');
		await settle();
		expect(mounted.events).toHaveLength(0);
		cleanupInteraction(mounted);
	});
});
