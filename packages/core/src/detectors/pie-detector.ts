/**
 * PIE Format Detector
 * Detects PIE JSON format
 */

import { KNOWN_FORMATS } from '@pie-qti/transform-types';
import type { FormatDetector } from '../registry/format-detector-registry.js';

/**
 * PIE format detector
 * Detects JSON/object content with PIE structure
 */
export class PieDetector implements FormatDetector {
	readonly id = 'pie-detector';
	readonly formatId = KNOWN_FORMATS.PIE;
	readonly priority = 90;

	/**
	 * Detect if input is PIE format
	 */
	detect(input: string | object): boolean {
		// PIE can be an object or JSON string
		if (typeof input === 'object') {
			// Assume objects are PIE (or will be validated by the plugin)
			return true;
		}

		// Try to parse as JSON
		if (typeof input === 'string') {
			const trimmed = input.trim();

			// Must start with { or [
			if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
				return false;
			}

			try {
				const parsed = JSON.parse(trimmed);

				// Basic PIE shape detection
				// PIE items typically have: id, element, or pieElement properties
				if (parsed && typeof parsed === 'object') {
					return !!(parsed.id || parsed.element || parsed.pieElement);
				}

				return false;
			} catch {
				// Not valid JSON
				return false;
			}
		}

		return false;
	}
}
