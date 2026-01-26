import type { ElementNameMapper } from './ElementNameMapper.js';

/**
 * Element name mapper for QTI 2.x (versions 2.0, 2.1, 2.2).
 *
 * QTI 2.x uses camelCase element names:
 * - assessmentItem, itemBody, responseDeclaration
 * - choiceInteraction, simpleChoice
 * - responseProcessing, setOutcomeValue
 *
 * This mapper converts to/from lowercase canonical form for internal processing.
 */
export class Qti2xElementNameMapper implements ElementNameMapper {
	readonly version = '2.x';

	/**
	 * Convert QTI 2.x camelCase name to canonical lowercase.
	 * @param elementName - camelCase element name
	 * @returns lowercase canonical name
	 */
	toCanonical(elementName: string): string {
		return elementName.toLowerCase();
	}

	/**
	 * Convert canonical lowercase to QTI 2.x camelCase.
	 * Note: This is a best-effort conversion. The original casing
	 * should be preserved when possible by the parser.
	 *
	 * @param canonicalName - lowercase canonical name
	 * @returns camelCase element name
	 */
	toNative(canonicalName: string): string {
		// For QTI 2.x, we can return lowercase since XML is case-insensitive
		// and our parser uses case-insensitive matching anyway
		return canonicalName;
	}

	/**
	 * Validate QTI 2.x element name pattern.
	 * QTI 2.x uses camelCase starting with lowercase letter.
	 *
	 * @param elementName - Element name to validate
	 * @returns true if valid camelCase pattern
	 */
	isValidElementName(elementName: string): boolean {
		// QTI 2.x: starts with lowercase, can contain uppercase letters and numbers
		// Examples: assessmentItem, choiceInteraction, simpleChoice, html5div
		return /^[a-z][a-zA-Z0-9]*$/.test(elementName);
	}
}
