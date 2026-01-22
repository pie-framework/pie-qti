/**
 * QTI 2.x Format Detector
 * Detects QTI 2.0, 2.1, and 2.2 XML formats
 */

import type { FormatDetector } from '../registry/format-detector-registry.js';

/**
 * QTI 2.x format detector
 * Detects XML content with QTI 2.0, 2.1, or 2.2 namespace
 * Note: All versions are mapped to the same formatId for unified processing
 */
export class Qti22Detector implements FormatDetector {
	readonly id = 'qti22-detector';
	readonly formatId = 'qti22';
	readonly priority = 100;

	/**
	 * Detect if input is QTI 2.x XML (supports 2.0, 2.1, 2.2)
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

		// Support QTI 2.0, 2.1, and 2.2 namespaces
		return (
			trimmed.includes('imsqti_v2p0') ||
			trimmed.includes('imsqti_v2p1') ||
			trimmed.includes('imsqti_v2p2') ||
			trimmed.includes('http://www.imsglobal.org/xsd/imsqti_v2p')
		);
	}
}
