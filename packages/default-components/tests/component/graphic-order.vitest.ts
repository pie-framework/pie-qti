import { DefaultI18nProvider } from '@pie-qti/i18n';
import type { GraphicOrderInteractionData } from '@pie-qti/item-player';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import GraphicOrderInteraction from '../../src/plugins/graphic-order/GraphicOrderInteraction.svelte';
import {
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
		const names = items.map((item) => item.getAttribute('aria-label') ?? '');
		expect(names[0]).toContain('Bedrock');
		expect(names[2]).toContain('Item 3'); // unlabelled hotspot falls back to a localized ordinal
		expect(mounted.host.innerHTML).not.toContain('BEDROCK_CORRECT_LAST');
		expect(mounted.host.innerHTML).not.toContain('TOPSOIL_CORRECT_FIRST');
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
});
