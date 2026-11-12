import type {
	GraphicAssociateInteractionData,
	GraphicGapMatchInteractionData,
	GraphicOrderInteractionData,
	HotspotInteractionData,
	PositionObjectInteractionData,
	SelectPointInteractionData,
} from '@pie-qti/item-player';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import GraphicOrderInteraction from '../../src/plugins/graphic-order/GraphicOrderInteraction.svelte';
import HotspotInteraction from '../../src/plugins/hotspot/HotspotInteraction.svelte';
import PositionObjectInteraction from '../../src/plugins/position-object/PositionObjectInteraction.svelte';
import SelectPointInteraction from '../../src/plugins/select-point/SelectPointInteraction.svelte';
import { cleanupInteraction, mountInteraction, pressKey, q, qa, settle, type MountedInteraction } from './helpers';

/**
 * The image-stage sizing rule, one table across the graphic interactions: the
 * stage's pixel space is the image's declared width/height, else — for a raster
 * image — its natural size once loaded, else the interaction refuses to draw an
 * overlay or emit points (any guess would silently misplace QTI coords, points
 * and areaMapping, which live in image pixel space). The drawing interaction is
 * not in this table: its canvas resolution is the response's own pixel size,
 * never a scoring space, and a blank canvas is a valid answer.
 *
 * The 800×600 image is rendered at 400 CSS px (half scale) wherever points are
 * emitted, pinning that every interaction reports the same natural-space point
 * and viewBox at any rendered size.
 */

const NATURAL = { width: 800, height: 600 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InteractionComponent = any;

interface Row {
	name: string;
	component: InteractionComponent;
	overlaySelector: string | null;
	data: (imageData: Record<string, unknown>) => Record<string, unknown>;
	/** Emit a point at the centre of the stage rendered at 400×300 CSS px; null when the interaction emits no points. */
	placePoint?: (mounted: MountedInteraction) => Promise<void>;
	/** The emitted point value: select point's single "x y", position object's list. */
	pointResponse: 'single' | 'list';
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

function declareBoth(imageData: Record<string, unknown>): Record<string, unknown> {
	return { ...imageData, width: String(NATURAL.width), height: String(NATURAL.height) };
}

function declareNeither(imageData: Record<string, unknown>): Record<string, unknown> {
	return { ...imageData, width: '', height: '' };
}

const ROWS: Row[] = [
	{
		name: 'hotspot',
		component: HotspotInteraction,
		overlaySelector: 'svg[part="overlay"]',
		data: (imageData) =>
			({
				type: 'hotspotInteraction',
				responseId: 'RESPONSE',
				maxChoices: 1,
				prompt: null,
				imageData,
				hotspotChoices: [
					{ identifier: 'A', shape: 'rect', coords: '100,100,700,500' },
				],
			}) as unknown as HotspotInteractionData,
	},
	{
		name: 'graphic-gap-match',
		component: GraphicGapMatchInteraction,
		overlaySelector: 'svg[part="overlay"]',
		data: (imageData) =>
			({
				type: 'graphicGapMatchInteraction',
				responseId: 'RESPONSE',
				prompt: null,
				imageData,
				gapTexts: [{ identifier: 'L1', text: 'One', matchMax: 1 }],
				hotspots: [{ identifier: 'H1', shape: 'rect', coords: '100,100,700,500', matchMax: 1 }],
			}) as unknown as GraphicGapMatchInteractionData,
	},
	{
		name: 'graphic-order',
		component: GraphicOrderInteraction,
		overlaySelector: 'svg[part="overlay"]',
		data: (imageData) =>
			({
				type: 'graphicOrderInteraction',
				responseId: 'RESPONSE',
				shuffle: false,
				prompt: null,
				imageData,
				hotspotChoices: [{ identifier: 'A', shape: 'rect', coords: '100,100,700,500' }],
			}) as unknown as GraphicOrderInteractionData,
	},
	{
		name: 'graphic-associate',
		component: GraphicAssociateInteraction,
		overlaySelector: 'svg[part="areas"]',
		data: (imageData) =>
			({
				type: 'graphicAssociateInteraction',
				responseId: 'RESPONSE',
				prompt: null,
				imageData,
				associableHotspots: [
					{ identifier: 'A', shape: 'rect', coords: '100,100,700,500', matchMax: 1 },
				],
			}) as unknown as GraphicAssociateInteractionData,
	},
	{
		name: 'select-point',
		component: SelectPointInteraction,
		pointResponse: 'single',
		overlaySelector: null,
		data: (imageData) =>
			({
				type: 'selectPointInteraction',
				responseId: 'RESPONSE',
				prompt: null,
				maxChoices: 1,
				minChoices: 0,
				imageData,
			}) as unknown as SelectPointInteractionData,
		async placePoint(mounted) {
			const area = q<HTMLElement>(mounted, '[part="selection-area"]')!;
			mockRect(area, 0, 0, 400, 300);
			area.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 150 }));
			await settle();
		},
		async placeKeyboardPoint(mounted) {
			const area = q<HTMLElement>(mounted, '[part="selection-area"]')!;
			area.focus();
			await settle();
			pressKey(area, 'Enter');
			await settle();
		},
	},
	{
		name: 'position-object',
		component: PositionObjectInteraction,
		pointResponse: 'list',
		overlaySelector: null,
		data: (imageData) =>
			({
				type: 'positionObjectInteraction',
				responseId: 'RESPONSE',
				prompt: null,
				maxChoices: 1,
				minChoices: 0,
				centerPoint: null,
				imageData,
				positionObjectStages: [
					{
						identifier: 'OBJ',
						label: 'Object',
						matchMax: 1,
						objectData: { type: 'image', src: 'plane.png', width: '40', height: '40' },
					},
				],
			}) as unknown as PositionObjectInteractionData,
		async placePoint(mounted) {
			pressKey(q<HTMLElement>(mounted, '[part="palette-item"]')!, 'Enter');
			await settle();
			const canvas = q<HTMLElement>(mounted, '[part="canvas"]')!;
			mockRect(canvas, 0, 0, 400, 300);
			canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 150 }));
			await settle();
		},
	},
];

function loadNaturalImage(mounted: MountedInteraction) {
	const img = q<HTMLImageElement>(mounted, 'img[part="image"]')!;
	Object.defineProperty(img, 'naturalWidth', { value: NATURAL.width });
	Object.defineProperty(img, 'naturalHeight', { value: NATURAL.height });
	img.dispatchEvent(new Event('load'));
}

function overlay(mounted: MountedInteraction, row: Row) {
	return row.overlaySelector ? q(mounted, row.overlaySelector) : null;
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('image-stage sizing: declared width/height → natural size → refuse', () => {
	for (const row of ROWS) {
		describe(row.name, () => {
			test('a declared 800×600 image stages and scores in 800×600, also when rendered at 400 CSS px', async () => {
				const mounted = mountInteraction(row.component, { interaction: row.data(declareBoth({ type: 'image', src: 'map.png' })) });
				await settle();

				if (row.overlaySelector) {
					expect(overlay(mounted, row)?.getAttribute('viewBox')).toBe('0 0 800 600');
				}
				if (row.placePoint) {
					await row.placePoint(mounted);
					// Half-scale rendering: the click at the CSS-px centre is (400, 300) natural.
					expect(mounted.instance.response).toEqual(row.pointResponse === 'single' ? '400 300' : ['400 300']);
				}
				cleanupInteraction(mounted);
			});

			test('without declared dimensions the raster image stages at its natural size once loaded', async () => {
				const mounted = mountInteraction(row.component, { interaction: row.data(declareNeither({ type: 'image', src: 'map.png' })) });
				await settle();
				// Still loading: no viewBox guess, no warning yet.
				expect(overlay(mounted, row)).toBeNull();
				expect(console.warn).not.toHaveBeenCalled();

				loadNaturalImage(mounted);
				await settle();

				if (row.overlaySelector) {
					expect(overlay(mounted, row)?.getAttribute('viewBox')).toBe('0 0 800 600');
				}
				if (row.placePoint) {
					await row.placePoint(mounted);
					expect(mounted.instance.response).toEqual(row.pointResponse === 'single' ? '400 300' : ['400 300']);
				}
				expect(console.warn).not.toHaveBeenCalled();
				cleanupInteraction(mounted);
			});

			test('an image that fails to load refuses: no overlay, no points, the author is told why', async () => {
				const candidate = mountInteraction(row.component, { interaction: row.data(declareNeither({ type: 'image', src: 'map.png' })) });
				await settle();
				q<HTMLImageElement>(candidate, 'img[part="image"]')!.dispatchEvent(new Event('error'));
				await settle();

				expect(overlay(candidate, row)).toBeNull();
				expect(q(candidate, '[part="diagnostic"]')).toBeNull();
				expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no known width/height'));
				if (row.placePoint) {
					await row.placePoint(candidate);
					expect(candidate.events).toHaveLength(0);
				}
				cleanupInteraction(candidate);

				vi.mocked(console.warn).mockClear();
				const author = mountInteraction(row.component, {
					interaction: row.data(declareNeither({ type: 'image', src: 'map.png' })),
					role: 'author',
				});
				await settle();
				q<HTMLImageElement>(author, 'img[part="image"]')!.dispatchEvent(new Event('error'));
				await settle();

				const diagnostic = q(author, '[part="diagnostic"]');
				expect(diagnostic?.getAttribute('role')).toBe('alert');
				expect(diagnostic?.textContent).toContain('width and height');
				expect(overlay(author, row)).toBeNull();
				cleanupInteraction(author);
			});

			test('inline SVG without declared dimensions is refused at once', async () => {
				const mounted = mountInteraction(row.component, {
					interaction: row.data({ type: 'svg', content: '<svg xmlns="http://www.w3.org/2000/svg"/>' }),
					role: 'author',
				});
				await settle();

				expect(overlay(mounted, row)).toBeNull();
				expect(q(mounted, '[part="diagnostic"]')?.getAttribute('role')).toBe('alert');
				expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no known width/height'));
				cleanupInteraction(mounted);
			});
		});
	}

	test('select-point and position-object emit the same natural-space point as each other at half scale', async () => {
		for (const row of ROWS.filter((r) => r.name === 'select-point' || r.name === 'position-object')) {
			const mounted = mountInteraction(row.component, { interaction: row.data(declareBoth({ type: 'image', src: 'map.png' })) });
			await settle();
			await row.placePoint!(mounted);
			expect(mounted.instance.response).toEqual(row.pointResponse === 'single' ? '400 300' : ['400 300']);
			cleanupInteraction(mounted);
		}
	});
});

