import type { DrawingInteractionData } from '@pie-qti/item-player';
import { afterEach, describe, expect, test, vi } from 'vitest';
import DrawingInteraction from '../../src/plugins/drawing/DrawingInteraction.svelte';
import { mountInteraction, q, settle } from './helpers';

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

function drawingData(overrides: Partial<DrawingInteractionData> = {}): DrawingInteractionData {
	return {
		type: 'drawingInteraction',
		responseId: 'DRAW',
		prompt: null,
		imageData: { type: 'image', src: 'lab-bench.png', width: '500', height: '400', alt: 'An empty lab bench' },
		rawAttributes: {},
		...overrides,
	};
}

describe('DrawingInteraction (pie-qti-drawing)', () => {
	test('the background image carries the authored alt text instead of being hidden', async () => {
		const mounted = mountInteraction(DrawingInteraction, { interaction: drawingData() });
		await settle();

		const img = q<HTMLImageElement>(mounted, 'img');
		expect(img?.getAttribute('alt')).toBe('An empty lab bench');
		expect(img?.getAttribute('aria-hidden')).toBeNull();
	});

	test('an author-marked decorative background stays hidden from assistive technology', async () => {
		const mounted = mountInteraction(DrawingInteraction, {
			interaction: drawingData({
				imageData: { type: 'image', src: 'paper.png', width: '500', height: '400', decorative: true },
			}),
		});
		await settle();

		// alt="" is the decorative marker: assistive technology skips the image.
		expect(q<HTMLImageElement>(mounted, 'img')?.getAttribute('alt')).toBe('');
	});

	test('a failed background image shows a localized message', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(DrawingInteraction, { interaction: drawingData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img')!.dispatchEvent(new Event('error'));
		await settle();

		const error = q(mounted, '.qti-dc-background-error');
		expect(error?.textContent).toContain('The background image could not be loaded.');
		expect(error?.textContent).toContain('An empty lab bench');
	});

	test('the canvas scales with its container and keeps its authored pixel resolution', async () => {
		const mounted = mountInteraction(DrawingInteraction, { interaction: drawingData() });
		await settle();

		const canvas = q<HTMLCanvasElement>(mounted, 'canvas')!;
		expect(canvas.getAttribute('width')).toBe('500');
		expect(canvas.getAttribute('height')).toBe('400');
		// The wrapper caps at the natural size; the canvas fills it.
		const wrapper = canvas.parentElement as HTMLElement;
		expect(wrapper.getAttribute('style')).toContain('max-width: 500px');
		expect(wrapper.getAttribute('style')).toContain('aspect-ratio: 500 / 400');
	});

	test('without a provider the controls read English fallbacks, never raw catalog keys', async () => {
		const mounted = mountInteraction(DrawingInteraction, { interaction: drawingData() });
		await settle();

		expect(q(mounted, 'button')?.textContent?.trim()).toBe('Clear drawing');
		expect(q(mounted, 'canvas')?.getAttribute('aria-label')).toBe('Drawing canvas');
		expect(mounted.host.textContent).not.toContain('interactions.drawing');
	});

	test('inline SVG backgrounds are exposed by their title alternative unless decorative', async () => {
		const mounted = mountInteraction(DrawingInteraction, {
			interaction: drawingData({
				imageData: {
					type: 'svg',
					content: '<svg viewBox="0 0 500 400"><rect width="500" height="400"/></svg>',
					width: '500',
					height: '400',
					alt: 'Grid paper',
				},
			}),
		});
		await settle();

		const background = q(mounted, '.qti-dc-background-svg')!;
		expect(background.getAttribute('role')).toBe('img');
		expect(background.getAttribute('aria-label')).toBe('Grid paper');
	});
});
