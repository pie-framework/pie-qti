import type { BaseType, Cardinality, QtiValue } from './types.js';

export function qtiNull(baseType?: BaseType, cardinality?: Cardinality): QtiValue {
	return { kind: 'null', baseType, cardinality };
}

export function qtiInvalid(message: string, baseType?: BaseType, cardinality?: Cardinality): QtiValue {
	return { kind: 'invalid', message, baseType, cardinality };
}

export function qtiValue(baseType: BaseType, cardinality: Cardinality, value: unknown): QtiValue {
	return { kind: 'value', baseType, cardinality, value };
}

export function isNull(v: QtiValue): boolean {
	return v.kind === 'null';
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
		const ms = parseXsdDurationToMilliseconds(raw);
		return ms === null ? NaN : ms;
	}
	return Number(raw);
}

export function toStringValue(v: QtiValue): string {
	if (v.kind === 'invalid') return '';
	if (v.kind === 'null') return '';
	return String((v as any).value);
}

function parseXsdDurationToMilliseconds(text: string): number | null {
	// xs:duration lexical space is ISO 8601 duration, e.g. "P3DT4H30M", "PT0.5S"
	// NOTE: years/months are variable-length in reality; we approximate:
	// - 1 year = 365 days
	// - 1 month = 30 days
	const t = text.trim();
	const m =
		/^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(t);
	if (!m) return null;
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
	return sign * totalSeconds * 1000;
}

export function coerceBaseValue(baseType: BaseType, text: string): QtiValue {
	const t = text.trim();
	switch (baseType) {
		case 'boolean':
			// xs:boolean allows true|false|1|0
			if (t === 'true' || t === '1') return qtiValue('boolean', 'single', true);
			if (t === 'false' || t === '0') return qtiValue('boolean', 'single', false);
			return qtiInvalid(`invalid boolean: ${t}`, 'boolean', 'single');
		case 'integer':
		case 'float': {
			const n = Number(t);
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
			const ms = parseXsdDurationToMilliseconds(t);
			if (ms === null) return qtiInvalid(`invalid duration: ${t}`, 'duration', 'single');
			// Store milliseconds as a number to make comparisons/lt/gt work naturally.
			return qtiValue('duration', 'single', ms);
		}
		case 'file':
			// Minimal representation for now: a string reference (e.g. file name, URI, etc).
			return qtiValue('file', 'single', t);
		case 'record': {
			// Records are typically constructed with <record/>; if provided as text, accept JSON.
			if (t.startsWith('{') && t.endsWith('}')) {
				try {
					return qtiValue('record', 'single', JSON.parse(t));
				} catch {
					return qtiInvalid(`invalid record json: ${t}`, 'record', 'single');
				}
			}
			return qtiValue('record', 'single', t);
		}
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


