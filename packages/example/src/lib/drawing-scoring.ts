/**
 * Custom QTI operator for drawing interaction scoring
 * 
 * Checks if a drawing contains at least some drawn content (non-white pixels)
 * 
 * This operator uses the imageData property from QTIFileResponse, which is
 * extracted synchronously from the canvas when the drawing is committed.
 */

import type { QtiValue } from '@pie-qti/qti-processing';
import { qtiValue } from '@pie-qti/qti-processing';
import type { QTIFileResponse } from '@pie-qti/item-player';
import { analyzeDrawing } from '@pie-qti/item-player';

/**
 * Custom operator: drawing.hasLine
 * 
 * Returns 1.0 if the drawing contains at least 50 non-white/non-transparent pixels,
 * otherwise returns 0.0
 * 
 * The operator reads imageData directly from the QTIFileResponse object,
 * which is included when DrawingCanvas commits a drawing.
 */
export function hasLineOperator(args: QtiValue[], meta: { class?: string; definition?: string }): QtiValue {
	if (args.length === 0) {
		return qtiValue('float', 'single', 0.0);
	}

	const response = args[0];
	
	// Extract QTIFileResponse from QtiValue
	let fileResponse: QTIFileResponse | null = null;
	
	if (response.kind === 'value' && response.baseType === 'file') {
		const value = response.value;
		
		// Handle QTIFileResponse object (preserved by Player.coerceToDeclarationValue)
		if (value && typeof value === 'object' && 'dataUrl' in value) {
			fileResponse = value as QTIFileResponse;
		} else {
			// Try to parse if it's been stringified
			try {
				const stringified = JSON.stringify(value);
				const parsed = JSON.parse(stringified);
				if (parsed && typeof parsed === 'object' && 'dataUrl' in parsed) {
					fileResponse = parsed as QTIFileResponse;
				}
			} catch (e) {
				// Value is not a valid file response
			}
		}
	}
	
	if (!fileResponse) {
		return qtiValue('float', 'single', 0.0);
	}

	// Use library utility to analyze drawing
	const hasLine = analyzeDrawing(fileResponse, 50);

	return qtiValue('float', 'single', hasLine ? 1.0 : 0.0);
}
