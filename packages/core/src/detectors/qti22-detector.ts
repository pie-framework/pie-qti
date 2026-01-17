/**
 * QTI 2.2 Format Detector
 * Detects QTI 2.2 XML format
 */

import { KNOWN_FORMATS } from '@pie-qti/transform-types';
import type { FormatDetector } from '../registry/format-detector-registry.js';

/**
 * QTI 2.2 format detector
 * Detects XML content with QTI 2.2 namespace
 */
export class Qti22Detector implements FormatDetector {
	readonly id = 'qti22-detector';
	readonly formatId = KNOWN_FORMATS.QTI22;
	readonly priority = 100;

	/**
	 * Detect if input is QTI 2.2 XML
	 */
	detect(input: string | object): boolean {
		// QTI is always a string (XML)
		if (typeof input !== 'string') {
			return false;
		}

		const trimmed = input.trim();

		// Must be XML-like
		if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
			return false;
		}

		// Check for QTI 2.2 namespace
		return (
			trimmed.includes('imsqti_v2p2') ||
			trimmed.includes('http://www.imsglobal.org/xsd/imsqti_v2p2')
		);
	}
}
