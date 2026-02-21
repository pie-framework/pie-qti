/**
 * Drawing analysis utilities for QTI drawing interactions
 * 
 * These utilities help analyze drawing content for scoring purposes.
 * They work with ImageData extracted from canvas elements.
 */

import type { QTIFileResponse } from '../types/index.js';

/**
 * Check if a drawing contains at least some drawn content (non-white pixels)
 * 
 * @param imageData - ImageData from canvas (RGBA format, 4 bytes per pixel)
 * @param threshold - Minimum number of non-white pixels to consider a line drawn (default: 50)
 * @returns true if the drawing contains at least threshold non-white pixels
 */
export function hasLine(
	imageData: { data: Uint8ClampedArray; width: number; height: number },
	threshold: number = 50
): boolean {
	const { data } = imageData;
	let nonWhitePixels = 0;
	
	// Check each pixel (RGBA format: 4 bytes per pixel)
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		const a = data[i + 3];
		
		// Consider pixel non-white if:
		// - Alpha is significant (> 10)
		// - AND color is not white/very light (any channel < 240)
		if (a > 10 && (r < 240 || g < 240 || b < 240)) {
			nonWhitePixels++;
		}
	}
	
	return nonWhitePixels >= threshold;
}

/**
 * Get ImageData from a QTIFileResponse if available
 * 
 * @param fileResponse - QTIFileResponse object (may contain imageData)
 * @returns ImageData if available, null otherwise
 */
export function getImageDataFromResponse(
	fileResponse: QTIFileResponse | null | undefined
): { data: Uint8ClampedArray; width: number; height: number } | null {
	if (!fileResponse?.imageData) {
		return null;
	}
	return fileResponse.imageData;
}

/**
 * Analyze a drawing response to determine if it contains drawn content
 * 
 * @param fileResponse - QTIFileResponse from drawing interaction
 * @param threshold - Minimum number of non-white pixels (default: 50)
 * @returns true if drawing contains content, false otherwise
 */
export function analyzeDrawing(
	fileResponse: QTIFileResponse | null | undefined,
	threshold: number = 50
): boolean {
	const imageData = getImageDataFromResponse(fileResponse);
	if (!imageData) {
		return false;
	}
	return hasLine(imageData, threshold);
}
