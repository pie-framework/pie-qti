/**
 * Extraction utilities implementation
 *
 * Provides DOM manipulation and content extraction helpers for extractors
 */

import { sanitizeTextContent } from '../core/sanitizer.js';
import type { PlayerSecurityConfig } from '../types/index.js';
import type { QTIElement } from '../types/interactions.js';
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
 */
function getChildrenByTag(
	element: QTIElement | null | undefined,
	tagName: string
): QTIElement[] {
	return (element?.childNodes?.filter((n) => n.rawTagName === tagName) as QTIElement[]) || [];
}

/**
 * Extract a boolean attribute from a QTI element
 */
function getBooleanAttribute(
	element: QTIElement,
	name: string,
	defaultValue = false
): boolean {
	const value = element.getAttribute(name);
	if (value === null || value === undefined) return defaultValue;
	return value === 'true';
}

/**
 * Extract a number attribute from a QTI element
 */
function getNumberAttribute(
	element: QTIElement,
	name: string,
	defaultValue: number
): number {
	const value = element.getAttribute(name);
	return value ? Number(value) : defaultValue;
}

/**
 * Extract a string attribute from a QTI element
 */
function getStringAttribute(element: QTIElement, name: string, defaultValue = ''): string {
	return element.getAttribute(name) || defaultValue;
}

/**
 * Extract CSS classes from an element
 */
function getClasses(element: QTIElement): string[] {
	const classAttr = element.getAttribute('class');
	return classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];
}

/**
 * Create extraction utilities instance
 * Provides standard helpers for extracting data from QTI elements
 */
export function createExtractionUtils(security?: PlayerSecurityConfig): ExtractionUtils {
	return {
		getChildrenByTag(element: QTIElement, tagName: string): QTIElement[] {
			return getChildrenByTag(element, tagName);
		},

		querySelectorAll(element: QTIElement, selector: string): QTIElement[] {
			// Parse simple selectors like "choiceInteraction simpleChoice"
			const parts = selector.split(/\s+/);
			let results: QTIElement[] = [element];

			for (const part of parts) {
				const nextResults: QTIElement[] = [];
				for (const current of results) {
					if (current.rawTagName === part) {
						nextResults.push(current);
					}
					if (current.childNodes) {
						for (const child of current.childNodes) {
							if (typeof child !== 'string' && (child as QTIElement).rawTagName === part) {
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
				if (typeof child !== 'string' && (child as QTIElement).rawTagName === tagName) {
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
			return getStringAttribute(element, name, defaultValue);
		},

		getBooleanAttribute(element: QTIElement, name: string, defaultValue = false): boolean {
			return getBooleanAttribute(element, name, defaultValue);
		},

		getNumberAttribute(element: QTIElement, name: string, defaultValue = 0): number {
			return getNumberAttribute(element, name, defaultValue);
		},

		getPrompt(element: QTIElement): string | null {
			const promptElement = getChildrenByTag(element, 'prompt')[0];
			return promptElement ? getHtmlContent(promptElement) : null;
		},

		getClasses(element: QTIElement): string[] {
			return getClasses(element);
		},
	};
}
