/**
 * Helper utilities for web component prop handling
 */

/**
 * Parse a prop that may be a JSON string or an object
 * Used when components are used as web components and receive JSON strings
 */
export function parseJsonProp<T>(prop: T | string | null | undefined): T | undefined {
	if (prop === null || prop === undefined) return undefined;

	if (typeof prop === 'string') {
		// Handle "null" string
		if (prop === 'null') return undefined;

		// Try to parse as JSON
		try {
			return JSON.parse(prop) as T;
		} catch {
			// If it's not valid JSON, return the string as-is
			// This handles simple string identifiers
			return prop as unknown as T;
		}
	}

	return prop as T;
}
