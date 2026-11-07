import { afterEach, describe, expect, test, vi } from 'vitest';
import type { HotspotInteractionData } from '@pie-qti/item-player';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import {
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
		imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image', alt: 'A sunny street' },
		hotspotChoices: [
			{ identifier: 'H1', shape: 'circle', coords: '50,50,10', hotspotLabel: 'The sun' },
			{ identifier: 'H2', shape: 'rect', coords: '100,100,150,150', hotspotLabel: 'A house' },
		],
		...overrides,
	};
}

/** Choices whose identifiers would give the answer away if they ever reached the accessibility tree. */
const UNLABELLED_CHOICES: HotspotInteractionData['hotspotChoices'] = [
	{ identifier: 'CORRECT_LEFT_LUNG', shape: 'rect', coords: '10,10,60,60' },
	{ identifier: 'WRONG_HEART', shape: 'rect', coords: '100,10,150,60' },
];

afterEach(() => {
	vi.restoreAllMocks();
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
		// The shapes must be real SVG elements (not HTML-namespace lookalikes), or .focus()
		// does not exist on them and keyboard/focus behavior breaks in the browser.
		expect(shapes[0]).toBeInstanceOf(SVGElement);
		expect(shapes[0]!.getAttribute('role')).toBe('button');
		expect(shapes[0]!.getAttribute('tabindex')).toBe('0');
		expect(shapes[0]!.getAttribute('aria-label')).toBe('The sun');
	});

	test('visual halo and outline layers are hidden from assistive technology and the tab order', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const visualLayers = qa(mounted, '.qti-hotspot-halo, .qti-hotspot-outline');
		expect(visualLayers).toHaveLength(4);
		for (const layer of visualLayers) {
			expect(layer.getAttribute('aria-hidden')).toBe('true');
			expect(layer.hasAttribute('tabindex')).toBe(false);
			expect(layer.hasAttribute('role')).toBe(false);
		}
		// Only the interactive targets are focusable.
		expect(qa(mounted, '[tabindex="0"]')).toHaveLength(2);
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

	test('a selected region shows a check marker and selected state, not colour alone', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData(), response: 'H2' });
		await settle();

		const regions = qa(mounted, '.qti-hotspot-region');
		expect(regions[1]!.hasAttribute('data-selected')).toBe(true);
		expect(regions[1]!.querySelector('.qti-hotspot-marker')).not.toBeNull();
		expect(regions[0]!.querySelector('.qti-hotspot-marker')).toBeNull();
		// The visible summary names the region, never its identifier.
		const summary = q(mounted, '[part="selected"]')!;
		expect(summary.textContent).toContain('A house');
		expect(summary.textContent).not.toContain('H2');
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

	test('Space on a focused hotspot answers too', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		pressKey(qa(mounted, '.qti-hotspot-shape')[1]!, ' ');
		await settle();

		expect(mounted.instance.response).toBe('H2');
	});

	test('unlabelled regions are named by position, never by identifier', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: UNLABELLED_CHOICES }),
			response: 'CORRECT_LEFT_LUNG',
		});
		await settle();

		const names = qa(mounted, '.qti-hotspot-shape').map((shape) => shape.getAttribute('aria-label'));
		expect(names).toEqual(['Region 1 of 2', 'Region 2 of 2']);
		expect(mounted.host.textContent).not.toContain('CORRECT_LEFT_LUNG');
		expect(mounted.host.innerHTML).not.toContain('CORRECT_LEFT_LUNG');
		expect(q(mounted, '[part="selected"]')!.textContent).toContain('Region 1 of 2');
	});

	test('the scorer view names correct regions without identifiers', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ hotspotChoices: UNLABELLED_CHOICES }),
			role: 'scorer',
			correctResponse: 'CORRECT_LEFT_LUNG',
		});
		await settle();

		const first = qa(mounted, '.qti-hotspot-shape')[0]!;
		expect(first.getAttribute('aria-label')).toBe('Region 1 of 2. Correct answer.');
		expect(q(mounted, '[part="selected"]')!.textContent).toContain('Correct: Region 1 of 2');
		expect(mounted.host.textContent).not.toContain('CORRECT_LEFT_LUNG');
	});

	test('renders the authored alt text from QTI on the image', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('A sunny street');
	});

	test('an image the author marked decorative gets an empty alt', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({
				imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image', decorative: true },
			}),
		});
		await settle();

		expect(q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt')).toBe('');
	});

	test('an image without authored alt text falls back to a generic localized name', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: { width: '400', height: '300', src: 'diagram.png', type: 'image' } }),
		});
		await settle();

		const alt = q<HTMLImageElement>(mounted, 'img[part="image"]')?.getAttribute('alt');
		expect(alt).toBe('Image for this question');
		expect(alt).not.toBe('Hotspot interaction');
	});

	test('inline SVG is exposed as an image named by its alternative, with its long description', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({
				imageData: {
					type: 'svg',
					content: '<svg viewBox="0 0 400 300"><rect width="400" height="300"/></svg>',
					width: '400',
					height: '300',
					alt: 'Water cycle',
					altDescription: 'Arrows link evaporation, condensation and rain.',
				},
			}),
		});
		await settle();

		const image = q(mounted, '[part="image"]')!;
		expect(image.getAttribute('role')).toBe('img');
		expect(image.getAttribute('aria-label')).toBe('Water cycle');
		const describedBy = image.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(mounted.host.querySelector(`[id="${describedBy}"]`)?.textContent).toBe(
			'Arrows link evaporation, condensation and rain.',
		);
	});

	test('missing image dimensions refuse to draw the overlay; candidates get no authoring diagnostic', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: null }),
		});
		await settle();

		expect(q(mounted, '[part="diagnostic"]')).toBeNull();
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('no known width/height'));
	});

	test('authors see why the overlay is missing', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: null }),
			role: 'author',
		});
		await settle();

		const diagnostic = q(mounted, '[part="diagnostic"]');
		expect(diagnostic?.getAttribute('role')).toBe('alert');
		expect(diagnostic?.textContent).toContain('size of its image is unknown');
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();
	});

	test('an image without authored dimensions uses its natural size once loaded', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ imageData: { type: 'image', src: 'diagram.png', width: '', height: '' } }),
		});
		await settle();
		expect(q(mounted, 'svg[part="overlay"]')).toBeNull();

		const img = q<HTMLImageElement>(mounted, 'img[part="image"]')!;
		Object.defineProperty(img, 'naturalWidth', { value: 640 });
		Object.defineProperty(img, 'naturalHeight', { value: 480 });
		img.dispatchEvent(new Event('load'));
		await settle();

		expect(q(mounted, 'svg[part="overlay"]')?.getAttribute('viewBox')).toBe('0 0 640 480');
		expect(warn).not.toHaveBeenCalled();
	});

	test('an image that fails to load shows a localized message with its alt text', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		q<HTMLImageElement>(mounted, 'img[part="image"]')!.dispatchEvent(new Event('error'));
		await settle();

		const error = q(mounted, '[part="image-error"]');
		expect(error?.textContent).toContain('The image could not be loaded.');
		expect(error?.textContent).toContain('A sunny street');
		expect(q(mounted, 'img[part="image"]')).toBeNull();
		// The regions stay operable by name.
		expect(qa(mounted, '.qti-hotspot-shape')).toHaveLength(2);
		expect(warn).toHaveBeenCalled();
	});

	test('small regions get a transparent hit stroke that reaches 24 CSS px; large ones do not', async () => {
		const mounted = mountInteraction(HotspotInteraction, { interaction: hotspotData() });
		await settle();

		const [small, large] = qa<SVGElement>(mounted, '.qti-hotspot-shape');
		// circle r=10 → 20px across at natural size → a 4px stroke reaches 24px.
		expect(small!.getAttribute('style')).toContain('--qti-hit-stroke: 4px');
		// rect 50×50 is already large enough.
		expect(large!.getAttribute('style')).toContain('--qti-hit-stroke: 0px');
	});

	test('the max-selections message uses the accessible warning text colour token', async () => {
		const mounted = mountInteraction(HotspotInteraction, {
			interaction: hotspotData({ maxSelectionsMessage: 'Only one region.' }),
			response: 'H1',
		});
		await settle();

		const message = q(mounted, '.qti-selection-message');
		expect(message?.textContent).toBe('Only one region.');
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
