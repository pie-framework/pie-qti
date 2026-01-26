/**
 * Interface for mapping between QTI version-specific element names and canonical forms.
 *
 * QTI 2.x uses camelCase (e.g., 'choiceInteraction', 'simpleChoice')
 * QTI 3.0 uses kebab-case with qti- prefix (e.g., 'qti-choice-interaction', 'qti-simple-choice')
 *
 * This abstraction allows the parser and player to work with both versions
 * by converting to/from a canonical lowercase form.
 */
export interface ElementNameMapper {
	/**
	 * Convert QTI-version-specific element name to canonical lowercase form.
	 *
	 * @param elementName - The element name as it appears in the XML
	 * @returns Canonical lowercase name for internal processing
	 *
	 * @example
	 * // QTI 2.x
	 * toCanonical('choiceInteraction') // => 'choiceinteraction'
	 * toCanonical('simpleChoice') // => 'simplechoice'
	 *
	 * @example
	 * // QTI 3.0
	 * toCanonical('qti-choice-interaction') // => 'choiceinteraction'
	 * toCanonical('qti-simple-choice') // => 'simplechoice'
	 */
	toCanonical(elementName: string): string;

	/**
	 * Convert canonical name back to version-specific form.
	 *
	 * @param canonicalName - Lowercase canonical name
	 * @returns Version-specific element name
	 *
	 * @example
	 * // QTI 2.x
	 * toNative('choiceinteraction') // => 'choiceInteraction'
	 * toNative('simplechoice') // => 'simpleChoice'
	 *
	 * @example
	 * // QTI 3.0
	 * toNative('choiceinteraction') // => 'qti-choice-interaction'
	 * toNative('simplechoice') // => 'qti-simple-choice'
	 */
	toNative(canonicalName: string): string;

	/**
	 * Check if element name matches expected pattern for this QTI version.
	 *
	 * @param elementName - Element name to validate
	 * @returns true if valid for this version
	 *
	 * @example
	 * // QTI 2.x mapper
	 * isValidElementName('choiceInteraction') // => true
	 * isValidElementName('qti-choice-interaction') // => false
	 *
	 * @example
	 * // QTI 3.0 mapper
	 * isValidElementName('qti-choice-interaction') // => true
	 * isValidElementName('choiceInteraction') // => false
	 */
	isValidElementName(elementName: string): boolean;

	/**
	 * Get the QTI version this mapper handles.
	 */
	readonly version: string;
}
