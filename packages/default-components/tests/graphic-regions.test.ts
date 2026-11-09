import { describe, expect, test } from 'bun:test';
import { regionMarkerPoint } from '../src/plugins/hotspot/graphicRegions';

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
});
