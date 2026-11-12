import { parseResponseNumber } from './normalize.js';
import type { BaseType, Cardinality, QtiValue } from './types.js';

export function qtiNull(baseType?: BaseType, cardinality?: Cardinality): QtiValue {
	return { kind: 'null', baseType, cardinality };
}

export function qtiInvalid(message: string, baseType?: BaseType, cardinality?: Cardinality): QtiValue {
	return { kind: 'invalid', message, baseType, cardinality };
}

export function qtiValue(baseType: BaseType | undefined, cardinality: Cardinality, value: unknown): QtiValue {
	return baseType === undefined
		? { kind: 'value', cardinality, value }
		: { kind: 'value', baseType, cardinality, value };
}

export function isNull(v: QtiValue): boolean {
	return v.kind === 'null';
}

/**
 * Whether QTI reads a value as NULL (ASI §5): no value at all, and also, as "empty containers and
 * empty strings are always treated as NULL values", an empty container or string. A response the
 * candidate cleared arrives as an empty container and reads as unanswered, like one never touched.
 */
export function isNullValue(v: QtiValue): boolean {
	if (v.kind === 'null') return true;
	if (v.kind !== 'value') return false;
	const raw = v.value;
	return raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0);
}

export function isInvalid(v: QtiValue): v is Extract<QtiValue, { kind: 'invalid' }> {
	return v.kind === 'invalid';
}

export function toBoolean(v: QtiValue): boolean {
	if (v.kind === 'invalid') return false;
	if (v.kind === 'null') return false;
	// QTI boolean-context coercion:
	// - containers (multiple/ordered): true iff non-empty
	// - numbers: true iff non-zero
	// - strings/identifiers/uris: true iff non-empty
	// - otherwise: JS truthiness of the stored value
	const raw = (v as any).value;
	if (v.cardinality === 'multiple' || v.cardinality === 'ordered') {
		return Array.isArray(raw) ? raw.length > 0 : Boolean(raw);
	}
	if (v.baseType === 'boolean') return Boolean(raw);
	if (v.baseType === 'integer' || v.baseType === 'float') return typeof raw === 'number' ? raw !== 0 : Number(raw) !== 0;
	if (
		v.baseType === 'string' ||
		v.baseType === 'identifier' ||
		v.baseType === 'uri' ||
		v.baseType === 'pair' ||
		v.baseType === 'directedPair' ||
		v.baseType === 'point' ||
		v.baseType === 'file'
	) {
		return String(raw) !== '';
	}
	if (v.baseType === 'duration') {
		return typeof raw === 'number' ? raw !== 0 : Boolean(raw);
	}
	return Boolean(raw);
}

export function toNumber(v: QtiValue): number {
	if (v.kind === 'invalid') return NaN;
	if (v.kind === 'null') return NaN;
	const raw = (v as any).value;
	if (typeof raw === 'number') return raw;
	if (v.kind === 'value' && v.baseType === 'duration' && typeof raw === 'string') {
		return parseDurationSeconds(raw) ?? NaN;
	}
	return Number(raw);
}

export function toStringValue(v: QtiValue): string {
	if (v.kind === 'invalid') return '';
	if (v.kind === 'null') return '';
	return String((v as any).value);
}

/** The xsd:double lexical space, without INF and NaN: neither is a usable duration. */
const DECIMAL_SECONDS = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * The seconds an item-XML duration literal denotes, or null when it is not one.
 *
 * QTI 2.x and 3.0 define a duration as "a single float that records time in seconds", bound to
 * xsd:double, so `30` and `2.5` are the whole lexical space (2.1 TimeLimits attributes, 2.2 and
 * 3.0 `NonNegativeDouble`). ISO 8601 literals such as `PT30S` are not XML durations; they are
 * the encoding of the PCI v1.0 Appendix A variable-JSON boundary, which parseDurationSeconds
 * reads.
 */
export function parseXmlDurationSeconds(text: string): number | null {
	const t = text.trim();
	if (!DECIMAL_SECONDS.test(t)) return null;
	const seconds = Number(t);
	return Number.isFinite(seconds) ? seconds : null;
}

/**
 * The seconds a QTI duration literal denotes, or null when it is not one: the xsd:double form
 * XML uses, plus the ISO 8601 / xsd:duration form (`PT30S`) that the PCI v1.0 Appendix A
 * variable-JSON binding encodes durations in. A year counts as 365 days and a month as 30.
 */
export function parseDurationSeconds(text: string): number | null {
	const t = text.trim();
	if (DECIMAL_SECONDS.test(t)) {
		const seconds = Number(t);
		return Number.isFinite(seconds) ? seconds : null;
	}
	return parseIsoDurationSeconds(t);
}

/**
 * The seconds of a runtime duration value: a number of seconds, or a duration literal. Null for
 * anything else, so a malformed duration can never compare as a number.
 */
export function durationSeconds(raw: unknown): number | null {
	if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
	if (typeof raw === 'string') return parseDurationSeconds(raw);
	return null;
}

/**
 * A QTI duration, in seconds, from elapsed milliseconds. QTI truncates durations rather than
 * rounding them, so the result is the elapsed time truncated to whole milliseconds; negative and
 * non-finite input reads as no time at all.
 */
export function durationSecondsFromMilliseconds(milliseconds: number): number {
	if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 0;
	return Math.floor(milliseconds) / 1000;
}

function parseIsoDurationSeconds(text: string): number | null {
	// xs:duration lexical space is ISO 8601 duration, e.g. "P3DT4H30M", "PT0.5S".
	// Years and months are variable-length in reality; we approximate:
	// - 1 year = 365 days
	// - 1 month = 30 days
	const m =
		/^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(text);
	if (!m) return null;
	// xs:duration needs at least one component, and a time component after its `T`.
	if (!m.slice(2).some((part) => part !== undefined)) return null;
	if (text.includes('T') && m[5] === undefined && m[6] === undefined && m[7] === undefined) return null;
	const sign = m[1] ? -1 : 1;
	const years = m[2] ? Number(m[2]) : 0;
	const months = m[3] ? Number(m[3]) : 0;
	const days = m[4] ? Number(m[4]) : 0;
	const hours = m[5] ? Number(m[5]) : 0;
	const minutes = m[6] ? Number(m[6]) : 0;
	const seconds = m[7] ? Number(m[7]) : 0;
	if (![years, months, days, hours, minutes, seconds].every(Number.isFinite)) return null;
	const totalSeconds =
		(((years * 365 + months * 30 + days) * 24 + hours) * 60 + minutes) * 60 + seconds;
	return sign * totalSeconds;
}

/**
 * Reads a QTI value from its lexical form. `language`, the content language,
 * lets numbers be typed with any script's digits and that language's marks.
 */
export function coerceBaseValue(baseType: BaseType, text: string, language?: string): QtiValue {
	const t = text.trim();
	switch (baseType) {
		case 'boolean':
			// xs:boolean allows true|false|1|0
			if (t === 'true' || t === '1') return qtiValue('boolean', 'single', true);
			if (t === 'false' || t === '0') return qtiValue('boolean', 'single', false);
			return qtiInvalid(`invalid boolean: ${t}`, 'boolean', 'single');
		case 'integer':
		case 'float': {
			const n = parseResponseNumber(t, language);
			if (!Number.isFinite(n)) return qtiInvalid(`invalid number: ${t}`, baseType, 'single');
			if (baseType === 'integer') return qtiValue('integer', 'single', Math.trunc(n));
			return qtiValue('float', 'single', n);
		}
		case 'pair': {
			// Lexical form: "A B" (unordered)
			const parts = t.split(/\s+/).filter(Boolean);
			if (parts.length < 2) return qtiValue('pair', 'single', t);
			const [a, b] = [parts[0]!, parts[1]!].sort();
			return qtiValue('pair', 'single', `${a} ${b}`);
		}
		case 'directedPair': {
			// Lexical form: "A B" (ordered)
			const parts = t.split(/\s+/).filter(Boolean);
			if (parts.length < 2) return qtiValue('directedPair', 'single', t);
			const a = parts[0]!;
			const b = parts[1]!;
			return qtiValue('directedPair', 'single', `${a} ${b}`);
		}
		case 'point': {
			// Lexical form: "x y"
			const parts = t.split(/\s+/).filter(Boolean);
			if (parts.length < 2) return qtiValue('point', 'single', t);
			return qtiValue('point', 'single', `${parts[0]} ${parts[1]}`);
		}
		case 'duration': {
			// Item XML binds duration to xsd:double seconds; ISO 8601 literals are not XML durations.
			const seconds = parseXmlDurationSeconds(t);
			if (seconds === null) return qtiInvalid(`invalid duration: ${t}`, 'duration', 'single');
			// QTI durations are seconds; stored as a number so comparisons work on the value.
			return qtiValue('duration', 'single', seconds);
		}
		case 'file':
			// Minimal representation for now: a string reference (e.g. file name, URI, etc).
			return qtiValue('file', 'single', t);
		case 'identifier':
		case 'string':
		case 'uri':
		default:
			return qtiValue(baseType, 'single', t);
	}
}

export function normalizeForCompare(v: unknown): string {
	// Used for multiset comparisons (multiple cardinality). Keep simple and deterministic.
	if (v === null || v === undefined) return '';
	if (typeof v === 'string') return v;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	try {
		const s = JSON.stringify(v);
		return s === undefined ? String(v) : s;
	} catch {
		return String(v);
	}
}

