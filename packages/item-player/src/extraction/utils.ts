/**
 * Extraction utilities implementation
 *
 * Provides DOM manipulation and content extraction helpers for extractors
 */

import type { ElementNameMapper, AttributeNameMapper } from '@pie-qti/qti-common';
import { Qti2xElementNameMapper, Qti2xAttributeNameMapper } from '@pie-qti/qti-common';
import { sanitizeTextContent } from '../core/sanitizer.js';
import type { PlayerSecurityConfig } from '../types/index.js';
import type { QTIElement } from '../interactions/index.js';
import type { ExtractionUtils } from './types.js';

/**
 * Extract text content from QTI elements
 */
function getTextContent(element: QTIElement | null | undefined): string {
	return element?.textContent?.trim() || '';
}

/**
 * Extract HTML content from QTI elements (preserves MathML and other markup)
 * Content is sanitized to prevent XSS attacks
 */
function getHtmlContent(element: QTIElement | null | undefined): string {
	const html = element?.innerHTML?.trim() || '';
	return sanitizeTextContent(html);
}

/**
 * Get children by tag name from QTI elements
 * Note: This version does NOT handle QTI version mapping - use the one in ExtractionUtils instead
 */
function getChildrenByTag(
	element: QTIElement | null | undefined,
	tagName: string
): QTIElement[] {
	return (element?.childNodes?.filter((n) => n.rawTagName === tagName) as QTIElement[]) || [];
}

/**
 * Get children by tag name with QTI version awareness
 */
function getChildrenByTagWithMapper(
	element: QTIElement | null | undefined,
	tagName: string,
	mapper: ElementNameMapper
): QTIElement[] {
	if (!element?.childNodes) return [];
	return element.childNodes.filter((n) =>
		matchesTagName((n as QTIElement).rawTagName, tagName, mapper)
	) as QTIElement[];
}

/**
 * Extract a boolean attribute from a QTI element
 * Supports both QTI 2.x (camelCase) and QTI 3.0 (kebab-case) attributes
 */
function getBooleanAttribute(
	element: QTIElement,
	name: string,
	defaultValue = false,
	attributeMapper?: AttributeNameMapper
): boolean {
	let value = element.getAttribute(name);

	// If not found and we have a mapper, try the native format (QTI 3.0 kebab-case)
	if ((value === null || value === undefined) && attributeMapper) {
		const nativeName = attributeMapper.toNative(name);
		value = element.getAttribute(nativeName);
	}

	if (value === null || value === undefined) return defaultValue;
	return value === 'true';
}

/**
 * Extract a number attribute from a QTI element
 * Supports both QTI 2.x (camelCase) and QTI 3.0 (kebab-case) attributes
 */
function getNumberAttribute(
	element: QTIElement,
	name: string,
	defaultValue: number,
	attributeMapper?: AttributeNameMapper
): number {
	let value = element.getAttribute(name);

	// If not found and we have a mapper, try the native format (QTI 3.0 kebab-case)
	if ((value === null || value === undefined) && attributeMapper) {
		const nativeName = attributeMapper.toNative(name);
		value = element.getAttribute(nativeName);
	}

	return value ? Number(value) : defaultValue;
}

/**
 * Extract a string attribute from a QTI element
 * Supports both QTI 2.x (camelCase) and QTI 3.0 (kebab-case) attributes
 */
function getStringAttribute(
	element: QTIElement,
	name: string,
	defaultValue = '',
	attributeMapper?: AttributeNameMapper
): string {
	let value = element.getAttribute(name);

	// If not found and we have a mapper, try the native format (QTI 3.0 kebab-case)
	if ((value === null || value === undefined) && attributeMapper) {
		const nativeName = attributeMapper.toNative(name);
		value = element.getAttribute(nativeName);
	}

	return value || defaultValue;
}

/**
 * Extract CSS classes from an element
 */
function getClasses(element: QTIElement): string[] {
	const classAttr = element.getAttribute('class');
	return classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
}

/**
 * Helper to check if an element's tag name matches a given QTI element name.
 * Handles both QTI 2.x and QTI 3.0 element naming conventions.
 *
 * @param rawTagName - The element's raw tag name from the HTML
 * @param expectedTagName - The tag name to check (in QTI 2.x format, e.g., 'simpleChoice')
 * @param mapper - Optional element name mapper for QTI version handling
 * @returns true if the tag name matches
 */
function matchesTagName(
	rawTagName: string | undefined,
	expectedTagName: string,
	mapper: ElementNameMapper
): boolean {
	if (!rawTagName) return false;

	// Convert expected tag name to canonical form (lowercase)
	const canonical = expectedTagName.toLowerCase();

	// Get the native form for this QTI version
	const native = mapper.toNative(canonical);

	// Check if raw tag name matches the native form (case-insensitive)
	return rawTagName.toLowerCase() === native.toLowerCase();
}

/**
 * Create extraction utilities instance
 * Provides standard helpers for extracting data from QTI elements.
 * Automatically handles both QTI 2.x and QTI 3.0 element and attribute naming conventions.
 */
export function createExtractionUtils(
	security?: PlayerSecurityConfig,
	mapper?: ElementNameMapper,
	attributeMapper?: AttributeNameMapper
): ExtractionUtils {
	// Default to QTI 2.x mappers (primary supported QTI format)
	const elementMapper = mapper || new Qti2xElementNameMapper();
	const attrMapper = attributeMapper || new Qti2xAttributeNameMapper();
	return {
		getChildrenByTag(element: QTIElement, tagName: string): QTIElement[] {
			return getChildrenByTagWithMapper(element, tagName, elementMapper);
		},

		querySelectorAll(element: QTIElement, selector: string): QTIElement[] {
			// Parse simple selectors like "choiceInteraction simpleChoice"
			const parts = selector.split(/\s+/);
			let results: QTIElement[] = [element];

			for (const part of parts) {
				const nextResults: QTIElement[] = [];
				for (const current of results) {
					if (matchesTagName(current.rawTagName, part, elementMapper)) {
						nextResults.push(current);
					}
					if (current.childNodes) {
						for (const child of current.childNodes) {
							if (typeof child !== 'string' && matchesTagName((child as QTIElement).rawTagName, part, elementMapper)) {
								nextResults.push(child as QTIElement);
							}
						}
					}
				}
				results = nextResults;
			}

			return results;
		},

		querySelector(element: QTIElement, selector: string): QTIElement | null {
			const results = this.querySelectorAll(element, selector);
			return results.length > 0 ? results[0] : null;
		},

		hasChildWithTag(element: QTIElement, tagName: string): boolean {
			// Fast boolean check without allocation
			if (!element.childNodes) return false;

			for (const child of element.childNodes) {
				if (typeof child !== 'string' && matchesTagName((child as QTIElement).rawTagName, tagName, elementMapper)) {
					return true;
				}
			}
			return false;
		},

		getHtmlContent(element: QTIElement): string {
			const html = element?.innerHTML?.trim() || '';
			return sanitizeTextContent(html, { security });
		},

		getTextContent(element: QTIElement): string {
			return getTextContent(element);
		},

		getAttribute(element: QTIElement, name: string, defaultValue = ''): string {
			return getStringAttribute(element, name, defaultValue, attrMapper);
		},

		getBooleanAttribute(element: QTIElement, name: string, defaultValue = false): boolean {
			return getBooleanAttribute(element, name, defaultValue, attrMapper);
		},

		getNumberAttribute(element: QTIElement, name: string, defaultValue = 0): number {
			return getNumberAttribute(element, name, defaultValue, attrMapper);
		},

		getPrompt(element: QTIElement): string | null {
			const promptElement = getChildrenByTagWithMapper(element, 'prompt', elementMapper)[0];
			return promptElement ? getHtmlContent(promptElement) : null;
		},

		getClasses(element: QTIElement): string[] {
			return getClasses(element);
		},
	};
}
