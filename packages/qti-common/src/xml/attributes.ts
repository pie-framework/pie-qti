/**
 * Attribute name handling for QTI 2.x and QTI 3.0.
 *
 * QTI 2.x uses camelCase: identifier, baseType, responseIdentifier
 * QTI 3.0 uses kebab-case: identifier, base-type, response-identifier
 *
 * This module provides utilities to access attributes regardless of version.
 */

/**
 * Convert camelCase to kebab-case.
 * @param name - camelCase attribute name
 * @returns kebab-case attribute name
 *
 * @example
 * toKebabCase('baseType') // => 'base-type'
 * toKebabCase('responseIdentifier') // => 'response-identifier'
 */
export function toKebabCase(name: string): string {
	return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Convert kebab-case to camelCase.
 * @param name - kebab-case attribute name
 * @returns camelCase attribute name
 *
 * @example
 * toCamelCase('base-type') // => 'baseType'
 * toCamelCase('response-identifier') // => 'responseIdentifier'
 */
export function toCamelCase(name: string): string {
	return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Get attribute value supporting both QTI 2.x (camelCase) and QTI 3.0 (kebab-case).
 *
 * This function tries to retrieve the attribute in both formats:
 * 1. First tries the exact name as provided
 * 2. If not found and name is camelCase, tries kebab-case version
 * 3. If not found and name is kebab-case, tries camelCase version
 *
 * @param element - Element to get attribute from
 * @param name - Attribute name (can be camelCase or kebab-case)
 * @returns Attribute value or null if not found
 *
 * @example
 * // Works with QTI 2.x:
 * getAttribute(el, 'baseType') // => 'float' (from baseType="float")
 *
 * // Works with QTI 3.0:
 * getAttribute(el, 'baseType') // => 'float' (from base-type="float")
 * getAttribute(el, 'base-type') // => 'float' (from base-type="float")
 */
export function getAttribute(element: Element, name: string): string | null {
	// Try exact name first
	let value = element.getAttribute(name);
	if (value !== null && value !== '') return value;

	// If name contains uppercase (camelCase), try kebab-case
	if (/[A-Z]/.test(name)) {
		const kebab = toKebabCase(name);
		value = element.getAttribute(kebab);
		if (value !== null && value !== '') return value;
	}

	// If name contains hyphens (kebab-case), try camelCase
	if (name.includes('-')) {
		const camel = toCamelCase(name);
		value = element.getAttribute(camel);
		if (value !== null && value !== '') return value;
	}

	return null;
}

/**
 * Check if element has attribute (supports both camelCase and kebab-case).
 *
 * @param element - Element to check
 * @param name - Attribute name
 * @returns true if attribute exists
 */
export function hasAttribute(element: Element, name: string): boolean {
	return getAttribute(element, name) !== null;
}

/**
 * Get attribute as number.
 *
 * @param element - Element to get attribute from
 * @param name - Attribute name
 * @param defaultValue - Default value if attribute is missing or invalid
 * @returns Attribute value as number
 */
export function getNumberAttribute(element: Element, name: string, defaultValue: number): number {
	const value = getAttribute(element, name);
	if (value === null) return defaultValue;
	const num = Number(value);
	return Number.isFinite(num) ? num : defaultValue;
}

/**
 * Get attribute as boolean.
 *
 * QTI uses 'true'/'false' or '1'/'0' for boolean attributes.
 *
 * @param element - Element to get attribute from
 * @param name - Attribute name
 * @param defaultValue - Default value if attribute is missing
 * @returns Attribute value as boolean
 */
export function getBooleanAttribute(element: Element, name: string, defaultValue = false): boolean {
	const value = getAttribute(element, name);
	if (value === null) return defaultValue;
	const normalized = value.trim().toLowerCase();
	if (normalized === 'true' || normalized === '1') return true;
	if (normalized === 'false' || normalized === '0') return false;
	return defaultValue;
}
