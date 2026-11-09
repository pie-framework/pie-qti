import { type BaseType, type Cardinality, parseDurationSeconds } from '@pie-qti/qti-processing';

/**
 * QTI variable JSON at the PCI runtime boundary: the binding PCI v1.0 (Appendix A) defines and
 * QTI 3.0 adopts for `qti-portable-custom-interaction` (§6.1). A module's `getResponse()` answers,
 * and the `state` seeded at `getInstance` is written, in it:
 *
 * - single cardinality: `{"base": {"<baseType>": value}}`, NULL as `{"base": null}`;
 * - multiple and ordered: `{"list": {"<baseType>": [value, ...]}}`;
 * - record: `{"record": [{"name": "<field>", "base": {...}}, {"name": "<field>", "list": {...}}]}`.
 *
 * Base-type values are JSON scalars, except pair and directedPair (`["A", "B"]`), point
 * (`[x, y]`), duration (an ISO 8601 duration such as `"PT1M30S"`) and file
 * (`{"data": base64, "mime": ..., "name": ...}`).
 *
 * The player's runtime values are the ones `getResponses()` reports: pairs and points as `"A B"`
 * strings, durations in seconds, files as `QTIFileResponse`. Records travel in their typed form,
 * each field `{ baseType, cardinality, value }` as serialized item sessions carry them, because a
 * record declaration types none of its fields and the JSON is the only place their base types are
 * stated. These two functions are the whole translation, by base type, in both directions.
 */

/** A record field in the player's typed record form. */
export interface QtiRecordField {
	baseType?: BaseType;
	cardinality: Cardinality;
	value: unknown;
}

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

/**
 * A runtime value as QTI variable JSON, by the declaration's base type and cardinality (inferred
 * from the value's JavaScript type when the base type is unknown). `null`/`undefined` stay null:
 * there is no state to seed.
 */
export function toQtiVariableJson(
	value: unknown,
	baseType: BaseType | undefined,
	cardinality: Cardinality
): unknown {
	if (value === null || value === undefined) return null;
	if (cardinality === 'record') return recordToJson(value);
	if (cardinality === 'multiple' || cardinality === 'ordered') {
		const list = Array.isArray(value) ? value : [value];
		const type = baseType ?? inferListBaseType(list) ?? 'string';
		return { list: { [type]: list.map((item) => encodeBaseValue(type, item)) } };
	}
	const type = baseType ?? inferBaseType(value) ?? 'string';
	return { base: { [type]: encodeBaseValue(type, value) } };
}

/**
 * QTI variable JSON as the player's runtime value. Only the PCI v1.0 Appendix A binding is read;
 * everything else reads as NULL:
 *
 * - a value that is not variable JSON: not an object, or an object with no `base`, `list` or
 *   `record` key (a raw runtime value such as `"A B"` included);
 * - a `base` or `list` wrapper that is not one `{"<baseType>": value}` entry naming a QTI base
 *   type;
 * - a value outside its base type's binding: a pair, directedPair or point that is not an array,
 *   a duration that is not an ISO 8601 string, a record that is not an array of named members.
 *   One such list member makes the whole list NULL.
 *
 * The base type the JSON names is the one the value is read by, also when it differs from the
 * response declaration's.
 */
export function fromQtiVariableJson(json: unknown): unknown {
	if (!isPlainObject(json)) return null;
	if ('base' in json) {
		const entry = typedEntry(json.base);
		return entry ? valueOrNull(decodeBaseValue(entry.baseType, entry.value)) : null;
	}
	if ('list' in json) {
		const entry = typedEntry(json.list);
		if (!entry || !Array.isArray(entry.value)) return null;
		return decodeList(entry.baseType, entry.value);
	}
	if ('record' in json) return recordFromJson(json.record);
	return null;
}

/** Guard for config sources: only QTI base-type names are kept as-is. */
export function isKnownBaseType(value: string | undefined): value is BaseType {
	return typeof value === 'string' && KNOWN_BASE_TYPES.has(value);
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

function recordToJson(value: unknown): unknown {
	if (!isPlainObject(value)) return null;
	return {
		record: Object.entries(value).map(([name, field]) => recordMember(name, readRecordField(field))),
	};
}

/**
 * A record field the player holds: its typed form, a runtime QTI value (`{kind, baseType,
 * cardinality, value}`), or a plain value whose base type its JavaScript type says.
 */
function readRecordField(field: unknown): QtiRecordField {
	if (isPlainObject(field) && ('value' in field || 'kind' in field)) {
		const typed = field as { kind?: unknown; baseType?: BaseType; cardinality?: Cardinality; value?: unknown };
		const value = typed.kind !== undefined && typed.kind !== 'value' ? null : (typed.value ?? null);
		return {
			baseType: typed.baseType ?? inferFieldBaseType(value),
			cardinality: typed.cardinality ?? (Array.isArray(value) ? 'multiple' : 'single'),
			value,
		};
	}
	return {
		baseType: inferFieldBaseType(field),
		cardinality: Array.isArray(field) ? 'multiple' : 'single',
		value: field ?? null,
	};
}

function recordMember(name: string, field: QtiRecordField): Record<string, unknown> {
	if (field.value === null || field.value === undefined) return { name, base: null };
	const cardinality = field.cardinality === 'multiple' || field.cardinality === 'ordered' ? field.cardinality : 'single';
	return { name, ...(toQtiVariableJson(field.value, field.baseType, cardinality) as object) };
}

function recordFromJson(record: unknown): Record<string, QtiRecordField> | null {
	if (!Array.isArray(record)) return null;
	const fields: Record<string, QtiRecordField> = {};
	for (const member of record) {
		// A member needs a name to be addressed by fieldValue; one without is skipped.
		if (!isPlainObject(member) || typeof member.name !== 'string') continue;
		fields[member.name] = memberField(member);
	}
	return fields;
}

function memberField(member: Record<string, unknown>): QtiRecordField {
	if ('list' in member) {
		const entry = typedEntry(member.list);
		if (!entry || !Array.isArray(entry.value)) return { cardinality: 'multiple', value: null };
		return {
			baseType: entry.baseType,
			cardinality: 'multiple',
			value: decodeList(entry.baseType, entry.value),
		};
	}
	const entry = 'base' in member ? typedEntry(member.base) : null;
	if (!entry) return { cardinality: 'single', value: null };
	return {
		baseType: entry.baseType,
		cardinality: 'single',
		value: valueOrNull(decodeBaseValue(entry.baseType, entry.value)),
	};
}

// ---------------------------------------------------------------------------
// Base-type values
// ---------------------------------------------------------------------------

/** Marks a decoded value that is outside its base type's binding. */
const REJECTED = Symbol('rejected');

/** An ISO 8601 duration literal, as the binding writes durations (`PT1M30S`). */
const ISO_8601_DURATION = /^-?P/;

/** The one `{"<baseType>": value}` entry of a base or list wrapper; null unless it names a QTI base type. */
function typedEntry(wrapper: unknown): { baseType: BaseType; value: unknown } | null {
	if (!isPlainObject(wrapper)) return null;
	const entries = Object.entries(wrapper);
	if (entries.length !== 1) return null;
	const [key, value] = entries[0]!;
	return isKnownBaseType(key) ? { baseType: key, value } : null;
}

function encodeBaseValue(baseType: string, value: unknown): unknown {
	if (value === null || value === undefined) return null;
	switch (baseType) {
		case 'pair':
		case 'directedPair':
			return toTuple(value, (part) => part);
		case 'point':
			return toTuple(value, (part) => {
				const n = Number(part);
				return part.trim() !== '' && Number.isFinite(n) ? n : part;
			});
		case 'duration':
			return encodeDuration(value);
		case 'file':
			return encodeFile(value);
		default:
			return value;
	}
}

function decodeBaseValue(baseType: string, value: unknown): unknown {
	if (value === null || value === undefined) return null;
	switch (baseType) {
		case 'pair':
		case 'directedPair':
		case 'point':
			// Bound as an array; the player holds the "A B" form.
			return Array.isArray(value) ? value.map((part) => String(part)).join(' ') : REJECTED;
		case 'duration':
			// Bound as an ISO 8601 duration string; the player holds seconds.
			return typeof value === 'string' && ISO_8601_DURATION.test(value.trim())
				? (parseDurationSeconds(value) ?? REJECTED)
				: REJECTED;
		case 'file':
			return decodeFile(value);
		default:
			return value;
	}
}

function valueOrNull(value: unknown): unknown {
	return value === REJECTED ? null : value;
}

/** A list's members as runtime values, or null when any member is outside the binding. */
function decodeList(baseType: string, items: readonly unknown[]): unknown[] | null {
	const values = items.map((item) => decodeBaseValue(baseType, item));
	return values.includes(REJECTED) ? null : values;
}

/** "A B" (or a two-element array) as a two-element array; anything else as given. */
function toTuple(value: unknown, member: (part: string) => unknown): unknown {
	if (Array.isArray(value)) return value.slice(0, 2).map((part) => member(String(part)));
	if (typeof value !== 'string') return value;
	const parts = value.trim().split(/\s+/).filter(Boolean);
	return parts.length === 2 ? parts.map(member) : value;
}

/** Seconds as an ISO 8601 duration (`PT90S`); an ISO 8601 literal is kept as written. */
function encodeDuration(value: unknown): unknown {
	if (typeof value === 'string' && ISO_8601_DURATION.test(value.trim())) return value.trim();
	const seconds = typeof value === 'number' ? value : typeof value === 'string' ? parseDurationSeconds(value) : null;
	if (seconds === null || !Number.isFinite(seconds)) return value;
	const magnitude = Math.abs(seconds).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
	return `${seconds < 0 ? '-' : ''}PT${magnitude}S`;
}

/** A `QTIFileResponse` (base64 data URL) as `{data, mime, name}`; other values as given. */
function encodeFile(value: unknown): unknown {
	if (!isPlainObject(value) || typeof value.data === 'string' || typeof value.dataUrl !== 'string') return value;
	const match = /^data:([^;,]*)((?:;[^;,]*)*),(.*)$/s.exec(value.dataUrl);
	if (!match || !/;base64$/i.test(match[2] ?? '')) return value;
	const mime = typeof value.type === 'string' && value.type ? value.type : match[1] || 'application/octet-stream';
	const name = typeof value.name === 'string' && value.name ? { name: value.name } : {};
	return { data: match[3] ?? '', mime, ...name };
}

/** `{data, mime, name}` as a `QTIFileResponse`; other values as given. */
function decodeFile(value: unknown): unknown {
	if (!isPlainObject(value) || typeof value.data !== 'string') return value;
	const type = typeof value.mime === 'string' && value.mime ? value.mime : 'application/octet-stream';
	return {
		name: typeof value.name === 'string' ? value.name : '',
		type,
		size: base64ByteLength(value.data),
		lastModified: 0,
		dataUrl: `data:${type};base64,${value.data}`,
	};
}

function base64ByteLength(base64: string): number {
	const clean = base64.replace(/\s+/g, '');
	const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
	return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

// ---------------------------------------------------------------------------
// Inference, for values whose declaration states no base type
// ---------------------------------------------------------------------------

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
			return isPlainObject(value) && typeof value.dataUrl === 'string' ? 'file' : undefined;
	}
}

/** A list's base type: integer only when every number is whole, else the first value's. */
function inferListBaseType(list: readonly unknown[]): BaseType | undefined {
	const present = list.filter((item) => item !== null && item !== undefined);
	if (present.length > 0 && present.every((item) => typeof item === 'number')) {
		return present.every((item) => Number.isInteger(item)) ? 'integer' : 'float';
	}
	return present.length > 0 ? inferBaseType(present[0]) : undefined;
}

function inferFieldBaseType(value: unknown): BaseType | undefined {
	return Array.isArray(value) ? inferListBaseType(value) : inferBaseType(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
