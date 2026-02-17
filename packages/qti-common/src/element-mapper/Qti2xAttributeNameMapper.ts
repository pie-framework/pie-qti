import type { AttributeNameMapper } from './AttributeNameMapper';

/**
 * QTI 2.x attribute name mapper.
 *
 * QTI 2.x uses camelCase for all attribute names, so this mapper
 * is essentially a pass-through that validates camelCase format.
 *
 * @example
 * const mapper = new Qti2xAttributeNameMapper();
 * mapper.toCanonical('responseIdentifier'); // => 'responseIdentifier'
 * mapper.toNative('maxChoices'); // => 'maxChoices'
 */
export class Qti2xAttributeNameMapper implements AttributeNameMapper {
	readonly version = '2.x';

	/**
	 * For QTI 2.x, attributes are already in camelCase (canonical form).
	 */
	toCanonical(attributeName: string): string {
		return attributeName;
	}

	/**
	 * For QTI 2.x, attributes are already in camelCase (native form).
	 */
	toNative(canonicalName: string): string {
		return canonicalName;
	}

	/**
	 * Check if attribute name is valid camelCase (no hyphens).
	 */
	isValidAttributeName(attributeName: string): boolean {
		// QTI 2.x attributes should not contain hyphens
		// Exception: XML standard attributes like xml:lang, xml:base
		if (attributeName.startsWith('xml:') || attributeName.startsWith('xmlns')) {
			return true;
		}
		return !attributeName.includes('-');
	}
}
