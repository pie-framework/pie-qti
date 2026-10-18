import type { BaseType, Cardinality } from '@pie-qti/qti-processing';

/**
 * QTI variable JSON at the PCI runtime boundary (QTI 3.0 §6.1).
 *
 * A PCI module's `getResponse()` and the `state` seeded at `getInstance` use the QTI
 * variable JSON binding: `{"base":{"identifier":"A"}}` for single cardinality,
 * `{"list":{"identifier":["A","B"]}}` for multiple/ordered, and `{"record":{...}}` for
 * records, each field its own variable JSON value. The player's runtime values are
 * plain — these two functions are the whole translation.
 */

const KNOWN_BASE_TYPES: ReadonlySet<string> = new Set([
	'boolean',
	'integer',
	'float',
	'string',
	'identifier',
	'uri',
	'pair',
	'directedPair',
	'point',
	'duration',
	'file',
]);

/** A runtime value as QTI variable JSON. `null`/`undefined` stay null. */
export function toQtiVariableJson(
	value: unknown,
	baseType: BaseType | undefined,
	cardinality: Cardinality
): unknown {
	if (value === null || value === undefined) return null;
	if (cardinality === 'record') {
		if (typeof value !== 'object' || Array.isArray(value)) return null;
		const record: Record<string, unknown> = {};
		for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
			record[key] = toQtiVariableJson(fieldValue, inferBaseType(fieldValue), 'single');
		}
		return { record };
	}
	const type = baseType ?? inferBaseType(value) ?? 'string';
	if (cardinality === 'multiple' || cardinality === 'ordered') {
		const list = Array.isArray(value) ? value : [value];
		return { list: { [type]: list } };
	}
	return { base: { [type]: value } };
}

/** QTI variable JSON as the player's runtime value; anything else passes through. */
export function fromQtiVariableJson(json: unknown): unknown {
	if (json === null || json === undefined) return null;
	if (typeof json !== 'object' || Array.isArray(json)) return json;
	const container = json as Record<string, unknown>;
	if ('base' in container) {
		const base = container.base;
		if (typeof base !== 'object' || base === null) return null;
		const values = Object.values(base as Record<string, unknown>);
		return values.length === 1 ? values[0] : null;
	}
	if ('list' in container) {
		const list = container.list;
		if (typeof list !== 'object' || list === null) return null;
		const values = Object.values(list as Record<string, unknown>);
		return values.length === 1 && Array.isArray(values[0]) ? values[0] : null;
	}
	if ('record' in container) {
		const record = container.record;
		if (typeof record !== 'object' || record === null) return null;
		const fields: Record<string, unknown> = {};
		for (const [key, fieldValue] of Object.entries(record as Record<string, unknown>)) {
			fields[key] = fromQtiVariableJson(fieldValue);
		}
		return fields;
	}
	return json;
}

/** A plain runtime value's QTI base-type name, when its JavaScript type says one. */
function inferBaseType(value: unknown): BaseType | undefined {
	switch (typeof value) {
		case 'boolean':
			return 'boolean';
		case 'number':
			return Number.isInteger(value) ? 'integer' : 'float';
		case 'string':
			return 'string';
		default:
			return undefined;
	}
}

/** Guard for config sources: only QTI base-type names are kept as-is. */
export function isKnownBaseType(value: string | undefined): value is BaseType {
	return typeof value === 'string' && KNOWN_BASE_TYPES.has(value);
}
