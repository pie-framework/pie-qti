/**
 * Compile-time declaration building: the response, outcome, template and context
 * declarations parsed from the item source, with their defaults, correct responses,
 * mappings and lookup tables.
 *
 * Everything here is a pure function of the parsed item document, so the compiled
 * declarations are immutable source-derived artifacts a definition shares between
 * sessions (each session deep-clones them before template rules mutate a copy).
 */
import {
	type AreaMapEntry,
	type AreaMapping,
	type BaseType,
	type Cardinality,
	type DeclarationMap,
	coerceBaseValue,
	findDescendants,
	findFirstDescendant,
	getAttr,
	type QtiValue,
	qtiNull,
	qtiValue,
	parseInterpolationTableDeclaration,
	parseMatchTableDeclaration,
} from '@pie-qti/qti-processing';
import type { AttributeNameMapper, ElementNameMapper } from '@pie-qti/qti-common';
import type { AssessmentItemDocument } from '../../document/AssessmentItemDocument.js';

export type DeclKind = 'response' | 'outcome' | 'template' | 'context';

/** The parsed item document a declaration map is compiled from. */
export interface DeclarationBuildInput {
	readonly itemDocument: AssessmentItemDocument;
	readonly mapper: ElementNameMapper;
	readonly attributeMapper: AttributeNameMapper | undefined;
}

export function buildDeclarationMap(input: DeclarationBuildInput): DeclarationMap {
	const { itemDocument, mapper, attributeMapper } = input;
	const decls: DeclarationMap = {};

	const getAttrMapped = (el: Element, canonicalName: string): string | null =>
		readMappedAttribute(attributeMapper, el, canonicalName);

	const addDecl = (kind: DeclKind, el: Element) => {
		const identifier = getAttrMapped(el, 'identifier');
		const cardinality = (getAttrMapped(el, 'cardinality') || 'single') as Cardinality;
		const baseType = cardinality === 'record'
			? undefined
			: (getAttrMapped(el, 'baseType') || 'string') as BaseType;
		if (!identifier) return;

		const declaredDefault = parseDefaultValue(input, el, baseType, cardinality);
		const impliedNumericDefault = !declaredDefault && hasImpliedNumericDefault(kind, baseType, cardinality);
		const defaultValue = declaredDefault ?? impliedDefaultValue(kind, baseType, cardinality);
		decls[identifier] = {
			identifier,
			...(baseType ? { baseType } : {}),
			cardinality,
			defaultValue,
			value: defaultValue,
			isTemplate: kind === 'template',
			impliedNumericDefault,
			// @ts-expect-error internal marker for templates
			__kind: kind,
		};

		// Response + outcome declarations may define mappings used by mapResponse/mapOutcome.
		// (Templates do not participate in mapping.)
		if (kind === 'response' || kind === 'outcome') {
			const mappingEl = findFirstDescendant(el, mapper.toNative('mapping'));
			if (mappingEl && baseType) {
				decls[identifier].mapping = parseMapping(mappingEl, baseType, mapper, attributeMapper);
			}
		}

		// Outcome declarations may define a lookup table (matchTable or interpolationTable)
		// used by the lookupOutcomeValue rule.
		if (kind === 'outcome') {
			const matchTableEl = findFirstDescendant(el, mapper.toNative('matchtable'));
			const interpolationTableEl = findFirstDescendant(el, mapper.toNative('interpolationtable'));
			if (matchTableEl) {
				decls[identifier].lookupTable = parseMatchTableDeclaration(matchTableEl, mapper);
			} else if (interpolationTableEl) {
				decls[identifier].lookupTable = parseInterpolationTableDeclaration(interpolationTableEl, mapper);
			}
		}

		if (kind === 'response') {
			const correctEl = findFirstDescendant(el, mapper.toNative('correctresponse'));
			if (correctEl) {
				decls[identifier].correctResponse = parseCorrectResponse(input, correctEl, baseType, cardinality);
			}
			const areaMappingEl = findFirstDescendant(el, mapper.toNative('areamapping'));
			if (areaMappingEl) {
				decls[identifier].areaMapping = parseAreaMapping(areaMappingEl, mapper);
			}
		}
	};

	for (const el of itemDocument.findDeclarationElements('response')) addDecl('response', el);
	for (const el of itemDocument.findDeclarationElements('outcome')) addDecl('outcome', el);
	for (const el of itemDocument.findDeclarationElements('template')) addDecl('template', el);
	for (const el of itemDocument.findDeclarationElements('context')) addDecl('context', el);

	return decls;
}

export function ensureBuiltinDeclarations(decls: DeclarationMap): void {
	// completionStatus + numAttempts are defined in QTI (esp. adaptive items) and commonly used
	// without explicit outcomeDeclaration in authoring content.
	if (!decls.completionStatus) {
		decls.completionStatus = {
			identifier: 'completionStatus',
			baseType: 'identifier',
			cardinality: 'single',
			value: qtiValue('identifier', 'single', 'not_attempted'),
			isTemplate: false,
			// @ts-expect-error internal marker
			__kind: 'outcome',
		};
	}

	if (!decls.numAttempts) {
		decls.numAttempts = {
			identifier: 'numAttempts',
			baseType: 'integer',
			cardinality: 'single',
			defaultValue: qtiValue('integer', 'single', 0),
			value: qtiValue('integer', 'single', 0),
			isTemplate: false,
			// @ts-expect-error internal marker
			__kind: 'outcome',
		};
	}

	if (!decls.duration) {
		decls.duration = {
			identifier: 'duration',
			baseType: 'duration',
			cardinality: 'single',
			defaultValue: qtiValue('duration', 'single', 0),
			value: qtiValue('duration', 'single', 0),
			isTemplate: false,
			// @ts-expect-error internal marker
			__kind: 'outcome',
		};
	}

	// QTI 3 built-in context variable, set by the delivery system.
	if (!decls.QTI_CONTEXT) {
		decls.QTI_CONTEXT = {
			identifier: 'QTI_CONTEXT',
			cardinality: 'record',
			defaultValue: qtiNull(undefined, 'record'),
			value: qtiNull(undefined, 'record'),
			isTemplate: false,
			// @ts-expect-error internal marker
			__kind: 'context',
		};
	}

	// Common scoring defaults
	if (!decls.SCORE) {
		decls.SCORE = {
			identifier: 'SCORE',
			baseType: 'float',
			cardinality: 'single',
			value: qtiValue('float', 'single', 0),
			isTemplate: false,
			// @ts-expect-error internal marker
			__kind: 'outcome',
		};
	}
	if (!decls.MAXSCORE) {
		decls.MAXSCORE = {
			identifier: 'MAXSCORE',
			baseType: 'float',
			cardinality: 'single',
			value: qtiValue('float', 'single', 1),
			isTemplate: false,
			// @ts-expect-error internal marker
			__kind: 'outcome',
		};
	}
}

/**
 * QTI 2.1 §5.2, carried into 2.2 and 3.0: an outcome variable with no declared default is
 * initialized to NULL unless it is of a numeric type, in which case it is initialized to 0.
 * Response and template variables keep NULL — an unanswered numeric response must stay
 * distinguishable from an answered zero.
 */
export function hasImpliedNumericDefault(
	kind: DeclKind,
	baseType: BaseType | undefined,
	cardinality: Cardinality,
): boolean {
	if (kind !== 'outcome' || cardinality !== 'single') return false;
	return baseType === 'integer' || baseType === 'float';
}

export function impliedDefaultValue(
	kind: DeclKind,
	baseType: BaseType | undefined,
	cardinality: Cardinality,
): QtiValue {
	if (hasImpliedNumericDefault(kind, baseType, cardinality)) {
		return qtiValue(baseType as 'integer' | 'float', 'single', 0);
	}
	return qtiNull(baseType, cardinality);
}

/** Returns undefined when the declaration carries no <defaultValue> at all. */
function parseDefaultValue(
	input: DeclarationBuildInput,
	declEl: Element,
	baseType: BaseType | undefined,
	cardinality: Cardinality,
): QtiValue | undefined {
	const defaultEl = findFirstDescendant(declEl, input.mapper.toNative('defaultvalue'));
	if (!defaultEl) return undefined;
	return parseDeclarationValues(input, defaultEl, baseType, cardinality);
}

function parseCorrectResponse(
	input: DeclarationBuildInput,
	correctEl: Element,
	baseType: BaseType | undefined,
	cardinality: Cardinality,
): QtiValue {
	return parseDeclarationValues(input, correctEl, baseType, cardinality);
}

function parseDeclarationValues(
	input: DeclarationBuildInput,
	container: Element,
	baseType: BaseType | undefined,
	cardinality: Cardinality,
): QtiValue {
	const { mapper, itemDocument } = input;
	const contentLanguage = itemDocument.getContentLanguage();
	const valueElements = findDescendants(container, mapper.toNative('value'));
	if (cardinality === 'record') {
		const record: Record<string, QtiValue> = {};
		for (const valueElement of valueElements) {
			const fieldIdentifier = readMappedAttribute(input.attributeMapper, valueElement, 'fieldIdentifier');
			const fieldBaseType = readMappedAttribute(input.attributeMapper, valueElement, 'baseType') as BaseType | null;
			if (!fieldIdentifier || !fieldBaseType) continue;
			record[fieldIdentifier] = coerceBaseValue(fieldBaseType, valueElement.textContent || '', contentLanguage);
		}
		return Object.keys(record).length > 0
			? qtiValue(undefined, 'record', record)
			: qtiNull(undefined, 'record');
	}

	if (!baseType) return qtiNull(undefined, cardinality);
	const values = valueElements.map((value) => (value.textContent || '').trim());
	if (cardinality === 'multiple' || cardinality === 'ordered') {
		return qtiValue(
			baseType,
			cardinality,
			values.map((t) => {
				const v = coerceBaseValue(baseType, t, contentLanguage);
				return v.kind === 'value' ? v.value : null;
			})
		);
	}
	return coerceBaseValue(baseType, values[0] ?? '', contentLanguage);
}

/**
 * Get attribute value with QTI version support: the attribute mapper's native form
 * first (e.g., 'mapkey' -> 'map-key' for QTI 3.0), then the canonical name for
 * QTI 2.x compatibility.
 */
function readMappedAttribute(
	attributeMapper: AttributeNameMapper | undefined,
	el: Element,
	canonicalName: string,
): string | null {
	if (attributeMapper) {
		const nativeName = attributeMapper.toNative(canonicalName);
		const value = el.getAttribute(nativeName);
		if (value !== null) return value;
	}
	return getAttr(el, canonicalName);
}

function parseMapping(mappingEl: Element, baseType: BaseType, mapper: ElementNameMapper, attributeMapper: AttributeNameMapper | undefined) {
	const defaultValue = Number(getAttr(mappingEl, 'defaultValue') || 0);
	const lowerBound = getAttr(mappingEl, 'lowerBound') ? Number(getAttr(mappingEl, 'lowerBound')) : undefined;
	const upperBound = getAttr(mappingEl, 'upperBound') ? Number(getAttr(mappingEl, 'upperBound')) : undefined;
	// mapEntry@caseSensitive defaults to "false" (QTI 2.2 XSD, optional, default "false"):
	// string entries match case-insensitively unless authored "true". The mapping element
	// itself defines no caseSensitive attribute in any QTI version, so none is read.
	const entries: Record<string, any> = {};

	const normalizePairKey = (k: string): string => {
		const parts = k.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 2) return [...parts].sort().join(' ');
		return k.trim();
	};

	const normalizeDirectedPairKey = (k: string): string => {
		const parts = k.trim().split(/\s+/).filter(Boolean);
		if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
		return k.trim();
	};

	for (const e of findDescendants(mappingEl, mapper.toNative('mapentry'))) {
		const mapKey = readMappedAttribute(attributeMapper, e, 'mapKey');
		const mappedValue = readMappedAttribute(attributeMapper, e, 'mappedValue');
		if (!mapKey || mappedValue === null) continue;
		// Only string values fold case: identifier and the other base types always match
		// exactly (QTI ASI §17), whatever the entry says.
		const effectiveCaseSensitive = baseType === 'string' ? readMappedAttribute(attributeMapper, e, 'caseSensitive') || 'false' : 'true';
		const storedKey =
			baseType === 'pair'
				? normalizePairKey(mapKey)
				: baseType === 'directedPair'
					? normalizeDirectedPairKey(mapKey)
					: mapKey;
		entries[storedKey] = { mapKey: storedKey, mappedValue: Number(mappedValue), caseSensitive: effectiveCaseSensitive };
		if (effectiveCaseSensitive !== 'true') {
			const lowerKey = storedKey.toLowerCase();
			entries[lowerKey] = {
				mapKey: lowerKey,
				mappedValue: Number(mappedValue),
				caseSensitive: effectiveCaseSensitive,
			};
		}
	}

	return { defaultValue, lowerBound, upperBound, entries };
}

function parseAreaMapping(areaMappingEl: Element, mapper: ElementNameMapper): AreaMapping {
	const defaultValue = Number(getAttr(areaMappingEl, 'defaultValue') || 0);
	const lowerBound = getAttr(areaMappingEl, 'lowerBound')
		? Number(getAttr(areaMappingEl, 'lowerBound'))
		: undefined;
	const upperBound = getAttr(areaMappingEl, 'upperBound')
		? Number(getAttr(areaMappingEl, 'upperBound'))
		: undefined;

	const entries: AreaMapEntry[] = [];
	for (const e of findDescendants(areaMappingEl, mapper.toNative('areamapentry'))) {
		const shape = (getAttr(e, 'shape') || 'default') as AreaMapEntry['shape'];
		const coords = String(getAttr(e, 'coords') || '');
		const mappedValue = Number(getAttr(e, 'mappedValue') || 0);
		entries.push({ shape, coords, mappedValue });
	}

	return { defaultValue, lowerBound, upperBound, entries };
}
