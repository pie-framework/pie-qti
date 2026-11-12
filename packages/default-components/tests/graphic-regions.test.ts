import { describe, expect, test } from 'bun:test';
import { regionMarkerPoint, shapeBounds, shapeCenter } from '../src/shared/utils/graphicRegions';

describe('regionMarkerPoint', () => {
	test('a shaped region is marked at its centre, in image coordinates, at any scale', () => {
		expect(regionMarkerPoint('rect', '10,20,110,60', 1, 14)).toEqual({ x: 60, y: 40 });
		expect(regionMarkerPoint('circle', '50,50,10', 0.5, 14)).toEqual({ x: 50, y: 50 });
		expect(regionMarkerPoint('poly', '0,0,90,0,0,90', 2, 14)).toEqual({ x: 30, y: 30 });
	});

	test('the default shape (the whole image) is marked a fixed CSS distance in from its top-left corner', () => {
		// 14 CSS px at full size, at half size (28 image px) and at double size (7 image px).
		expect(regionMarkerPoint('default', '', 1, 14)).toEqual({ x: 14, y: 14 });
		expect(regionMarkerPoint('default', '', 0.5, 14)).toEqual({ x: 28, y: 28 });
		expect(regionMarkerPoint('default', '', 2, 14)).toEqual({ x: 7, y: 7 });
		// An unknown render scale reads as full size.
		expect(regionMarkerPoint('default', '', 0, 16)).toEqual({ x: 16, y: 16 });
	});

	test('coords a renderer may not have (undefined, empty) are read as unplaced, never a crash', () => {
		// The graphic-order extractor defaults coords, but a hand-fed interaction (a host's web
		// component usage, the no-host-CSS fixture) may omit them, and a default-shape hotspot
		// carries none at all.
		expect(regionMarkerPoint('rect', undefined, 1, 14)).toEqual({ x: 0, y: 0 });
		expect(regionMarkerPoint('circle', '', 1, 14)).toEqual({ x: 0, y: 0 });
		expect(regionMarkerPoint('poly', undefined, 1, 14)).toEqual({ x: 0, y: 0 });
		expect(regionMarkerPoint('default', undefined, 1, 14)).toEqual({ x: 14, y: 14 });
	});
});

describe('shape geometry reads missing or empty coords without crashing', () => {
	test('shapeBounds returns null for missing coords', () => {
		expect(shapeBounds('rect', undefined)).toBeNull();
		expect(shapeBounds('rect', '')).toBeNull();
		expect(shapeBounds('circle', undefined)).toBeNull();
		expect(shapeBounds('poly', '')).toBeNull();
	});

	test('shapeCenter returns finite points for missing coords', () => {
		for (const shape of ['rect', 'circle', 'ellipse', 'poly']) {
			const at = shapeCenter(shape, undefined);
			expect(Number.isFinite(at.x)).toBe(true);
			expect(Number.isFinite(at.y)).toBe(true);
		}
		const empty = shapeCenter('rect', '');
		expect(Number.isFinite(empty.x)).toBe(true);
		expect(Number.isFinite(empty.y)).toBe(true);
	});
});
