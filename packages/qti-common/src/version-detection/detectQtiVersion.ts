/**
 * QTI version identifiers
 */
export type QtiVersion = '2.0' | '2.1' | '2.2' | '3.0' | 'unknown';

/**
 * Detect the QTI version from XML content.
 *
 * Detection strategy (in priority order):
 * 1. Check XML namespace URI for version indicators (v2p0, v2p1, v2p2, v3p0)
 * 2. Check root element name (qti-assessment-item => 3.0, assessmentItem => 2.x)
 * 3. Check version attribute on root element
 * 4. Fall back to 'unknown'
 *
 * @param xml - QTI XML content as string
 * @returns Detected QTI version or 'unknown'
 *
 * @example
 * ```typescript
 * const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">`;
 * detectQtiVersion(xml); // => '3.0'
 * ```
 */
export function detectQtiVersion(xml: string): QtiVersion {
	try {
		// Check if we're in a browser environment
		if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
			const parser = new window.DOMParser();
			const doc = parser.parseFromString(xml, 'text/xml');
			return detectFromDocument(doc);
		}

		// In Node.js environment, fall back to regex detection
		// (xmldom can be optionally imported by consumers if needed)
		return detectFromString(xml);
	} catch {
		// If parsing fails, try string-based detection
		return detectFromString(xml);
	}
}

/**
 * Detect QTI version from a parsed Document.
 * @param doc - Parsed XML document
 * @returns Detected QTI version
 * @private
 */
function detectFromDocument(doc: any): QtiVersion {
	const root = doc.documentElement;

	// Check for parse errors
	if (root.tagName === 'parsererror') {
		return 'unknown';
	}

	// Strategy 1: Check namespace URI
	if (root.namespaceURI) {
		if (root.namespaceURI.includes('v3p0') || root.namespaceURI.includes('imsqtiasi_v3p0')) {
			return '3.0';
		}
		if (root.namespaceURI.includes('v2p2')) {
			return '2.2';
		}
		if (root.namespaceURI.includes('v2p1')) {
			return '2.1';
		}
		if (root.namespaceURI.includes('v2p0')) {
			return '2.0';
		}
	}

	// Strategy 2: Check root element name
	const localName = root.localName || root.tagName;
	if (localName === 'qti-assessment-item' || localName === 'qti-assessment-test') {
		return '3.0';
	}

	// Strategy 3: Check version attribute
	if (localName === 'assessmentItem' || localName === 'assessmentTest') {
		const version = root.getAttribute('version');
		if (version) {
			if (version.startsWith('3.')) return '3.0';
			if (version.startsWith('2.2')) return '2.2';
			if (version.startsWith('2.1')) return '2.1';
			if (version.startsWith('2.0')) return '2.0';
		}

		// If no version attribute, assume 2.2 (most common)
		return '2.2';
	}

	return 'unknown';
}

/**
 * Detect QTI version using string matching (fallback method).
 * @param xml - XML string
 * @returns Detected QTI version
 * @private
 */
function detectFromString(xml: string): QtiVersion {
	// Check namespace declarations
	if (xml.includes('imsqtiasi_v3p0') || xml.includes('/v3p0/')) {
		return '3.0';
	}
	if (xml.includes('imsqti_v2p2') || xml.includes('/v2p2/')) {
		return '2.2';
	}
	if (xml.includes('imsqti_v2p1') || xml.includes('/v2p1/')) {
		return '2.1';
	}
	if (xml.includes('imsqti_v2p0') || xml.includes('/v2p0/')) {
		return '2.0';
	}

	// Check root element
	if (/<qti-assessment-(item|test)[\s>]/.test(xml)) {
		return '3.0';
	}

	if (/<assessment(Item|Test)[\s>]/.test(xml)) {
		// Try to find version attribute
		const versionMatch = xml.match(/version=["']([^"']+)["']/);
		if (versionMatch) {
			const version = versionMatch[1];
			if (version.startsWith('3.')) return '3.0';
			if (version.startsWith('2.2')) return '2.2';
			if (version.startsWith('2.1')) return '2.1';
			if (version.startsWith('2.0')) return '2.0';
		}

		// Assume 2.2 if no version specified
		return '2.2';
	}

	return 'unknown';
}
