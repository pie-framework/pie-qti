/**
 * Tests for drawingUtils - utilities for analyzing drawing content
 */

import { describe, expect, test } from 'bun:test';
import { hasLine, getImageDataFromResponse, analyzeDrawing } from '../../src/utils/drawingUtils.js';
import type { QTIFileResponse } from '../../src/types/index.js';

describe('drawingUtils', () => {
	describe('hasLine', () => {
		test('should return false for completely white canvas', () => {
			const imageData = {
				data: new Uint8ClampedArray([
					255, 255, 255, 255, // white pixel
					255, 255, 255, 255, // white pixel
					255, 255, 255, 255, // white pixel
				]),
				width: 3,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(false);
		});

		test('should return false for transparent canvas', () => {
			const imageData = {
				data: new Uint8ClampedArray([
					255, 255, 255, 0, // transparent
					255, 255, 255, 0, // transparent
					255, 255, 255, 0, // transparent
				]),
				width: 3,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(false);
		});

		test('should return true when enough non-white pixels exist', () => {
			// Create imageData with 60 black pixels (above default threshold of 50)
			const data = new Uint8ClampedArray(60 * 4);
			for (let i = 0; i < 60; i++) {
				data[i * 4] = 0; // R
				data[i * 4 + 1] = 0; // G
				data[i * 4 + 2] = 0; // B
				data[i * 4 + 3] = 255; // A (opaque)
			}

			const imageData = {
				data,
				width: 60,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(true);
		});

		test('should return false when below threshold', () => {
			// Create imageData with only 30 black pixels (below default threshold of 50)
			const data = new Uint8ClampedArray(30 * 4);
			for (let i = 0; i < 30; i++) {
				data[i * 4] = 0; // R
				data[i * 4 + 1] = 0; // G
				data[i * 4 + 2] = 0; // B
				data[i * 4 + 3] = 255; // A (opaque)
			}

			const imageData = {
				data,
				width: 30,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(false);
		});

		test('should respect custom threshold', () => {
			// Create imageData with 20 black pixels
			const data = new Uint8ClampedArray(20 * 4);
			for (let i = 0; i < 20; i++) {
				data[i * 4] = 0;
				data[i * 4 + 1] = 0;
				data[i * 4 + 2] = 0;
				data[i * 4 + 3] = 255;
			}

			const imageData = {
				data,
				width: 20,
				height: 1,
			};

			// Should pass with lower threshold
			expect(hasLine(imageData, 10)).toBe(true);

			// Should fail with higher threshold
			expect(hasLine(imageData, 30)).toBe(false);
		});

		test('should detect colored pixels (not just black)', () => {
			// Create imageData with 60 red pixels
			const data = new Uint8ClampedArray(60 * 4);
			for (let i = 0; i < 60; i++) {
				data[i * 4] = 200; // R
				data[i * 4 + 1] = 0; // G
				data[i * 4 + 2] = 0; // B
				data[i * 4 + 3] = 255; // A
			}

			const imageData = {
				data,
				width: 60,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(true);
		});

		test('should ignore pixels with low alpha', () => {
			// Create imageData with pixels that have low alpha (semi-transparent)
			const data = new Uint8ClampedArray(60 * 4);
			for (let i = 0; i < 60; i++) {
				data[i * 4] = 0; // R
				data[i * 4 + 1] = 0; // G
				data[i * 4 + 2] = 0; // B
				data[i * 4 + 3] = 5; // A (very low, should be ignored)
			}

			const imageData = {
				data,
				width: 60,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(false);
		});

		test('should count pixels with alpha > 10', () => {
			// Create imageData with pixels that have alpha = 11 (just above threshold)
			const data = new Uint8ClampedArray(60 * 4);
			for (let i = 0; i < 60; i++) {
				data[i * 4] = 0; // R
				data[i * 4 + 1] = 0; // G
				data[i * 4 + 2] = 0; // B
				data[i * 4 + 3] = 11; // A (just above threshold)
			}

			const imageData = {
				data,
				width: 60,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(true);
		});

		test('should ignore very light colored pixels (near white)', () => {
			// Create pixels that are very light (245, 245, 245) - should be ignored
			const data = new Uint8ClampedArray(60 * 4);
			for (let i = 0; i < 60; i++) {
				data[i * 4] = 245; // R
				data[i * 4 + 1] = 245; // G
				data[i * 4 + 2] = 245; // B
				data[i * 4 + 3] = 255; // A
			}

			const imageData = {
				data,
				width: 60,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(false);
		});

		test('should detect light gray pixels (below 240)', () => {
			// Create pixels that are light gray (235, 235, 235) - should be counted
			const data = new Uint8ClampedArray(60 * 4);
			for (let i = 0; i < 60; i++) {
				data[i * 4] = 235; // R
				data[i * 4 + 1] = 235; // G
				data[i * 4 + 2] = 235; // B
				data[i * 4 + 3] = 255; // A
			}

			const imageData = {
				data,
				width: 60,
				height: 1,
			};

			expect(hasLine(imageData)).toBe(true);
		});
	});

	describe('getImageDataFromResponse', () => {
		test('should return imageData from valid QTIFileResponse', () => {
			const imageData = {
				data: new Uint8ClampedArray([0, 0, 0, 255]),
				width: 1,
				height: 1,
			};

			const fileResponse: QTIFileResponse = {
				fileName: 'drawing.png',
				mimeType: 'image/png',
				data: 'base64data',
				imageData,
			};

			const result = getImageDataFromResponse(fileResponse);
			expect(result).toBe(imageData);
		});

		test('should return null for null response', () => {
			const result = getImageDataFromResponse(null);
			expect(result).toBe(null);
		});

		test('should return null for undefined response', () => {
			const result = getImageDataFromResponse(undefined);
			expect(result).toBe(null);
		});

		test('should return null for response without imageData', () => {
			const fileResponse: QTIFileResponse = {
				fileName: 'drawing.png',
				mimeType: 'image/png',
				data: 'base64data',
			};

			const result = getImageDataFromResponse(fileResponse);
			expect(result).toBe(null);
		});
	});

	describe('analyzeDrawing', () => {
		test('should return true for drawing with content', () => {
			const data = new Uint8ClampedArray(60 * 4);
			for (let i = 0; i < 60; i++) {
				data[i * 4] = 0;
				data[i * 4 + 1] = 0;
				data[i * 4 + 2] = 0;
				data[i * 4 + 3] = 255;
			}

			const fileResponse: QTIFileResponse = {
				fileName: 'drawing.png',
				mimeType: 'image/png',
				data: 'base64data',
				imageData: {
					data,
					width: 60,
					height: 1,
				},
			};

			expect(analyzeDrawing(fileResponse)).toBe(true);
		});

		test('should return false for empty drawing', () => {
			const data = new Uint8ClampedArray(100 * 4);
			for (let i = 0; i < 100; i++) {
				data[i * 4] = 255;
				data[i * 4 + 1] = 255;
				data[i * 4 + 2] = 255;
				data[i * 4 + 3] = 255;
			}

			const fileResponse: QTIFileResponse = {
				fileName: 'drawing.png',
				mimeType: 'image/png',
				data: 'base64data',
				imageData: {
					data,
					width: 100,
					height: 1,
				},
			};

			expect(analyzeDrawing(fileResponse)).toBe(false);
		});

		test('should return false for null response', () => {
			expect(analyzeDrawing(null)).toBe(false);
		});

		test('should return false for undefined response', () => {
			expect(analyzeDrawing(undefined)).toBe(false);
		});

		test('should return false for response without imageData', () => {
			const fileResponse: QTIFileResponse = {
				fileName: 'drawing.png',
				mimeType: 'image/png',
				data: 'base64data',
			};

			expect(analyzeDrawing(fileResponse)).toBe(false);
		});

		test('should respect custom threshold', () => {
			const data = new Uint8ClampedArray(20 * 4);
			for (let i = 0; i < 20; i++) {
				data[i * 4] = 0;
				data[i * 4 + 1] = 0;
				data[i * 4 + 2] = 0;
				data[i * 4 + 3] = 255;
			}

			const fileResponse: QTIFileResponse = {
				fileName: 'drawing.png',
				mimeType: 'image/png',
				data: 'base64data',
				imageData: {
					data,
					width: 20,
					height: 1,
				},
			};

			expect(analyzeDrawing(fileResponse, 10)).toBe(true);
			expect(analyzeDrawing(fileResponse, 30)).toBe(false);
		});
	});
});
