/**
 * Interface for mapping between QTI version-specific attribute names and canonical forms.
 *
 * QTI 2.x uses camelCase (e.g., 'responseIdentifier', 'maxChoices', 'baseType')
 * QTI 3.0 uses kebab-case (e.g., 'response-identifier', 'max-choices', 'base-type')
 *
 * This abstraction allows the parser and extractors to work with both versions
 * by converting to/from a canonical camelCase form for internal processing.
 */
export interface AttributeNameMapper {
	/**
	 * Convert QTI-version-specific attribute name to canonical camelCase form.
	 *
	 * @param attributeName - The attribute name as it appears in the XML
	 * @returns Canonical camelCase name for internal processing
	 *
	 * @example
	 * // QTI 2.x
	 * toCanonical('responseIdentifier') // => 'responseIdentifier'
	 * toCanonical('maxChoices') // => 'maxChoices'
	 *
	 * @example
	 * // QTI 3.0
	 * toCanonical('response-identifier') // => 'responseIdentifier'
	 * toCanonical('max-choices') // => 'maxChoices'
	 */
	toCanonical(attributeName: string): string;

	/**
	 * Convert canonical name back to version-specific form.
	 *
	 * @param canonicalName - camelCase canonical name
	 * @returns Version-specific attribute name
	 *
	 * @example
	 * // QTI 2.x
	 * toNative('responseIdentifier') // => 'responseIdentifier'
	 * toNative('maxChoices') // => 'maxChoices'
	 *
	 * @example
	 * // QTI 3.0
	 * toNative('responseIdentifier') // => 'response-identifier'
	 * toNative('maxChoices') // => 'max-choices'
	 */
	toNative(canonicalName: string): string;

	/**
	 * Check if attribute name matches expected pattern for this QTI version.
	 *
	 * @param attributeName - Attribute name to validate
	 * @returns true if valid for this version
	 *
	 * @example
	 * // QTI 2.x mapper
	 * isValidAttributeName('responseIdentifier') // => true
	 * isValidAttributeName('response-identifier') // => false
	 *
	 * @example
	 * // QTI 3.0 mapper
	 * isValidAttributeName('response-identifier') // => true
	 * isValidAttributeName('responseIdentifier') // => false
	 */
	isValidAttributeName(attributeName: string): boolean;

	/**
	 * Get the QTI version this mapper handles.
	 */
	readonly version: string;
}
