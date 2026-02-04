/**
 * Custom QTI operator for drawing interaction scoring
 * 
 * Checks if a drawing contains at least some drawn content (non-white pixels)
 */

import type { QtiValue } from '@pie-qti/qti-processing';
import { qtiValue } from '@pie-qti/qti-processing';
import { getCachedImageData } from './drawing-image-cache.js';

/**
 * Custom operator: drawing.hasLine
 * 
 * Returns 1.0 if the drawing contains at least 50 non-white/non-transparent pixels,
 * otherwise returns 0.0
 */
export function hasLineOperator(args: QtiValue[], meta: { class?: string; definition?: string }): QtiValue {
	if (args.length === 0) {
		return qtiValue('float', 'single', 0.0);
	}

	const response = args[0];
	
	console.log('[Drawing Scoring] Response received:', JSON.stringify(response, null, 2));
	console.log('[Drawing Scoring] Response kind:', response.kind);
	console.log('[Drawing Scoring] Response baseType:', response.baseType);
	console.log('[Drawing Scoring] Response value:', response.value);
	console.log('[Drawing Scoring] Response value type:', typeof response.value);
	
	// Extract dataUrl from response
	let dataUrl: string | null = null;
	
	if (response.kind === 'value' && response.baseType === 'file') {
		const value = response.value;
		console.log('[Drawing Scoring] Processing file value:', value);
		
		if (value && typeof value === 'object') {
			// Check if it's a QTIFileResponse object
			if ('dataUrl' in value) {
				dataUrl = (value as any).dataUrl;
				console.log('[Drawing Scoring] Found dataUrl in object:', dataUrl?.substring(0, 50) + '...');
			} else {
				// Try to stringify and parse if it's a Proxy or similar
				try {
					const stringified = JSON.stringify(value);
					const parsed = JSON.parse(stringified);
					if (parsed && typeof parsed === 'object' && 'dataUrl' in parsed) {
						dataUrl = parsed.dataUrl;
						console.log('[Drawing Scoring] Found dataUrl after stringify/parse');
					}
				} catch (e) {
					console.log('[Drawing Scoring] Failed to stringify value:', e);
				}
			}
		} else if (typeof value === 'string' && value.startsWith('data:')) {
			dataUrl = value;
			console.log('[Drawing Scoring] Found dataUrl as string');
		}
	}
	
	if (!dataUrl) {
		console.log('[Drawing Scoring] No dataUrl found in response. Full response:', response);
		return qtiValue('float', 'single', 0.0);
	}
	
	// Get cached ImageData (extracted synchronously from canvas)
	const cached = getCachedImageData(dataUrl);
	if (!cached) {
		console.log('[Drawing Scoring] No cached image data found for dataUrl');
		return qtiValue('float', 'single', 0.0);
	}
	
	// Check for non-white pixels
	const { data, width, height } = cached;
	const totalPixels = width * height;
	let nonWhitePixels = 0;
	const threshold = 50; // Minimum number of non-white pixels to consider a line drawn
	
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
	
	console.log(`[Drawing Scoring] Found ${nonWhitePixels} non-white pixels out of ${totalPixels} total`);
	
	const hasLine = nonWhitePixels >= threshold;
	return qtiValue('float', 'single', hasLine ? 1.0 : 0.0);
}
