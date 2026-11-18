/**
 * QTI XML utilities for extracting metadata and information from QTI XML content
 *
 * These utilities use regex-based parsing to remain environment-agnostic
 * (works in both browser and Node.js without heavy dependencies).
 */

/**
 * Comprehensive QTI item metadata
 */
export interface QtiItemMetadata {
	/** Item identifier */
	identifier?: string;
	/** Item title */
	title?: string;
	/** Item description */
	description?: string;
	/** Language code (e.g., "en-US") */
	language?: string;
	/** Detected interaction types */
	interactionTypes?: string[];
}

/**
 * Extract title from QTI item/test XML content
 *
 * Handles multiple QTI title formats:
 * - Attribute-style: `<assessmentItem title="...">`
 * - Attribute-style: `<assessmentTest title="...">`
 * - Element-style: `<title>...</title>` within assessment elements
 * - Fallback: Any `<title>` element in the document
 *
 * @param xmlContent QTI XML content as string
 * @returns Extracted title or undefined if not found
 *
 * @example
 * ```ts
 * const xml = '<assessmentItem identifier="item1" title="Question 1">...</assessmentItem>';
 * const title = extractTitleFromQtiXml(xml); // "Question 1"
 * ```
 */
export function extractTitleFromQtiXml(xmlContent: string): string | undefined {
	if (!xmlContent) return undefined;

	// Try attribute-style title first: <assessmentItem title="...">
	const attributeMatch = xmlContent.match(/<assessmentItem[^>]*\s+title=["']([^"']+)["']/i);
	if (attributeMatch && attributeMatch[1]) {
		return attributeMatch[1].trim();
	}

	// Try test attribute-style: <assessmentTest title="...">
	const testAttributeMatch = xmlContent.match(/<assessmentTest[^>]*\s+title=["']([^"']+)["']/i);
	if (testAttributeMatch && testAttributeMatch[1]) {
		return testAttributeMatch[1].trim();
	}

	// Try element-style title: <title>...</title>
	// Look for title element that's a direct child of assessmentItem or assessmentTest
	const elementMatch = xmlContent.match(
		/<(?:assessmentItem|assessmentTest)[^>]*>[\s\S]*?<title[^>]*>([^<]+)<\/title>/i
	);
	if (elementMatch && elementMatch[1]) {
		return elementMatch[1].trim();
	}

	// Fallback: look for any <title> element (less specific but might catch some cases)
	const fallbackMatch = xmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
	if (fallbackMatch && fallbackMatch[1]) {
		return fallbackMatch[1].trim();
	}

	return undefined;
}

/**
 * Extract identifier from QTI item/test XML content
 *
 * @param xmlContent QTI XML content as string
 * @returns Extracted identifier or undefined if not found
 */
export function extractIdentifierFromQtiXml(xmlContent: string): string | undefined {
	if (!xmlContent) return undefined;

	// Try assessmentItem identifier
	const itemMatch = xmlContent.match(/<assessmentItem[^>]*\s+identifier=["']([^"']+)["']/i);
	if (itemMatch && itemMatch[1]) {
		return itemMatch[1].trim();
	}

	// Try assessmentTest identifier
	const testMatch = xmlContent.match(/<assessmentTest[^>]*\s+identifier=["']([^"']+)["']/i);
	if (testMatch && testMatch[1]) {
		return testMatch[1].trim();
	}

	return undefined;
}

/**
 * Extract interaction types from QTI item XML content
 *
 * Detects all QTI interaction types present in the item.
 *
 * @param xmlContent QTI XML content as string
 * @returns Array of detected interaction type names (e.g., ["choiceInteraction", "textEntryInteraction"])
 */
export function extractInteractionTypesFromQtiXml(xmlContent: string): string[] {
	if (!xmlContent) return [];

	const interactionTypes = new Set<string>();

	// Common QTI interaction types
	const knownInteractions = [
		'choiceInteraction',
		'orderInteraction',
		'associateInteraction',
		'matchInteraction',
		'gapMatchInteraction',
		'inlineChoiceInteraction',
		'textEntryInteraction',
		'extendedTextInteraction',
		'hottextInteraction',
		'hotspotInteraction',
		'selectPointInteraction',
		'graphicOrderInteraction',
		'graphicAssociateInteraction',
		'graphicGapMatchInteraction',
		'positionObjectInteraction',
		'sliderInteraction',
		'drawingInteraction',
		'uploadInteraction',
		'customInteraction',
		'endAttemptInteraction',
	];

	for (const interactionType of knownInteractions) {
		const pattern = new RegExp(`<${interactionType}[^>]*>`, 'i');
		if (pattern.test(xmlContent)) {
			interactionTypes.add(interactionType);
		}
	}

	return Array.from(interactionTypes);
}

/**
 * Extract comprehensive metadata from QTI item XML content
 *
 * Combines all metadata extraction functions to provide a complete metadata object.
 *
 * @param xmlContent QTI XML content as string
 * @returns Comprehensive QTI item metadata
 *
 * @example
 * ```ts
 * const xml = `<assessmentItem identifier="item1" title="Question 1">...</assessmentItem>`;
 * const metadata = extractQtiItemMetadata(xml);
 * // {
 * //   identifier: "item1",
 * //   title: "Question 1",
 * //   interactionTypes: ["choiceInteraction"]
 * // }
 * ```
 */
export function extractQtiItemMetadata(xmlContent: string): QtiItemMetadata {
	return {
		identifier: extractIdentifierFromQtiXml(xmlContent),
		title: extractTitleFromQtiXml(xmlContent),
		interactionTypes: extractInteractionTypesFromQtiXml(xmlContent),
	};
}
