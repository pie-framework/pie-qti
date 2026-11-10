/**
 * Runtime value coercion: raw host/component/serialized values read as a declaration's
 * QTI base type and cardinality.
 */
import {
	type BaseType,
	type Cardinality,
	coerceBaseValue,
	type QtiValue,
	qtiNull,
	qtiValue,
} from '@pie-qti/qti-processing';
import type { AssessmentItemDocument } from '../../document/AssessmentItemDocument.js';
import {
	createExtendedTextNumericRecord,
	EXTENDED_TEXT_RECORD_FIELD_TYPES,
} from '../../interactions/extended-text/response.js';
import { cloneValue } from '../../utils/cloneFreeze.js';

/** The parsed item document numeric input bases and the content language are read from. */
export interface DeclarationValueInput {
	readonly itemDocument: AssessmentItemDocument;
}

export function coerceToDeclarationValue(
	input: DeclarationValueInput,
	baseType: BaseType | undefined,
	cardinality: Cardinality,
	raw: unknown,
	identifier?: string,
): QtiValue {
	if (raw === null || raw === undefined) return qtiNull(baseType, cardinality);

	// Allow callers to pass fully-formed QtiValue (e.g. session restore).
	if (typeof raw === 'object' && raw && 'kind' in raw) {
		return cloneValue(raw as QtiValue);
	}

	const inputBase = identifier ? getNumericInputBase(input, identifier) : undefined;
	if (cardinality === 'record') {
		return coerceRecordValue(input, raw, inputBase ?? 10);
	}

	if (!baseType) return qtiNull(undefined, cardinality);

	// For file types, preserve QTIFileResponse objects directly
	if (baseType === 'file') {
		if (cardinality === 'multiple' || cardinality === 'ordered') {
			const arr = Array.isArray(raw) ? raw : [raw];
			return qtiValue(
				baseType,
				cardinality,
				cloneValue(arr.filter((v) => v !== null && v !== undefined)),
			);
		}
		return qtiValue(baseType, cardinality, cloneValue(raw));
	}

	if (cardinality === 'multiple' || cardinality === 'ordered') {
		const arr = Array.isArray(raw) ? raw : [raw];
		const coerced = arr
			.map((entry) => coerceSingleValue(input, baseType, entry, inputBase))
			.filter((v): v is Extract<QtiValue, { kind: 'value' }> => v.kind === 'value')
			.map((v) => v.value);
		// Multiple/ordered can legitimately be an empty container (distinct from null).
		return qtiValue(baseType, cardinality, coerced);
	}

	return coerceSingleValue(input, baseType, raw, inputBase);
}

/**
 * One value of a response, read as its base type. Typed numeric text reads in the number base
 * of the string interaction bound to the response (QTI ASI stringInteraction `base`). The base
 * applies to typed text only: a finite number already is the variable's value — a restored
 * session, a correct response or default, a value read back from the session — and reading
 * its decimal digits in the base again would change it on every round trip.
 */
function coerceSingleValue(
	input: DeclarationValueInput,
	baseType: BaseType,
	raw: unknown,
	inputBase: number | undefined,
): QtiValue {
	const t = String(raw ?? '').trim();
	if (t.length === 0) return qtiNull(baseType, 'single');
	const typed = !(typeof raw === 'number' && Number.isFinite(raw));
	if (inputBase !== undefined && typed && (baseType === 'integer' || baseType === 'float')) {
		const numeric = createExtendedTextNumericRecord(t, inputBase, contentLanguage(input));
		const value = baseType === 'integer' ? numeric.integerValue : numeric.floatValue;
		return value === null ? qtiNull(baseType, 'single') : qtiValue(baseType, 'single', value);
	}
	return coerceBaseValue(baseType, t, contentLanguage(input));
}

/**
 * The number base typed numeric text for `responseIdentifier` reads in (QTI ASI
 * stringInteraction `base`): the bound extendedTextInteraction's, decimal included (its
 * lexical reading also fills the numeric record fields), or the bound textEntryInteraction's
 * when it is not decimal. Undefined otherwise: decimal text entry keeps the content-language
 * number reading.
 */
function getNumericInputBase(input: DeclarationValueInput, responseIdentifier: string): number | undefined {
	const extendedTextBase = input.itemDocument.getExtendedTextBase(responseIdentifier);
	if (extendedTextBase !== undefined) return extendedTextBase;
	const textEntryBase = input.itemDocument.getTextEntryBase(responseIdentifier);
	return textEntryBase !== undefined && textEntryBase !== 10 ? textEntryBase : undefined;
}

function coerceRecordValue(input: DeclarationValueInput, raw: unknown, base: number): QtiValue {
	let source = raw;
	if (typeof source === 'string') {
		const stringSource = source;
		if (stringSource.trim().length === 0) return qtiNull(undefined, 'record');
		if (stringSource.trimStart().startsWith('{')) {
			try {
				source = JSON.parse(stringSource);
			} catch {
				return qtiNull(undefined, 'record');
			}
		} else {
			source = createExtendedTextNumericRecord(stringSource, base, contentLanguage(input));
		}
	}
	if (!source || typeof source !== 'object' || Array.isArray(source)) {
		return qtiNull(undefined, 'record');
	}

	const fields: Record<string, QtiValue> = {};
	for (const [fieldIdentifier, rawField] of Object.entries(source)) {
		if (rawField && typeof rawField === 'object' && 'kind' in rawField) {
			fields[fieldIdentifier] = rawField as QtiValue;
			continue;
		}

		let fieldBaseType = EXTENDED_TEXT_RECORD_FIELD_TYPES[
			fieldIdentifier as keyof typeof EXTENDED_TEXT_RECORD_FIELD_TYPES
		] as BaseType | undefined;
		let fieldValue = rawField;
		let fieldCardinality: Cardinality = Array.isArray(rawField) ? 'multiple' : 'single';
		if (rawField && typeof rawField === 'object' && !Array.isArray(rawField) && 'value' in rawField) {
			const serializedField = rawField as {
				baseType?: BaseType;
				cardinality?: Cardinality;
				value: unknown;
			};
			fieldBaseType = serializedField.baseType ?? fieldBaseType;
			fieldValue = serializedField.value;
			fieldCardinality =
				serializedField.cardinality === 'multiple' || serializedField.cardinality === 'ordered'
					? serializedField.cardinality
					: Array.isArray(fieldValue) ? 'multiple' : 'single';
		}

		if (!fieldBaseType) {
			const sample = Array.isArray(fieldValue)
				? fieldValue.find((item) => item !== null && item !== undefined)
				: fieldValue;
			fieldBaseType = typeof sample === 'boolean'
				? 'boolean'
				: typeof sample === 'number'
					? (Number.isInteger(sample) ? 'integer' : 'float')
					: 'string';
		}
		if (fieldValue === null || fieldValue === undefined) {
			fields[fieldIdentifier] = qtiNull(fieldBaseType, fieldCardinality);
		} else if (fieldCardinality !== 'single') {
			// A container field, such as a PCI record member written as `list`: each value
			// is coerced, rather than the whole array as one string.
			const containerBaseType = fieldBaseType;
			const items = (Array.isArray(fieldValue) ? fieldValue : [fieldValue])
				.filter((item) => item !== null && item !== undefined)
				.map((item) => {
					if (containerBaseType === 'file' && typeof item === 'object') return item;
					const coerced = coerceBaseValue(containerBaseType, String(item), contentLanguage(input));
					return coerced.kind === 'value' ? coerced.value : null;
				})
				.filter((item) => item !== null);
			fields[fieldIdentifier] = qtiValue(containerBaseType, fieldCardinality, items);
		} else if (fieldBaseType === 'file' && typeof fieldValue === 'object') {
			fields[fieldIdentifier] = qtiValue('file', 'single', fieldValue);
		} else {
			fields[fieldIdentifier] = coerceBaseValue(fieldBaseType, String(fieldValue), contentLanguage(input));
		}
	}

	return Object.keys(fields).length > 0
		? qtiValue(undefined, 'record', fields)
		: qtiNull(undefined, 'record');
}

function contentLanguage(input: DeclarationValueInput): string | undefined {
	return input.itemDocument.getContentLanguage();
}
