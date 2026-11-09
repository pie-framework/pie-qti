import {
	type AttributeNameMapper,
	detectQtiVersion,
	type ElementNameMapper,
	Qti2xAttributeNameMapper,
	Qti2xElementNameMapper,
	Qti3AttributeNameMapper,
	Qti3ElementNameMapper,
	type QtiVersion,
} from '@pie-qti/qti-common';

/**
 * The player's one name-mapper resolution.
 *
 * An unknown (or any non-3.0) version maps to QTI 2.x, the primary supported
 * format. Explicitly passed mappers always win over version-derived ones; the
 * `createExtractionUtils()` default stays QTI 2.x regardless of the item's
 * version (extractors ask for their own mapper explicitly when they need one).
 */

/** The element name mapper for a QTI version: `'3.0'` maps QTI 3.0 names, anything else to QTI 2.x. */
export function elementNameMapperForVersion(version: QtiVersion | string): ElementNameMapper {
	return version === '3.0' ? new Qti3ElementNameMapper() : new Qti2xElementNameMapper();
}

/** The attribute name mapper for a QTI version, with the same version rule. */
export function attributeNameMapperForVersion(version: QtiVersion | string): AttributeNameMapper {
	return version === '3.0' ? new Qti3AttributeNameMapper() : new Qti2xAttributeNameMapper();
}

/**
 * The mapper pair for a compiled item definition: explicitly passed mappers
 * win; each missing one comes from the version detected from the item XML (an
 * unknown version maps to QTI 2.x). The definition's attribute mapper follows
 * the detected version, not the element mapper's.
 */
export function resolveNameMappers(config: {
	itemXml?: string;
	elementNameMapper?: ElementNameMapper;
	attributeNameMapper?: AttributeNameMapper;
}): { elementNameMapper: ElementNameMapper; attributeNameMapper: AttributeNameMapper } {
	if (config.elementNameMapper && config.attributeNameMapper) {
		return {
			elementNameMapper: config.elementNameMapper,
			attributeNameMapper: config.attributeNameMapper,
		};
	}

	const version = detectQtiVersion(config.itemXml ?? '');
	return {
		elementNameMapper: config.elementNameMapper ?? elementNameMapperForVersion(version),
		attributeNameMapper: config.attributeNameMapper ?? attributeNameMapperForVersion(version),
	};
}

/**
 * The mappers extraction helpers resolve names with when the caller passes
 * none: QTI 2.x, whatever version the extracted markup is.
 */
export function defaultExtractionMappers(
	mapper?: ElementNameMapper,
	attributeMapper?: AttributeNameMapper,
): { elementMapper: ElementNameMapper; attrMapper: AttributeNameMapper } {
	return {
		elementMapper: mapper ?? new Qti2xElementNameMapper(),
		attrMapper: attributeMapper ?? new Qti2xAttributeNameMapper(),
	};
}
