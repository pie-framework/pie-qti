import type { AttributeNameMapper } from './AttributeNameMapper.js';
import { QTI3_ATTRIBUTE_TO_QTI2 } from './qti3-attribute-map.js';

/**
 * QTI 3.0 attribute name mapper.
 *
 * QTI 3.0 uses kebab-case for attribute names. This mapper converts
 * between kebab-case (QTI 3.0) and camelCase (internal canonical form).
 *
 * @example
 * const mapper = new Qti3AttributeNameMapper();
 * mapper.toCanonical('response-identifier'); // => 'responseIdentifier'
 * mapper.toCanonical('max-choices'); // => 'maxChoices'
 * mapper.toNative('responseIdentifier'); // => 'response-identifier'
 * mapper.toNative('maxChoices'); // => 'max-choices'
 */
export class Qti3AttributeNameMapper implements AttributeNameMapper {
	readonly version = '3.0';

	// Reverse mapping cache (camelCase -> kebab-case)
	private reverseMap: Map<string, string> | null = null;

	/**
	 * Convert QTI 3.0 kebab-case attribute to canonical camelCase.
	 */
	toCanonical(attributeName: string): string {
		// Direct lookup
		const canonical = QTI3_ATTRIBUTE_TO_QTI2.get(attributeName);
		if (canonical) {
			return canonical;
		}

		// If already in camelCase (no hyphens), return as-is
		if (!attributeName.includes('-')) {
			return attributeName;
		}

		// Fallback: convert kebab-case to camelCase programmatically
		return this.kebabToCamelCase(attributeName);
	}

	/**
	 * Convert canonical camelCase to QTI 3.0 kebab-case.
	 */
	toNative(canonicalName: string): string {
		// Build reverse map on first use
		if (!this.reverseMap) {
			this.reverseMap = new Map();
			for (const [kebab, camel] of QTI3_ATTRIBUTE_TO_QTI2) {
				this.reverseMap.set(camel, kebab);
			}
		}

		// Direct lookup
		const native = this.reverseMap.get(canonicalName);
		if (native) {
			return native;
		}

		// If already in kebab-case, return as-is
		if (canonicalName.includes('-')) {
			return canonicalName;
		}

		// Fallback: convert camelCase to kebab-case programmatically
		return this.camelToKebabCase(canonicalName);
	}

	/**
	 * Check if attribute name is valid kebab-case.
	 */
	isValidAttributeName(attributeName: string): boolean {
		// Standard XML attributes are always valid
		if (
			attributeName.startsWith('xml:') ||
			attributeName.startsWith('xmlns') ||
			attributeName === 'id'
		) {
			return true;
		}

		// QTI 3.0 attributes should be kebab-case (lowercase with hyphens)
		// or simple lowercase (like 'shuffle', 'type', 'value')
		return /^[a-z][a-z0-9-]*$/.test(attributeName);
	}

	/**
	 * Convert kebab-case to camelCase.
	 * @private
	 */
	private kebabToCamelCase(str: string): string {
		return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
	}

	/**
	 * Convert camelCase to kebab-case.
	 * @private
	 */
	private camelToKebabCase(str: string): string {
		return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
	}
}
