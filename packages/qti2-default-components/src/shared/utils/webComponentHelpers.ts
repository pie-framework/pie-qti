/**
 * Helper utilities for web component prop handling
 */

/**
 * Parse a prop that may be a JSON string or an object
 * Used when components are used as web components and receive JSON strings
 */
export function parseJsonProp<T>(prop: T | string | null | undefined): T | null {
	if (prop === null || prop === undefined) return null;

	if (typeof prop === 'string') {
		// Handle "null" string
		if (prop === 'null') return null;

		// Try to parse as JSON
		try {
			return JSON.parse(prop);
		} catch (e) {
			// If it's not valid JSON, return the string as-is
			// This handles simple string identifiers
			return prop as unknown as T;
		}
	}

	return prop as T;
}
