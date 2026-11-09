import { DefaultI18nProvider } from '@pie-qti/i18n';
import type { GraphicOrderInteractionData } from '@pie-qti/item-player';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import GraphicOrderInteraction from '../../src/plugins/graphic-order/GraphicOrderInteraction.svelte';
import {
	accessibleName,
	cleanupInteraction,
	mountInteraction,
	qa,
	q,
	settle,
} from './helpers';

let nl: DefaultI18nProvider;

beforeAll(async () => {
	nl = new DefaultI18nProvider('nl');
	await nl.loadLocale('nl');
});

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

function orderData(overrides: Partial<GraphicOrderInteractionData> = {}): GraphicOrderInteractionData {
	return {
		type: 'graphicOrderInteraction',
		responseId: 'RESPONSE',
		prompt: null,
		imageData: {
			type: 'image',
			src: 'strata.png',
			width: '600',
			height: '350',
			alt: 'A cliff face showing four rock strata',
		},
		hotspotChoices: [
			{ identifier: 'BEDROCK_CORRECT_LAST', shape: 'rect', coords: '0,0,100,50', label: 'Bedrock' },
			{ identifier: 'TOPSOIL_CORRECT_FIRST', shape: 'rect', coords: '0,50,100,100', label: 'Top Soil' },
			{ identifier: 'SEDIMENT', shape: 'rect', coords: '0,100,100,150', label: '' },
		],
		...overrides,
	};
}

describe('GraphicOrderInteraction (pie-qti-graphic-order)', () => {
	test('the image carries the authored alt text and scales with its container', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		const img = q<HTMLImageElement>(mounted, 'img[part="image"]')!;
		expect(img.getAttribute('alt')).toBe('A cliff face showing four rock strata');
		// No fixed pixel size: the frame (not the img) caps the rendered size.
		expect(img.hasAttribute('style')).toBe(false);
		const frame = img.parentElement as HTMLElement;
		expect(frame.getAttribute('style')).toContain('max-width: 600px');
	});

	test('an image without authored alt gets a generic localized name, never an interaction name', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, {
			interaction: orderData({ imageData: { type: 'image', src: 'x.png', width: '600', height: '350' } }),
		});
		await settle();

		const alt = q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt');
		expect(alt).toBe('Image for this question');
	});

	test('an author-marked decorative image gets an empty alt', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, {
			interaction: orderData({
				imageData: { type: 'image', src: 'x.png', width: '600', height: '350', decorative: true },
			}),
		});
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('');
	});

	test('the ordering list never exposes identifiers in accessible names', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		const items = qa(mounted, '[draggable="true"]');
		expect(items).toHaveLength(3);
		const names = items.map((item) => accessibleName(item));
		expect(names[0]).toContain('Bedrock');
		expect(names[2]).toContain('Item 3'); // unlabelled hotspot falls back to a localized ordinal
		// Identifiers may appear in element ids (stable labelledby targets), but never in
		// anything a candidate perceives: rendered/sr-only text or computed names.
		const perceived = [
			mounted.host.textContent ?? '',
			...qa(mounted, 'button, [role]').map((element) => accessibleName(element)),
			...qa(mounted, '[aria-label], [title]').map(
				(element) => `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`,
			),
		].join(' ');
		expect(perceived).not.toContain('BEDROCK_CORRECT_LAST');
		expect(perceived).not.toContain('TOPSOIL_CORRECT_FIRST');
	});

	test('a failed image shows a localized message instead of a broken image', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();

		const error = q(mounted, '[part="image-error"]');
		expect(error?.textContent).toContain('The image could not be loaded.');
		expect(error?.textContent).toContain('A cliff face showing four rock strata');
		expect(q(mounted, 'img[part="image"]')).toBeNull();
	});

	test('reorder announcements are localized: SortableList receives the provider', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, {
			interaction: orderData(),
			i18n: nl,
		});
		await settle();

		// The list label comes from the nl catalog only if the provider was passed through.
		expect(q(mounted, '[aria-label="Herschikbare lijst met keuzes"]')).not.toBeNull();
	});
	test('confirm keeps its control mounted, focused, and announced (round 6)', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		const confirm = q<HTMLButtonElement>(mounted, 'button[part="confirm-button"]')!;
		expect(confirm).not.toBeNull();
		confirm.focus();
		confirm.click();
		await settle();

		// The control is not removed: it flips to a disabled "Order confirmed" state and
		// keyboard focus stays on it instead of falling to the document body.
		const confirmed = q<HTMLButtonElement>(mounted, 'button[part="confirmed"]');
		expect(confirmed).not.toBeNull();
		expect(confirmed?.getAttribute('aria-disabled')).toBe('true');
		expect(confirmed?.getAttribute('tabindex')).toBe('-1');
		expect(confirmed?.textContent).toContain('Order confirmed');
		expect(document.activeElement).toBe(confirmed);

		// The always-present polite region announces the confirmation.
		const live = mounted.host.querySelector('.qti-go-confirmation-live');
		expect(live?.textContent).toContain('Order confirmed');
	});
});

/**
 * QTI 3.0 §5.61 GraphicOrderInteraction: "The delivery engine must clearly indicate all defined
 * area(s) of the image." Every area is outlined over the image, each placed one with its
 * position in the order; the ordering list stays the control.
 */
describe('GraphicOrderInteraction shows its areas on the image', () => {
	/** Each area's badge text, in hotspotChoice order ('' for an area without a position). */
	function areaBadges(mounted: ReturnType<typeof mountInteraction>): string[] {
		return qa(mounted, 'svg[part="overlay"] .qti-go-area').map(
			(area) => area.querySelector('.qti-go-badge')?.textContent?.trim() ?? '',
		);
	}

	test('every defined area is outlined in an overlay in the image pixel space', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		const overlay = q<SVGSVGElement>(mounted, 'svg[part="overlay"]')!;
		expect(overlay).not.toBeNull();
		expect(overlay.getAttribute('viewBox')).toBe('0 0 600 350');
		// It lies over the image, in the same box that scales with it.
		expect(overlay.parentElement).toBe(q(mounted, 'img[part="image"]')!.parentElement);

		const areas = qa(mounted, 'svg[part="overlay"] .qti-go-area');
		expect(areas).toHaveLength(3);
		for (const [index, area] of areas.entries()) {
			const outline = area.querySelector('.qti-go-area-outline')!;
			expect(outline.tagName).toBe('rect');
			expect([outline.getAttribute('x'), outline.getAttribute('y')]).toEqual(['0', String(index * 50)]);
			expect([outline.getAttribute('width'), outline.getAttribute('height')]).toEqual(['100', '50']);
		}
	});

	test('the overlay is visual only: hidden from assistive technology, no focus, no pointer input', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		const overlay = q(mounted, 'svg[part="overlay"]')!;
		expect(overlay.getAttribute('aria-hidden')).toBe('true');
		expect(overlay.getAttribute('pointer-events')).toBe('none');
		expect(overlay.querySelectorAll('[tabindex], [role]')).toHaveLength(0);
		// Positions only, never identifiers.
		expect(overlay.innerHTML).not.toContain('BEDROCK_CORRECT_LAST');
	});

	test('each area carries its position in the order the list shows, and follows a reorder', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();
		// Before any answer the list shows the authored order.
		expect(areaBadges(mounted)).toEqual(['1', '2', '3']);

		q<HTMLButtonElement>(mounted, 'button[aria-label="Move Top Soil earlier"]')!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['TOPSOIL_CORRECT_FIRST', 'BEDROCK_CORRECT_LAST', 'SEDIMENT']);
		expect(areaBadges(mounted)).toEqual(['2', '1', '3']);
	});

	test('a restored order numbers the areas by it', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, {
			interaction: orderData(),
			response: ['SEDIMENT', 'BEDROCK_CORRECT_LAST', 'TOPSOIL_CORRECT_FIRST'],
		});
		await settle();

		expect(areaBadges(mounted)).toEqual(['2', '3', '1']);
	});

	test('subset ordering: only the ordered areas carry a position', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, {
			interaction: orderData({
				hotspotChoices: [
					{ identifier: 'H1', shape: 'rect', coords: '0,0,100,50', label: 'Bedrock' },
					{ identifier: 'H2', shape: 'circle', coords: '150,75,25', label: 'Top Soil' },
					{ identifier: 'H3', shape: 'poly', coords: '0,100,100,100,50,150', label: 'Sediment' },
				],
				minChoices: 1,
				maxChoices: 2,
			}),
			response: ['H3', 'H1'],
		});
		await settle();

		expect(areaBadges(mounted)).toEqual(['2', '', '1']);
		const areas = qa(mounted, 'svg[part="overlay"] .qti-go-area');
		expect(areas.map((area) => area.hasAttribute('data-placed'))).toEqual([true, false, true]);
		// Every area is outlined all the same, placed or not, in its own shape.
		expect(areas.map((area) => area.querySelector('.qti-go-area-outline')?.tagName)).toEqual(['rect', 'circle', 'polygon']);
	});

	test('no overlay over an image that failed to load', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();
	});
});

/**
 * Subset ordering (QTI 2.2 ASI §5.42): minChoices below the hotspot count lets the candidate
 * rank a subset; hotspots outside the order show no position number and wait in the pool.
 */
describe('GraphicOrderInteraction subset ordering', () => {
	function subsetData(overrides: Partial<GraphicOrderInteractionData> = {}): GraphicOrderInteractionData {
		return orderData({
			hotspotChoices: [
				{ identifier: 'H1', shape: 'rect', coords: '0,0,100,50', label: 'Bedrock' },
				{ identifier: 'H2', shape: 'rect', coords: '0,50,100,100', label: 'Top Soil' },
				{ identifier: 'H3', shape: 'rect', coords: '0,100,100,150', label: 'Sediment' },
				{ identifier: 'H4', shape: 'rect', coords: '0,150,100,200', label: 'Clay' },
				{ identifier: 'H5', shape: 'rect', coords: '0,200,100,250', label: '' },
			],
			minChoices: 2,
			maxChoices: 3,
			...overrides,
		});
	}

	async function addItem(mounted: ReturnType<typeof mountInteraction>, id: string) {
		q<HTMLButtonElement>(mounted, `button[part="pool-add"][data-id="${id}"]`)!.click();
		await settle();
	}

	test('subset mode renders two zones and starts with an empty order', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: subsetData() });
		await settle();

		expect(q(mounted, '[data-subset-mode="true"]')).not.toBeNull();
		expect(q(mounted, '[part="ordered-empty"]')?.textContent).toContain('Nothing is in your order yet.');
		const pool = qa<HTMLButtonElement>(mounted, 'button[part="pool-add"]');
		expect(pool.map((b) => b.dataset.id)).toEqual(['H1', 'H2', 'H3', 'H4', 'H5']);
		// Named by the authored label, or the localized ordinal for an unlabelled hotspot —
		// never the identifier.
		expect(pool[4]?.getAttribute('aria-label')).toBe('Add Item 5 to your order');
		cleanupInteraction(mounted);
	});

	test('the limits are stated up front and the list describes them', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: subsetData() });
		await settle();

		expect(q(mounted, '[part="min-hint"]')?.textContent).toBe('Choose between 2 and 3 items and put them in order.');
		const hintId = q(mounted, '[part="min-hint"]')?.id;
		const described = q(mounted, '[role="list"]')?.getAttribute('aria-describedby') ?? '';
		expect(described.split(/\s+/)).toContain(hintId);
		cleanupInteraction(mounted);
	});

	test('adding and removing updates the two zones and the response', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: subsetData() });
		await settle();

		await addItem(mounted, 'H4');
		await addItem(mounted, 'H1');

		expect(mounted.instance.response).toEqual(['H4', 'H1']);
		expect(qa(mounted, '[part="ordered-zone"] button[part="item"]').map((row) => row.textContent?.trim())).toEqual([
			'Clay',
			'Bedrock',
		]);
		expect(qa(mounted, 'button[part="pool-add"]').map((b) => b.dataset.id)).toEqual(['H2', 'H3', 'H5']);

		q<HTMLButtonElement>(mounted, 'button[part="order-remove"][data-id="H4"]')!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['H1']);
		expect(qa(mounted, 'button[part="pool-add"]').map((b) => b.dataset.id)).toEqual(['H2', 'H3', 'H4', 'H5']);
		cleanupInteraction(mounted);
	});

	test('adding past the cap is refused and announced, with a re-announce toggle', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: subsetData() });
		await settle();

		await addItem(mounted, 'H1');
		await addItem(mounted, 'H2');
		await addItem(mounted, 'H3');
		expect(mounted.instance.response).toEqual(['H1', 'H2', 'H3']);

		await addItem(mounted, 'H4');
		expect(mounted.instance.response).toEqual(['H1', 'H2', 'H3']);
		const live = mounted.host.querySelector('[data-subset-live]');
		const firstRefusal = live?.textContent?.length ?? 0;
		expect(live?.textContent).toContain('Your order can hold up to 3 items. Remove one to add another.');

		await addItem(mounted, 'H4');
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent?.length).toBeGreaterThan(firstRefusal);
		cleanupInteraction(mounted);
	});

	test('add and remove announce through the component live region', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: subsetData() });
		await settle();

		await addItem(mounted, 'H2');
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent).toContain(
			'Top Soil added to your order at position 1 of 1.',
		);

		q<HTMLButtonElement>(mounted, 'button[part="order-remove"][data-id="H2"]')!.click();
		await settle();
		expect(mounted.host.querySelector('[data-subset-live]')?.textContent).toContain(
			'Top Soil removed from your order.',
		);
		cleanupInteraction(mounted);
	});

	test('full mode keeps rendering the single full-permutation list', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: orderData() });
		await settle();

		expect(q(mounted, '[data-subset-mode="true"]')).toBeNull();
		expect(qa(mounted, '[draggable="true"]')).toHaveLength(3);
		cleanupInteraction(mounted);
	});

	test('hotspots outside the order show no position number', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: subsetData(), response: ['H3', 'H1'] });
		await settle();

		const badges = qa(mounted, '[part="ordered-zone"] [part="index"]').map((badge) => badge.getAttribute('data-text'));
		expect(badges).toEqual(['1', '2']);
		expect(qa(mounted, '[part="pool-zone"] [part="index"]')).toHaveLength(0);
		cleanupInteraction(mounted);
	});

	test('emptying the order is a NULL response, and no confirm step is offered', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, { interaction: subsetData(), response: ['H2'] });
		await settle();

		expect(q(mounted, 'button[part="confirm-button"]')).toBeNull();
		q<HTMLButtonElement>(mounted, 'button[part="order-remove"][data-id="H2"]')!.click();
		await settle();
		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: null });
		expect(q(mounted, 'button[part="confirm-button"]')).toBeNull();
		cleanupInteraction(mounted);
	});

	test('the scorer view lists the authored subset as the correct order', async () => {
		const mounted = mountInteraction(GraphicOrderInteraction, {
			interaction: subsetData(),
			role: 'scorer',
			disabled: true,
			correctResponse: ['H2', 'H4'],
		});
		await settle();

		expect(qa(mounted, '[part="correct-order"] li').map((li) => li.textContent?.trim())).toEqual(['Top Soil', 'Clay']);
		expect(qa(mounted, 'button[part="order-remove"]')).toHaveLength(0);
		cleanupInteraction(mounted);
	});
});
