import Decimal from 'decimal.js';
import type { ExpressionNode } from '../ast/types.js';
import type { DeclarationContext } from '../runtime/context.js';
import { normalizeResponse, type StringComparisonOptions } from '../runtime/normalize.js';
import { xsdPatternToRegExp } from '../runtime/xsd-pattern.js';
import type { BaseType, Cardinality, Declaration, LookupTableTable, Mapping, MappingEntry, QtiValue } from '../runtime/types.js';
import {
	coerceBaseValue,
	durationSeconds,
	isNullValue,
	normalizeForCompare,
	qtiInvalid,
	qtiNull,
	qtiValue,
	toBoolean,
	toNumber,
	toStringValue,
} from '../runtime/value.js';
import type { TestEvalContext, TestItemState } from '../test/types.js';
import type { OperatorRegistry } from './operators.js';

export interface EvalEnv {
	ctx: DeclarationContext;
	ops: OperatorRegistry;
	rng: () => number;
	/**
	 * BCP 47 tag of the item's content language. Number parsing reads responses in it (its
	 * digits and decimal marks), and case-insensitive string comparisons use its case fold.
	 */
	language?: string;
	/**
	 * How `string` values compare in match, member, contains, delete, stringMatch and mapping
	 * lookup: exactly, up to Unicode canonical equivalence, unless the host opts in to a fold
	 * (`StringComparisonOptions`). A delivery option; QTI's own comparison is the default.
	 */
	stringComparison?: StringComparisonOptions;
	/**
	 * Optional test-level context. Required to evaluate test-only expressions like:
	 * - testVariables / outcomeMinimum / outcomeMaximum
	 * - numberCorrect/Incorrect/Presented/Responded/Selected
	 */
	test?: TestEvalContext;
	/**
	 * Optional registry for executing QTI <customOperator> expressions.
	 * Keyed by operator `class` (preferred) or `definition` URI.
	 */
	customOperators?: Record<
		string,
		(args: QtiValue[], meta: { class?: string; definition?: string }) => QtiValue
	>;
}

/**
 * Point-in-shape geometry shared by the `inside` operator and area mappings (mapResponsePoint):
 * coords are comma- or space-separated numbers, every boundary test is inclusive, and a shape
 * with degenerate or malformed coords holds no point at all.
 */
const numsFromCoords = (coords: string): number[] =>
	(coords.match(/-?\d+(?:\.\d+)?/g) || []).map((s) => Number(s));

const parsePoint = (v: unknown): { x: number; y: number } | null => {
	if (typeof v !== 'string') return null;
	const parts = v.trim().split(/\s+/);
	if (parts.length < 2) return null;
	const x = Number(parts[0]);
	const y = Number(parts[1]);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x, y };
};

const inRect = (p: { x: number; y: number }, coords: string): boolean => {
	const [x1, y1, x2, y2] = numsFromCoords(coords);
	if (![x1, y1, x2, y2].every((n) => Number.isFinite(n))) return false;
	const minX = Math.min(x1, x2);
	const maxX = Math.max(x1, x2);
	const minY = Math.min(y1, y2);
	const maxY = Math.max(y1, y2);
	return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
};

const inCircle = (p: { x: number; y: number }, coords: string): boolean => {
	const [cx, cy, r] = numsFromCoords(coords);
	if (![cx, cy, r].every((n) => Number.isFinite(n))) return false;
	const dx = p.x - cx;
	const dy = p.y - cy;
	return dx * dx + dy * dy <= r * r;
};

const inEllipse = (p: { x: number; y: number }, coords: string): boolean => {
	const [cx, cy, rx, ry] = numsFromCoords(coords);
	if (![cx, cy, rx, ry].every((n) => Number.isFinite(n))) return false;
	if (rx === 0 || ry === 0) return false;
	const dx = (p.x - cx) / rx;
	const dy = (p.y - cy) / ry;
	return dx * dx + dy * dy <= 1;
};

// Ray casting algorithm for point in polygon
const inPoly = (p: { x: number; y: number }, coords: string): boolean => {
	const ns = numsFromCoords(coords);
	if (ns.length < 6 || ns.length % 2 !== 0) return false;
	let inside = false;
	for (let i = 0, j = ns.length - 2; i < ns.length; j = i, i += 2) {
		const xi = ns[i]!;
		const yi = ns[i + 1]!;
		const xj = ns[j]!;
		const yj = ns[j + 1]!;
		const intersects = (yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
};

/**
 * QTI lookupOutcomeValue: a matchTable maps an exact source value, an interpolationTable maps the
 * first entry, in document order, whose sourceValue the source exceeds (or equals, when the entry
 * includes its boundary). With no match the table's defaultValue applies, else NULL. Values take
 * the target outcome's base type; without one they read as float when numeric, string otherwise.
 */
export function applyLookupTable(source: QtiValue, table: LookupTableTable, baseType?: BaseType): QtiValue {
	const target = (text: string | undefined): QtiValue => {
		if (text === undefined) return qtiNull(baseType, 'single');
		if (baseType) return coerceBaseValue(baseType, text);
		const n = Number(text);
		return text.trim() !== '' && Number.isFinite(n) ? qtiValue('float', 'single', n) : qtiValue('string', 'single', text);
	};
	if (source.kind === 'invalid') return qtiInvalid('lookupTable invalid');
	if (source.kind !== 'value') return target(table.defaultValue);
	if (source.cardinality !== 'single' || Array.isArray(source.value)) return qtiInvalid('lookupTable expects single cardinality');

	if (table.kind === 'table.matchTable') {
		const numeric = source.baseType === 'integer' || source.baseType === 'float' || typeof source.value === 'number';
		const x = numeric ? toNumber(source) : normalizeForCompare(source.value);
		const entry = table.entries.find((e) => (numeric ? Number(e.sourceValue) === x : normalizeForCompare(e.sourceValue) === x));
		return target(entry?.targetValue ?? table.defaultValue);
	}

	if (source.baseType !== undefined && source.baseType !== 'integer' && source.baseType !== 'float') {
		return qtiInvalid('lookupTable interpolation expects numeric source');
	}
	const x = toNumber(source);
	if (!Number.isFinite(x)) return qtiInvalid('lookupTable interpolation invalid number');
	const entry = table.entries.find((e) => x > e.sourceValue || (e.includeBoundary !== false && x === e.sourceValue));
	return target(entry?.targetValue ?? table.defaultValue);
}

/**
 * How a string value and a mapping key compare: in the content language, with the host's string
 * comparison folds.
 */
interface StringKeyComparison {
	language: string | undefined;
	stringComparison: StringComparisonOptions | undefined;
}

/** The comparable form of a string value or mapping key (`normalizeResponse`). */
function comparableString(value: string, comparison: StringKeyComparison, ignoreCase = false): string {
	return normalizeResponse(value, { ...comparison.stringComparison, language: comparison.language, ignoreCase });
}

/**
 * The mapping entry for a response value. Each entry is matched as case sensitively as it says
 * (mapEntry caseSensitive, QTI ASI §5; QTI 3.0 §7.21.3), with the spec default of false (QTI 2.2
 * XSD: optional, default "false"; the 2.1 Best Practice: "The default is false"; QTI 3.0: "The
 * default value is false") — an entry matches case-insensitively unless it says "true". Only
 * string values fold: identifier and the other base types match exactly (QTI ASI §17). The lookup
 * is by the exact key — the player also stores a case-insensitive entry under its lower-case key —
 * and string keys also compare in their comparable form (NFC, plus the host's string comparison
 * folds), case folded only where the entry is not case sensitive. A case-sensitive entry is never
 * found by folding the response's case.
 */
function findMappingEntry(
	mapping: Mapping,
	key: string,
	baseType: BaseType | undefined,
	comparison: StringKeyComparison,
): MappingEntry | undefined {
	const exact = mapping.entries[key];
	if (exact || baseType !== 'string') return exact;
	const typed = comparableString(key, comparison);
	const typedFolded = comparableString(key, comparison, true);
	return Object.values(mapping.entries).find((entry) =>
		(entry.caseSensitive ?? 'false') !== 'true'
			? comparableString(entry.mapKey, comparison, true) === typedFolded
			: comparableString(entry.mapKey, comparison) === typed,
	);
}

/**
 * mapResponse over a declared value (QTI ASI §15.3; QTI 3.0 §6.9.47): "If a container
 * contains multiple instances of the same value then that value is counted once only", so {B,B,C}
 * maps to 1.5, not 2.5. Deduplication uses the same comparison the mapping lookup uses — pair
 * keys ignore member order, directedPair keys keep it, and the values a case-insensitive string
 * entry matches count once as the one value they are to it. A string value no entry matches is
 * the same value only as another that compares equal to it: case does not fold for it.
 *
 * QTI treats a container with no values as NULL, so a NULL container maps as the
 * empty container — its values sum to 0, which the mapping's bounds then clamp —
 * rather than to the defaultValue, which is for a value without a mapping entry. A
 * NULL single value has no mapping entry and takes the defaultValue.
 */
function mapMappedValue(
	decl: Declaration,
	mapping: Mapping,
	current: QtiValue,
	comparison: StringKeyComparison,
): number {
	const normalizeMappingKey = (k: string): string => {
		const raw = String(k ?? '').trim();
		if (decl.baseType === 'pair') {
			const parts = raw.split(/\s+/).filter(Boolean);
			if (parts.length === 2) return [...parts].sort().join(' ');
			return raw;
		}
		if (decl.baseType === 'directedPair') {
			const parts = raw.split(/\s+/).filter(Boolean);
			if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
			return raw;
		}
		return raw;
	};

	const mapOne = (key: string): number => {
		const entry = findMappingEntry(mapping, normalizeMappingKey(key), decl.baseType, comparison);
		return entry ? Number(entry.mappedValue) : Number(mapping.defaultValue ?? 0);
	};

	if (decl.cardinality !== 'multiple' && decl.cardinality !== 'ordered') {
		if (current.kind !== 'value') return Number(mapping.defaultValue ?? 0);
		return mapOne(String(current.value));
	}

	// §15.3 counts a repeated value once. String entries default to case-insensitive (the
	// mapEntry@caseSensitive spec default), so the values such an entry matches — {Paris, paris} —
	// count once: an entry that matches case-insensitively deduplicates by its case-folded key
	// (which also folds the lower-case alias the player stores beside it), a case-sensitive entry
	// by its comparable key, and a string value no entry matches by its comparable form, which
	// keeps its case: no entry asks for case to fold there.
	const entryDedupKey = (entry: MappingEntry): string => {
		if (decl.baseType !== 'string') return `entry:${entry.mapKey}`;
		const matchesInsensitively = (entry.caseSensitive ?? 'false') !== 'true';
		return `entry:${comparableString(entry.mapKey, comparison, matchesInsensitively)}`;
	};
	const arr = current.kind !== 'value' ? [] : Array.isArray(current.value) ? current.value : [current.value];
	const counted = new Set<string>();
	let raw = 0;
	for (const x of arr) {
		const key = normalizeMappingKey(String(x));
		const entry = findMappingEntry(mapping, key, decl.baseType, comparison);
		const dedupKey = entry
			? entryDedupKey(entry)
			: `value:${decl.baseType === 'string' ? comparableString(key, comparison) : key}`;
		if (counted.has(dedupKey)) continue;
		counted.add(dedupKey);
		raw += entry ? Number(entry.mappedValue) : Number(mapping.defaultValue ?? 0);
	}
	return raw;
}

/** The values of a multiple or ordered container; a single value reads as a container of that one value. */
function containerValues(v: Extract<QtiValue, { kind: 'value' }>): unknown[] {
	return Array.isArray(v.value) ? v.value : [v.value];
}

/**
 * The numbers a numeric operand contributes to `sum`, `product`, `max`, `min`, `gcd` and `lcm`,
 * which take single, multiple or ordered operands (QTI ASI §15.3): one for a single value, each
 * value of a container. NULL gives null, and so do an empty container and an empty string, which
 * QTI reads as NULL (ASI §5).
 */
function numericOperandValues(v: QtiValue): number[] | null {
	if (v.kind !== 'value' || isNullValue(v)) return null;
	if (v.cardinality === 'multiple' || v.cardinality === 'ordered') {
		return containerValues(v).map((value) => toNumber({ kind: 'value', baseType: v.baseType, cardinality: 'single', value }));
	}
	return [toNumber(v)];
}

/** The greatest common divisor of two integers; gcd(0, n) is |n| and gcd(0, 0) is 0. */
function greatestCommonDivisor(x: number, y: number): number {
	let a = Math.abs(x);
	let b = Math.abs(y);
	while (b !== 0) {
		const t = a % b;
		a = b;
		b = t;
	}
	return a;
}

export function evalExpr(env: EvalEnv, expr: ExpressionNode): QtiValue {
	const inferBaseType = (values: QtiValue[], fallback: BaseType = 'string'): BaseType => {
		for (const v of values) {
			if (v.kind === 'value' && v.baseType) return v.baseType;
		}
		return fallback;
	};

	const resolveNumberOrVarRef = (raw: string | undefined): number => {
		const s = (raw || '').trim();
		if (!s) return NaN;
		const n = Number(s);
		if (Number.isFinite(n)) return n;
		const v = env.ctx.getValue(s);
		return toNumber(v);
	};

	const resolveTwoNumbersOrVarRefs = (raws: string[] | undefined): [number, number] => {
		const items = (raws || []).map((s) => resolveNumberOrVarRef(s)).filter((n) => Number.isFinite(n));
		if (items.length === 1) return [items[0]!, items[0]!];
		if (items.length >= 2) return [items[0]!, items[1]!];
		return [NaN, NaN];
	};

	const roundDecimalPlaces = (x: number, places: number): number => {
		if (!Number.isFinite(x) || !Number.isFinite(places)) return NaN;
		const p = Math.max(0, Math.floor(places));
		// Use decimal.js to avoid common binary floating-point rounding surprises (e.g. 3.175).
		return new Decimal(String(x)).toDecimalPlaces(p, Decimal.ROUND_HALF_UP).toNumber();
	};

	const roundSignificantFigures = (x: number, figures: number): number => {
		if (!Number.isFinite(x) || !Number.isFinite(figures)) return NaN;
		const f = Math.max(1, Math.floor(figures));
		// Use decimal.js to avoid binary floating-point rounding surprises.
		return new Decimal(String(x)).toSignificantDigits(f, Decimal.ROUND_HALF_UP).toNumber();
	};

	// match, member, contains, delete and equal compare `string` values as "the same value" (QTI 3.0
	// §6.9.21): exactly, up to canonical equivalence, with the host's string comparison folds.
	const stringKeyComparison: StringKeyComparison = { language: env.language, stringComparison: env.stringComparison };

	const normalizeScalarForCompare = (v: unknown, baseType?: BaseType): string => {
		if ((baseType === 'pair' || baseType === 'directedPair') && typeof v === 'string') {
			// pair: unordered "A B" == "B A"; directedPair: ordered
			const parts = v.trim().split(/\s+/).filter(Boolean);
			if (parts.length >= 2) {
				const a = parts[0]!;
				const b = parts[1]!;
				if (baseType === 'pair') return [a, b].sort().join(' ');
				return `${a} ${b}`;
			}
		}
		if (baseType === 'string' && typeof v === 'string') return comparableString(v, stringKeyComparison);
		if (baseType === 'duration') {
			// One duration, however written: `30`, `30.0` and `PT30S` are the same 30 seconds.
			const seconds = durationSeconds(v);
			if (seconds !== null) return String(seconds);
		}
		return normalizeForCompare(v);
	};

	const qtiValuesMatch = (left: QtiValue, right: QtiValue): boolean => {
		if (left.kind === 'invalid' || right.kind === 'invalid') return false;
		if (left.kind === 'null' || right.kind === 'null') {
			return left.kind === 'null' && right.kind === 'null';
		}
		if (left.cardinality !== right.cardinality || left.baseType !== right.baseType) return false;

		if (left.cardinality === 'record') {
			const leftRecord = left.value as Record<string, QtiValue>;
			const rightRecord = right.value as Record<string, QtiValue>;
			const leftFields = Object.keys(leftRecord).sort();
			const rightFields = Object.keys(rightRecord).sort();
			if (leftFields.length !== rightFields.length) return false;
			return leftFields.every((fieldIdentifier, index) => {
				if (fieldIdentifier !== rightFields[index]) return false;
				return qtiValuesMatch(leftRecord[fieldIdentifier]!, rightRecord[fieldIdentifier]!);
			});
		}

		const leftValue = left.value;
		const rightValue = right.value;
		if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
			if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) return false;
			if (leftValue.length !== rightValue.length) return false;
			if (left.cardinality === 'multiple') {
				const counts = new Map<string, number>();
				for (const value of rightValue) {
					const key = normalizeScalarForCompare(value, right.baseType);
					counts.set(key, (counts.get(key) ?? 0) + 1);
				}
				for (const value of leftValue) {
					const key = normalizeScalarForCompare(value, left.baseType);
					const count = counts.get(key) ?? 0;
					if (count === 0) return false;
					counts.set(key, count - 1);
				}
				return true;
			}
			return leftValue.every(
				(value, index) =>
					normalizeScalarForCompare(value, left.baseType) ===
					normalizeScalarForCompare(rightValue[index], right.baseType),
			);
		}

		return (
			normalizeScalarForCompare(leftValue, left.baseType) ===
			normalizeScalarForCompare(rightValue, right.baseType)
		);
	};

	const asBaseType = (raw: string | undefined): BaseType | undefined => {
		const s = (raw || '').trim() as BaseType;
		const allowed: BaseType[] = [
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
		];
		return allowed.includes(s) ? s : undefined;
	};

	const filterTestItems = (filter: { sectionIdentifier?: string; includeCategory?: string[]; excludeCategory?: string[] }) => {
		const items = env.test?.items;
		if (!items) return null;

		const sectionId = (filter.sectionIdentifier || '').trim();
		const include = (filter.includeCategory || []).filter(Boolean);
		const exclude = (filter.excludeCategory || []).filter(Boolean);

		return items.filter((it) => {
			if (sectionId) {
				const path = it.sectionIdentifiers || [];
				if (!path.includes(sectionId)) return false;
			}
			const cats = new Set((it.categories || []).filter(Boolean));
			if (include.length > 0 && !include.some((c) => cats.has(c))) return false;
			if (exclude.length > 0 && exclude.some((c) => cats.has(c))) return false;
			return true;
		});
	};

	const resolveWeight = (it: { weights?: Record<string, number> }, weightIdentifier?: string): number => {
		const key = (weightIdentifier || '').trim();
		if (!key) return 1;
		const n = it.weights?.[key];
		return typeof n === 'number' && Number.isFinite(n) ? n : 1;
	};

	/**
	 * A test-scope variable's weight (QTI ASI §15.1): weights exist "only when the item identifier
	 * prefixing technique is being used", so the item is the assessmentItemRef whose identifier
	 * prefixes the variable as ITEMREF.VARIABLE — the longest such identifier, since identifiers
	 * may themselves contain a period. Its weight resolves as testVariables resolves one, 1.0 when
	 * the itemRef defines none. Undefined when the variable is not an item variable.
	 */
	const itemRefWeight = (identifier: string, weightIdentifier: string): number | undefined => {
		let itemRef: TestItemState | undefined;
		for (const it of env.test?.items ?? []) {
			if (!identifier.startsWith(`${it.identifier}.`)) continue;
			if (!itemRef || it.identifier.length > itemRef.identifier.length) itemRef = it;
		}
		return itemRef ? resolveWeight(itemRef, weightIdentifier) : undefined;
	};

	/**
	 * Weights apply only to integer and float values and are treated as float, so a weighted value
	 * is float; a multiple/ordered value has the weight applied to each contained value. Any other
	 * base type ignores the weight.
	 */
	const applyWeight = (value: QtiValue, weight: number): QtiValue => {
		if (value.kind === 'invalid') return value;
		if (value.baseType !== 'integer' && value.baseType !== 'float') return value;
		const cardinality = value.cardinality ?? 'single';
		if (cardinality === 'record') return value;
		if (value.kind === 'null') return qtiNull('float', cardinality);
		if (cardinality === 'single') return qtiValue('float', 'single', toNumber(value) * weight);
		const values = Array.isArray(value.value) ? value.value : [value.value];
		return qtiValue('float', cardinality, values.map((n) => Number(n) * weight));
	};

	switch (expr.kind) {
		case 'expr.baseValue':
			return coerceBaseValue(expr.baseType as any, expr.text, env.language);
		case 'expr.null':
			return qtiNull();
		case 'expr.variable': {
			const value = env.ctx.getValue(expr.identifier);
			if (!expr.weightIdentifier) return value;
			const weight = itemRefWeight(expr.identifier, expr.weightIdentifier);
			return weight === undefined ? value : applyWeight(value, weight);
		}
		case 'expr.correct':
			return env.ctx.getCorrectResponse(expr.identifier);
		case 'expr.default':
			return env.ctx.getDefaultValue(expr.identifier);
		case 'expr.testVariables': {
			const items = filterTestItems(expr);
			if (!items) return qtiInvalid('testVariables requires env.test');

			// An omitted baseType matches integer and float variables; the result is integer when every
			// match is. Weights apply only to float or omitted baseType, and make the result float.
			const wanted = asBaseType(expr.baseType);
			const weighted = Boolean(expr.weightIdentifier) && (wanted === undefined || wanted === 'float');
			const out: unknown[] = [];
			let allInteger = true;

			for (const it of items) {
				const v = it.variables?.[expr.variableIdentifier];
				// Only variables with single cardinality are considered, all NULL values are ignored.
				if (!v || v.kind !== 'value' || v.cardinality !== 'single') continue;
				if (v.value === null || v.value === undefined) continue;
				const declared = v.baseType ?? (typeof v.value === 'number' ? 'float' : undefined);
				if (wanted ? declared !== wanted : declared !== 'integer' && declared !== 'float') continue;
				if (declared !== 'integer') allInteger = false;

				if (weighted) {
					const n = toNumber(v);
					if (Number.isFinite(n)) out.push(n * resolveWeight(it, expr.weightIdentifier));
				} else if (declared === 'integer' || declared === 'float') {
					const n = toNumber(v);
					if (Number.isFinite(n)) out.push(n);
				} else {
					out.push(v.value);
				}
			}

			const baseType = wanted ?? (allInteger && !weighted ? 'integer' : 'float');
			return out.length > 0 ? qtiValue(baseType, 'multiple', out) : qtiNull(baseType, 'multiple');
		}
		case 'expr.outcomeMinimum':
		case 'expr.outcomeMaximum': {
			const items = filterTestItems(expr);
			if (!items) return qtiInvalid(`${expr.kind} requires env.test`);

			// The declared normalMinimum/normalMaximum of each item's outcome. Items with no declared
			// minimum are ignored; an item with no declared maximum makes the result NULL.
			const isMinimum = expr.kind === 'expr.outcomeMinimum';
			const values: number[] = [];
			for (const it of items) {
				const v = it.variables?.[expr.outcomeIdentifier];
				if (v?.cardinality !== undefined && v.cardinality !== 'single') continue;
				const bounds = it.outcomeBounds?.[expr.outcomeIdentifier];
				const n = isMinimum ? bounds?.normalMinimum : bounds?.normalMaximum;
				if (typeof n !== 'number' || !Number.isFinite(n)) {
					if (isMinimum) continue;
					return qtiNull('float', 'multiple');
				}
				values.push(n * resolveWeight(it, expr.weightIdentifier));
			}
			return values.length > 0 ? qtiValue('float', 'multiple', values) : qtiNull('float', 'multiple');
		}
		case 'expr.numberCorrect':
		case 'expr.numberIncorrect':
		case 'expr.numberPresented':
		case 'expr.numberResponded':
		case 'expr.numberSelected': {
			const items = filterTestItems(expr);
			if (!items) return qtiInvalid(`${expr.kind} requires env.test`);

			const inferCorrectness = (it: any): { correct: boolean; incorrect: boolean } => {
				// Prefer explicit flags if present.
				if (typeof it.correct === 'boolean' || typeof it.incorrect === 'boolean') {
					return { correct: it.correct === true, incorrect: it.incorrect === true };
				}
				// Fallback heuristic: correct iff SCORE == MAXSCORE and MAXSCORE > 0.
				const score = it.variables?.SCORE;
				const max = it.variables?.MAXSCORE;
				if (score?.kind === 'value' && max?.kind === 'value') {
					const s = toNumber(score);
					const m = toNumber(max);
					if (Number.isFinite(s) && Number.isFinite(m) && m > 0) {
						return { correct: s === m, incorrect: s !== m };
					}
				}
				return { correct: false, incorrect: false };
			};

			let count = 0;
			for (const it of items as any[]) {
				switch (expr.kind) {
					case 'expr.numberPresented':
						if (it.presented !== false) count++;
						break;
					case 'expr.numberResponded':
						if (it.responded === true) count++;
						break;
					case 'expr.numberSelected':
						if (it.selected === true) count++;
						break;
					case 'expr.numberCorrect': {
						const { correct } = inferCorrectness(it);
						if (correct) count++;
						break;
					}
					case 'expr.numberIncorrect': {
						const { incorrect } = inferCorrectness(it);
						if (incorrect) count++;
						break;
					}
				}
			}
			return qtiValue('integer', 'single', count);
		}
		case 'expr.customOperator': {
			// Extension hook. If there's no registered handler, return NULL (safe default).
			const values = expr.values.map((e) => evalExpr(env, e));
			if (values.some((v) => v.kind === 'null')) return qtiNull();

			const key = (expr.class || expr.definition || '').trim();
			const fn = key ? env.customOperators?.[key] : undefined;
			if (!fn) return qtiNull();

			try {
				return fn(values, { class: expr.class, definition: expr.definition });
			} catch {
				return qtiNull();
			}
		}
		case 'expr.isNull': {
			const v = evalExpr(env, expr.expr);
			return qtiValue('boolean', 'single', isNullValue(v));
		}
		case 'expr.match': {
			// QTI: "If either sub-expression is NULL then the operator results in NULL."
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('match invalid');
			if (isNullValue(a) || isNullValue(b)) return qtiNull('boolean', 'single');

			if (a.kind === 'value' && b.kind === 'value') {
				return qtiValue('boolean', 'single', qtiValuesMatch(a, b));
			}
			return qtiValue('boolean', 'single', false);
		}
		case 'expr.equal': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('equal invalid');
			// Spec-aligned null propagation: boolean comparisons yield NULL if any operand is NULL.
			if (isNullValue(a) || isNullValue(b)) return qtiNull('boolean', 'single');

			if (a.kind === 'value' && b.kind === 'value') {
				// QTI tolerance support (numeric only, single cardinality)
				if (
					expr.toleranceMode &&
					expr.toleranceMode !== 'exact' &&
					(a.baseType === 'integer' || a.baseType === 'float') &&
					(b.baseType === 'integer' || b.baseType === 'float') &&
					a.cardinality === 'single' &&
					b.cardinality === 'single' &&
					!Array.isArray(a.value) &&
					!Array.isArray(b.value)
				) {
					const x = toNumber(a);
					const y = toNumber(b);
					if (!Number.isFinite(x) || !Number.isFinite(y)) return qtiInvalid('equal tolerance invalid number');

					const [t0, t1] = resolveTwoNumbersOrVarRefs(expr.tolerance);
					if (!Number.isFinite(t0) || !Number.isFinite(t1) || t0 < 0 || t1 < 0) {
						return qtiInvalid('equal tolerance invalid tolerance');
					}

					const includeLower = expr.includeLowerBound ?? true;
					const includeUpper = expr.includeUpperBound ?? true;

					let lower: number;
					let upper: number;
					if (expr.toleranceMode === 'absolute') {
						lower = x - t0;
						upper = x + t1;
					} else {
						// relative: t0/t1 treated as percentages
						lower = x - (x * t0) / 100;
						upper = x + (x * t1) / 100;
					}

					const okLower = includeLower ? y >= lower : y > lower;
					const okUpper = includeUpper ? y <= upper : y < upper;
					return qtiValue('boolean', 'single', okLower && okUpper);
				}

				const av = a.value;
				const bv = b.value;

				// Like match, but with normalization for scalar comparison.
				if (Array.isArray(av) && Array.isArray(bv)) {
					if (av.length !== bv.length) return qtiValue('boolean', 'single', false);
					if (a.cardinality === 'multiple' || b.cardinality === 'multiple') {
						const counts = new Map<string, number>();
						for (const v of bv) {
							const k = normalizeScalarForCompare(v, b.baseType);
							counts.set(k, (counts.get(k) || 0) + 1);
						}
						for (const v of av) {
							const k = normalizeScalarForCompare(v, a.baseType);
							const n = counts.get(k) || 0;
							if (n <= 0) return qtiValue('boolean', 'single', false);
							counts.set(k, n - 1);
						}
						return qtiValue('boolean', 'single', true);
					}
					for (let i = 0; i < av.length; i++) {
						if (normalizeScalarForCompare(av[i], a.baseType) !== normalizeScalarForCompare(bv[i], b.baseType)) {
							return qtiValue('boolean', 'single', false);
						}
					}
					return qtiValue('boolean', 'single', true);
				}

				return qtiValue(
					'boolean',
					'single',
					normalizeScalarForCompare(av, a.baseType) === normalizeScalarForCompare(bv, b.baseType)
				);
			}

			return qtiValue('boolean', 'single', false);
		}
		case 'expr.equalRounded': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('equalRounded invalid');
			// Spec-aligned null propagation.
			if (isNullValue(a) || isNullValue(b)) return qtiNull('boolean', 'single');
			if (a.kind !== 'value' || b.kind !== 'value') return qtiValue('boolean', 'single', false);
			if (Array.isArray(a.value) || Array.isArray(b.value)) return qtiValue('boolean', 'single', false);

			const x = toNumber(a);
			const y = toNumber(b);
			if (!Number.isFinite(x) || !Number.isFinite(y)) return qtiInvalid('equalRounded invalid number');

			// The builder admits only the XSD's two spellings (defaulting to significantFigures); an
			// AST built programmatically with anything else evaluates invalid rather than rounded.
			const mode =
				expr.roundingMode === 'decimalPlaces' || expr.roundingMode === 'significantFigures'
					? expr.roundingMode
					: undefined;
			if (!mode) return qtiInvalid(`equalRounded unsupported roundingMode: ${expr.roundingMode}`);

			const figs = resolveNumberOrVarRef(expr.figures);
			if (!Number.isFinite(figs)) return qtiInvalid('equalRounded figures invalid');

			const nFigs = Math.floor(figs);
			if (mode === 'significantFigures' && nFigs <= 0) return qtiInvalid('equalRounded figures must be > 0');
			if (mode === 'decimalPlaces' && nFigs < 0) return qtiInvalid('equalRounded figures must be >= 0');

			const rx = mode === 'significantFigures' ? roundSignificantFigures(x, nFigs) : roundDecimalPlaces(x, nFigs);
			const ry = mode === 'significantFigures' ? roundSignificantFigures(y, nFigs) : roundDecimalPlaces(y, nFigs);
			if (!Number.isFinite(rx) || !Number.isFinite(ry)) return qtiInvalid('equalRounded rounding invalid');

			return qtiValue('boolean', 'single', rx === ry);
		}
		case 'expr.member': {
			// QTI: "If either sub-expression is NULL then the result of the operator is NULL."
			const value = evalExpr(env, expr.value);
			const container = evalExpr(env, expr.container);
			if (value.kind === 'invalid' || container.kind === 'invalid') return qtiInvalid('member invalid');
			if (isNullValue(value) || isNullValue(container)) return qtiNull('boolean', 'single');
			if (value.kind !== 'value' || container.kind !== 'value') return qtiValue('boolean', 'single', false);

			const v = value.value;
			const c = container.value;
			if (!Array.isArray(c)) return qtiValue('boolean', 'single', false);
			const needle = normalizeScalarForCompare(v, container.baseType);
			return qtiValue('boolean', 'single', c.some((x) => normalizeScalarForCompare(x, container.baseType) === needle));
		}
		case 'expr.contains': {
			// QTI: true when the first container contains the second. Multiple containers compare as
			// multisets — [A,B,C] contains [C,A] but not [B,B], which [A,B,B,C] does — and for ordered
			// containers the second must be a strict (contiguous) sub-sequence of the first: [A,B,C]
			// contains [B,C] but not [C,A] or [A,C]. NULL when either is NULL. A single value reads as
			// a container of that one value, so `contains(RESPONSE, A)` asks whether A was chosen.
			const container = evalExpr(env, expr.container);
			const value = evalExpr(env, expr.value);
			if (value.kind === 'invalid' || container.kind === 'invalid') return qtiInvalid('contains invalid');
			if (isNullValue(value) || isNullValue(container)) return qtiNull('boolean', 'single');
			if (value.kind !== 'value' || container.kind !== 'value') return qtiNull('boolean', 'single');

			const isContainer = (v: QtiValue): boolean => v.cardinality === 'multiple' || v.cardinality === 'ordered';
			if (isContainer(container) && isContainer(value) && container.cardinality !== value.cardinality) {
				return qtiInvalid('contains expects two containers of the same cardinality', 'boolean', 'single');
			}
			const ordered = container.cardinality === 'ordered' || value.cardinality === 'ordered';
			const baseType = container.baseType ?? value.baseType;
			const keys = (v: Extract<QtiValue, { kind: 'value' }>): string[] =>
				containerValues(v).map((x) => normalizeScalarForCompare(x, baseType));
			const haystack = keys(container);
			const needle = keys(value);

			if (!ordered) {
				const available = new Map<string, number>();
				for (const key of haystack) available.set(key, (available.get(key) ?? 0) + 1);
				for (const key of needle) {
					const count = available.get(key) ?? 0;
					if (count === 0) return qtiValue('boolean', 'single', false);
					available.set(key, count - 1);
				}
				return qtiValue('boolean', 'single', true);
			}

			for (let start = 0; start + needle.length <= haystack.length; start++) {
				if (needle.every((key, offset) => haystack[start + offset] === key)) {
					return qtiValue('boolean', 'single', true);
				}
			}
			return qtiValue('boolean', 'single', false);
		}
		case 'expr.containerSize': {
			const container = evalExpr(env, expr.container);
			if (container.kind === 'invalid') return qtiInvalid('containerSize invalid');
			if (container.kind === 'null') return qtiValue('integer', 'single', 0);
			if (container.kind !== 'value') return qtiValue('integer', 'single', 0);
			return qtiValue(
				'integer',
				'single',
				Array.isArray(container.value) ? container.value.length : container.value === null || container.value === undefined ? 0 : 1
			);
		}
		case 'expr.index': {
			const container = evalExpr(env, expr.container);
			const index = evalExpr(env, expr.index);
			if (container.kind === 'invalid' || index.kind === 'invalid') return qtiInvalid('index invalid');

			const outBaseType: BaseType =
				container.kind === 'value'
					? (container.baseType ?? 'string')
					: index.kind === 'value'
						? // index operand doesn't tell us the output type; fall back to string
							'string'
						: 'string';

			if (container.kind !== 'value') return qtiNull(outBaseType, 'single');
			if (!Array.isArray(container.value)) return qtiNull(container.baseType, 'single');

			// QTI uses 1-based indexing
			const idx = Math.floor(toNumber(index)) - 1;
			if (!Number.isFinite(idx) || idx < 0 || idx >= container.value.length) return qtiNull(container.baseType, 'single');
			return qtiValue(container.baseType, 'single', container.value[idx]);
		}
		case 'expr.ordered':
		case 'expr.multiple': {
			// QTI: "All sub-expressions with NULL values are ignored. If no sub-expressions are given
			// (or all are NULL) then the result is NULL." A container sub-expression adds its values.
			const values = expr.values.map((v) => evalExpr(env, v));
			if (values.some((v) => v.kind === 'invalid')) return qtiInvalid(`${expr.kind} invalid`);
			const cardinality: Cardinality = expr.kind === 'expr.ordered' ? 'ordered' : 'multiple';
			const out: unknown[] = [];
			for (const v of values) {
				if (v.kind !== 'value' || isNullValue(v)) continue;
				for (const item of containerValues(v)) {
					if (item !== null && item !== undefined) out.push(item);
				}
			}
			if (out.length === 0) return qtiNull(values.find((v) => v.baseType)?.baseType, cardinality);
			return qtiValue(inferBaseType(values), cardinality, out);
		}
		case 'expr.delete': {
			// QTI: the first sub-expression is the single value to remove, the second the multiple or
			// ordered container: delete(A, {B,A,C,A}) is {B,C}. NULL when either is NULL; removing every
			// value leaves the empty container, which is NULL.
			const value = evalExpr(env, expr.value);
			const container = evalExpr(env, expr.container);
			if (container.kind === 'invalid' || value.kind === 'invalid') return qtiInvalid('delete invalid');

			const baseType: BaseType | undefined = container.baseType ?? value.baseType;
			if (isNullValue(container) || isNullValue(value) || container.kind !== 'value' || value.kind !== 'value') {
				return qtiNull(baseType, container.cardinality ?? 'multiple');
			}

			const removed = new Set(containerValues(value).map((x) => normalizeScalarForCompare(x, baseType)));
			const remove = (x: unknown): boolean => removed.has(normalizeScalarForCompare(x, baseType));

			if (!Array.isArray(container.value)) {
				// A single value: removing it leaves nothing, otherwise it is unchanged.
				return remove(container.value) ? qtiNull(baseType, 'single') : qtiValue(baseType, 'single', container.value);
			}

			const kept = container.value.filter((item) => !remove(item));
			return kept.length === 0 ? qtiNull(baseType, container.cardinality) : qtiValue(baseType, container.cardinality, kept);
		}
		case 'expr.repeat': {
			// Spec (Repeat.Type): numberRepeats attribute (xs:int or variable identifier)
			let countRaw: number | undefined;
			if (typeof expr.numberRepeats === 'number') {
				countRaw = expr.numberRepeats;
			} else {
				const decl = env.ctx.getDeclaration(expr.numberRepeats);
				const v = decl?.value;
				if (!v || v.kind === 'null' || v.kind === 'invalid') return qtiNull();
				countRaw = Math.trunc(toNumber(v));
			}

			if (countRaw === undefined || !Number.isFinite(countRaw) || countRaw < 1) return qtiNull();
			const count = countRaw;

			let outBaseType: BaseType = 'string';
			const out: unknown[] = [];
			let pushed = false;

			const pushFrom = (v: QtiValue): void => {
				if (v.kind === 'null') return;
				if (v.kind === 'invalid') {
					// propagate invalid
					throw new Error('repeat invalid');
				}
				outBaseType = v.baseType ?? 'string';
				if (Array.isArray(v.value)) {
					for (const item of v.value) {
						if (item === null || item === undefined) continue;
						out.push(item);
						pushed = true;
					}
					return;
				}
				if (v.value === null || v.value === undefined) return;
				out.push(v.value);
				pushed = true;
			};

			try {
				for (let i = 0; i < count; i++) {
					for (const sub of expr.values) {
						const v = evalExpr(env, sub);
						pushFrom(v);
					}
				}
			} catch (e) {
				if (e instanceof Error && e.message === 'repeat invalid') return qtiInvalid('repeat invalid');
				throw e;
			}

			if (!pushed) return qtiNull(outBaseType, 'ordered');
			return qtiValue(outBaseType, 'ordered', out);
		}
		case 'expr.durationLT':
		case 'expr.durationGTE': {
			// QTI 2.2/3.0: both operands are single durations, in seconds; NULL operands give NULL.
			// Both go through the runtime's duration reading — item XML coerces duration literals to
			// seconds numbers, and a runtime value still holding a literal (a restored session, say)
			// reads through the same parser — and a malformed duration is invalid rather than a NaN
			// comparison that reads as false.
			const name = expr.kind === 'expr.durationLT' ? 'durationLT' : 'durationGTE';
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid(`${name} invalid`, 'boolean', 'single');
			if (isNullValue(a) || isNullValue(b) || a.kind !== 'value' || b.kind !== 'value') {
				return qtiNull('boolean', 'single');
			}
			if (a.baseType !== 'duration' || b.baseType !== 'duration') {
				return qtiInvalid(`${name} expects duration operands`, 'boolean', 'single');
			}
			if (a.cardinality !== 'single' || b.cardinality !== 'single') {
				return qtiInvalid(`${name} expects single cardinality`, 'boolean', 'single');
			}
			const x = durationSeconds(a.value);
			const y = durationSeconds(b.value);
			if (x === null || y === null) return qtiInvalid(`${name} operand is not a valid duration`, 'boolean', 'single');
			return qtiValue('boolean', 'single', expr.kind === 'expr.durationLT' ? x < y : x >= y);
		}
		case 'expr.inside': {
			const value = evalExpr(env, expr.value);
			if (value.kind === 'invalid') return qtiInvalid('inside invalid');
			if (isNullValue(value)) return qtiNull('boolean', 'single');
			if (value.kind !== 'value') return qtiInvalid('inside expects a value');
			if (value.baseType !== 'point') return qtiInvalid('inside expects point baseType');

			const points = Array.isArray(value.value) ? value.value : [value.value];

			for (const raw of points) {
				if (raw === null || raw === undefined) return qtiNull('boolean', 'single');
				const p = parsePoint(raw);
				if (!p) continue;

				let ok = false;
				switch (expr.shape) {
					case 'default':
						ok = true;
						break;
					case 'rect':
						ok = inRect(p, expr.coords);
						break;
					case 'circle':
						ok = inCircle(p, expr.coords);
						break;
					case 'ellipse':
						ok = inEllipse(p, expr.coords);
						break;
					case 'poly':
						ok = inPoly(p, expr.coords);
						break;
					default:
						ok = false;
						break;
				}
				if (ok) return qtiValue('boolean', 'single', true);
			}

			return qtiValue('boolean', 'single', false);
		}
		case 'expr.statsOperator': {
			const values = evalExpr(env, expr.values);
			if (values.kind === 'invalid') return qtiInvalid('statsOperator invalid');
			if (values.kind === 'null') return qtiNull('float', 'single');
			if (values.kind !== 'value') return qtiNull('float', 'single');

			const arr = Array.isArray(values.value) ? values.value : [values.value];
			if (arr.length === 0) return qtiNull('float', 'single');
			if (arr.some((x) => x === null || x === undefined)) return qtiNull('float', 'single');

			const nums = arr.map((x) => Number(x));
			if (nums.some((n) => !Number.isFinite(n))) return qtiNull('float', 'single');

			const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
			if (expr.name === 'mean') return qtiValue('float', 'single', mean);

			const squared = nums.map((n) => (n - mean) * (n - mean)).reduce((a, b) => a + b, 0);
			const denom = expr.name === 'sampleVariance' || expr.name === 'sampleSD' ? nums.length - 1 : nums.length;
			if (denom <= 0) return qtiNull('float', 'single');
			const variance = squared / denom;

			if (expr.name === 'sampleVariance' || expr.name === 'popVariance') return qtiValue('float', 'single', variance);
			return qtiValue('float', 'single', Math.sqrt(variance));
		}
		case 'expr.fieldValue': {
			const rec = evalExpr(env, expr.record);
			if (rec.kind !== 'value' || rec.cardinality !== 'record') return qtiNull();
			const obj = rec.value as Record<string, QtiValue> | undefined;
			return obj?.[expr.fieldIdentifier] ?? qtiNull();
		}
		case 'expr.substring': {
			const value = evalExpr(env, expr.value);
			const start = evalExpr(env, expr.start);
			const length = expr.length ? evalExpr(env, expr.length) : undefined;
			if (value.kind === 'invalid' || start.kind === 'invalid' || length?.kind === 'invalid') return qtiInvalid('substring invalid');
			// A NULL operand gives NULL (QTI ASI §15.3), the empty string included (§5); a start
			// past the end still gives the empty string.
			if (isNullValue(value) || isNullValue(start) || (length !== undefined && isNullValue(length))) {
				return qtiNull('string', 'single');
			}

			const s = toStringValue(value);

			// QTI indexing is 1-based
			const startIdx = Math.max(0, Math.floor(toNumber(start)) - 1);
			if (!Number.isFinite(startIdx)) return qtiInvalid('substring start invalid');

			if (!length) return qtiValue('string', 'single', s.substring(startIdx));
			const len = Math.max(0, Math.floor(toNumber(length)));
			if (!Number.isFinite(len)) return qtiInvalid('substring length invalid');
			return qtiValue('string', 'single', s.substring(startIdx, startIdx + len));
		}
		case 'expr.random': {
			const v = evalExpr(env, expr.value);
			if (v.kind !== 'value') return v;
			if (!Array.isArray(v.value)) return v;
			if (v.value.length === 0) return qtiNull(v.baseType, 'single');
			const idx = Math.min(v.value.length - 1, Math.floor(env.rng() * v.value.length));
			return qtiValue(v.baseType, 'single', (v.value as any[])[idx]);
		}
		case 'expr.power':
		case 'expr.integerDivide': {
			// QTI ASI §15.3: a NULL operand gives NULL. power "shall result in NULL" outside the float
			// value set; integerDivide is NULL for a zero divisor, and dividing the operands as they
			// are (no truncation of either), rounds x/y down to the greatest integer not above it
			// (-7/2 is -4, which integerModulus's x - z*y agrees with).
			const name = expr.kind.slice('expr.'.length);
			const resultBaseType: BaseType = expr.kind === 'expr.integerDivide' ? 'integer' : 'float';
			const aV = evalExpr(env, expr.a);
			const bV = evalExpr(env, expr.b);
			if (aV.kind === 'invalid' || bV.kind === 'invalid') return qtiInvalid(`${name} operand invalid`, resultBaseType, 'single');
			if (isNullValue(aV) || isNullValue(bV)) return qtiNull(resultBaseType, 'single');
			const a = toNumber(aV);
			const b = toNumber(bV);
			if (!Number.isFinite(a) || !Number.isFinite(b)) {
				return qtiInvalid(`${name} operand is not a finite number`, resultBaseType, 'single');
			}
			let result: number;
			if (expr.kind === 'expr.power') result = a ** b;
			else if (b === 0) result = Number.NaN;
			else result = Math.floor(a / b);
			if (!Number.isFinite(result)) return qtiNull(resultBaseType, 'single');
			// No negative zero: -4 mod 2 and 0 integerDivide -5 are 0.
			return qtiValue(resultBaseType, 'single', result === 0 ? 0 : result);
		}
		case 'expr.stringMatch': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('stringMatch invalid');
			if (isNullValue(a) || isNullValue(b)) return qtiNull('boolean', 'single');

			// stringMatch compares "according to the comparison rules" its attributes give (QTI 3.0
			// §6.9.48): case folds when case-sensitive is false (§5.138.1), the rest as every string
			// comparison does.
			const left = comparableString(toStringValue(a), stringKeyComparison, !expr.caseSensitive);
			const right = comparableString(toStringValue(b), stringKeyComparison, !expr.caseSensitive);

			if (expr.substring) return qtiValue('boolean', 'single', left.includes(right));
			return qtiValue('boolean', 'single', left === right);
		}
		case 'expr.patternMatch': {
			const value = evalExpr(env, expr.value);
			const pattern = evalExpr(env, expr.pattern);
			if (value.kind === 'invalid' || pattern.kind === 'invalid') return qtiInvalid('patternMatch invalid');
			if (isNullValue(value) || isNullValue(pattern)) return qtiNull('boolean', 'single');

			// The author's regular expression tests the string as entered (QTI 3.0 §6.9.45): no string
			// comparison fold applies, whatever the host set.
			const sv = toStringValue(value);
			const sp = toStringValue(pattern);

			const re = xsdPatternToRegExp(sp, expr.caseSensitive ? '' : 'i');
			return qtiValue('boolean', 'single', re?.test(sv) ?? false);
		}
		case 'expr.lt':
		case 'expr.lte':
		case 'expr.gt':
		case 'expr.gte': {
			// QTI: "If either sub-expression is NULL then the operator results in NULL."
			const name = expr.kind.slice('expr.'.length);
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid(`${name} invalid`, 'boolean', 'single');
			if (isNullValue(a) || isNullValue(b)) return qtiNull('boolean', 'single');
			const x = toNumber(a);
			const y = toNumber(b);
			if (Number.isNaN(x) || Number.isNaN(y)) return qtiInvalid(`${name} expects numeric operands`, 'boolean', 'single');
			const result =
				expr.kind === 'expr.lt' ? x < y : expr.kind === 'expr.lte' ? x <= y : expr.kind === 'expr.gt' ? x > y : x >= y;
			return qtiValue('boolean', 'single', result);
		}
		case 'expr.and': {
			// Three-valued: false if any sub-expression is false; otherwise NULL if any is NULL ("and
			// all others are true"); true when all are true. An invalid one is not a truth value either.
			let unknown: QtiValue | undefined;
			for (const op of expr.ops) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') unknown = qtiInvalid('and operand invalid', 'boolean', 'single');
				else if (isNullValue(v)) unknown ??= qtiNull('boolean', 'single');
				else if (!toBoolean(v)) return qtiValue('boolean', 'single', false);
			}
			return unknown ?? qtiValue('boolean', 'single', true);
		}
		case 'expr.or': {
			// Three-valued: true if any sub-expression is true; otherwise NULL if any is NULL ("and all
			// the others are false"); false when all are false.
			let unknown: QtiValue | undefined;
			for (const op of expr.ops) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') unknown = qtiInvalid('or operand invalid', 'boolean', 'single');
				else if (isNullValue(v)) unknown ??= qtiNull('boolean', 'single');
				else if (toBoolean(v)) return qtiValue('boolean', 'single', true);
			}
			return unknown ?? qtiValue('boolean', 'single', false);
		}
		case 'expr.not': {
			// QTI: "If the sub-expression is NULL then the not operator also results in NULL."
			const v = evalExpr(env, expr.expr);
			if (v.kind === 'invalid') return qtiInvalid('not operand invalid', 'boolean', 'single');
			if (isNullValue(v)) return qtiNull('boolean', 'single');
			return qtiValue('boolean', 'single', !toBoolean(v));
		}
		case 'expr.anyN': {
			// Three-valued (QTI ASI §15.3): false when more than max operands are true or more than
			// n - min are false; true when at least min are true; otherwise the NULL operands leave the
			// result undetermined, and it is NULL — with min 3 and max 4, {true,true,false,NULL} is
			// NULL, {true,false,false,NULL} false and {true,true,true,NULL} true. min and max may name
			// a variable (integerOrVariableRef); a bound that does not resolve leaves it undetermined.
			const min = resolveNumberOrVarRef(String(expr.min));
			const max = resolveNumberOrVarRef(String(expr.max));
			let trueCount = 0;
			let falseCount = 0;
			let unknown: QtiValue | undefined;
			for (const op of expr.ops) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') unknown = qtiInvalid('anyN operand invalid', 'boolean', 'single');
				else if (isNullValue(v)) unknown ??= qtiNull('boolean', 'single');
				else if (toBoolean(v)) trueCount++;
				else falseCount++;
			}
			if (!Number.isFinite(min) || !Number.isFinite(max)) return unknown ?? qtiNull('boolean', 'single');
			if (trueCount > max || falseCount > expr.ops.length - min) return qtiValue('boolean', 'single', false);
			if (trueCount >= min) return qtiValue('boolean', 'single', true);
			return unknown ?? qtiValue('boolean', 'single', false);
		}
		case 'expr.sum': {
			let acc = 0;
			let allInteger = expr.values.length > 0;
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiInvalid('sum operand invalid', 'float', 'single');
				const numbers = numericOperandValues(v);
				if (numbers === null) return qtiNull('float', 'single');
				if (numbers.some((n) => !Number.isFinite(n))) return qtiInvalid('sum operand is not a finite number', 'float', 'single');
				if (v.baseType !== 'integer') allInteger = false;
				for (const n of numbers) acc += n;
			}
			return qtiValue(allInteger ? 'integer' : 'float', 'single', acc);
		}
		case 'expr.subtract': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('subtract operand invalid', 'float', 'single');
			if (isNullValue(a) || isNullValue(b)) return qtiNull('float', 'single');
			const na = toNumber(a);
			const nb = toNumber(b);
			if (!Number.isFinite(na) || !Number.isFinite(nb)) return qtiInvalid('subtract operand is not a finite number', 'float', 'single');
			const out = na - nb;
			const subtractBaseType = a.baseType === 'integer' && b.baseType === 'integer' ? 'integer' : 'float';
			return Number.isFinite(out)
				? qtiValue(subtractBaseType, 'single', out)
				: qtiInvalid('subtract result is not finite', 'float', 'single');
		}
		case 'expr.product': {
			let acc = 1;
			let allInteger = expr.values.length > 0;
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiInvalid('product operand invalid', 'float', 'single');
				const numbers = numericOperandValues(v);
				if (numbers === null) return qtiNull('float', 'single');
				if (numbers.some((n) => !Number.isFinite(n))) return qtiInvalid('product operand is not a finite number', 'float', 'single');
				if (v.baseType !== 'integer') allInteger = false;
				for (const n of numbers) acc *= n;
			}
			return qtiValue(allInteger ? 'integer' : 'float', 'single', acc);
		}
		case 'expr.divide': {
			// QTI ASI §15.3: a NULL operand gives NULL, and so does a zero divisor or a result outside
			// the float value set: "the operator should result in NULL".
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('divide operand invalid', 'float', 'single');
			if (isNullValue(a) || isNullValue(b)) return qtiNull('float', 'single');
			const na = toNumber(a);
			const nb = toNumber(b);
			if (!Number.isFinite(na) || !Number.isFinite(nb)) return qtiInvalid('divide operand is not a finite number', 'float', 'single');
			const out = na / nb;
			return nb !== 0 && Number.isFinite(out) ? qtiValue('float', 'single', out) : qtiNull('float', 'single');
		}
		case 'expr.max':
		case 'expr.min': {
			// QTI ASI §15.3: the operands may be single, multiple or ordered, and a container takes
			// part with each of its values. A NULL operand, an empty container among them (§5), or a
			// value that is not numerical gives NULL. Integer when every operand is integer.
			const name = expr.kind === 'expr.max' ? 'max' : 'min';
			if (expr.values.length === 0) return qtiInvalid(`${name} requires at least one operand`);
			const nums: number[] = [];
			let allInteger = true;
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiInvalid(`${name} operand invalid`, 'float', 'single');
				const numbers = numericOperandValues(v);
				if (numbers === null || numbers.some((n) => !Number.isFinite(n))) return qtiNull('float', 'single');
				if (v.baseType !== 'integer') allInteger = false;
				nums.push(...numbers);
			}
			const result = expr.kind === 'expr.max' ? Math.max(...nums) : Math.min(...nums);
			return qtiValue(allInteger ? 'integer' : 'float', 'single', result);
		}
		case 'expr.round':
		case 'expr.truncate': {
			// QTI: "The result is a value of base-type integer": round takes n for [n-0.5, n+0.5)
			// (6.5 is 7, -6.5 is -6), truncate goes towards zero (-6.8 is -6). roundTo stays float.
			const name = expr.kind === 'expr.round' ? 'round' : 'truncate';
			const v = evalExpr(env, expr.value);
			if (v.kind === 'invalid') return qtiInvalid(`${name} operand invalid`, 'integer', 'single');
			if (isNullValue(v)) return qtiNull('integer', 'single');
			const n = toNumber(v);
			if (!Number.isFinite(n)) return qtiInvalid(`${name} operand is not a finite number`, 'integer', 'single');
			const result = expr.kind === 'expr.round' ? Math.round(n) : Math.trunc(n);
			// No negative zero: -0.4 rounds to the integer 0.
			return qtiValue('integer', 'single', result === 0 ? 0 : result);
		}
		case 'expr.mapResponse': {
			const decl = env.ctx.getDeclaration(expr.identifier);
			if (!decl?.mapping) return qtiValue('float', 'single', 0);
			let raw = mapMappedValue(decl, decl.mapping, decl.value, stringKeyComparison);

			const lower = decl.mapping.lowerBound;
			const upper = decl.mapping.upperBound;
			if (typeof lower === 'number' && raw < lower) raw = lower;
			if (typeof upper === 'number' && raw > upper) raw = upper;
			return qtiValue('float', 'single', raw);
		}
		case 'expr.mapResponsePoint': {
			const decl = env.ctx.getDeclaration(expr.identifier);
			if (!decl?.areaMapping) return qtiValue('float', 'single', 0);
			const current = decl.value;

			// Overlapping areas resolve to the entry listed first (QTI §5.5.4:
			// "those listed first taking priority in the case where areas overlap").
			// QTI §2.11.1.6 caps containers: "each area can be mapped once only", so
			// a second point in an already-counted area adds nothing.
			const hitEntries = new Set<number>();
			const mapOnePoint = (pt: { x: number; y: number }): number => {
				const entries = decl.areaMapping!.entries;
				for (let i = 0; i < entries.length; i++) {
					const e = entries[i]!;
					let matched = false;
					switch (e.shape) {
						case 'rect':
							matched = inRect(pt, e.coords);
							break;
						case 'circle':
							matched = inCircle(pt, e.coords);
							break;
						case 'ellipse':
							matched = inEllipse(pt, e.coords);
							break;
						case 'poly':
							matched = inPoly(pt, e.coords);
							break;
						case 'default':
							// default always matches if reached
							matched = true;
							break;
						default:
							break;
					}
					if (!matched) continue;
					if (hitEntries.has(i)) return 0;
					hitEntries.add(i);
					return Number(e.mappedValue);
				}
				return Number(decl.areaMapping!.defaultValue || 0);
			};

			// A NULL container maps as the empty container and a NULL point as a point outside
			// every area, as mapResponse treats them; the bounds then apply.
			const value = current.kind === 'value' ? current.value : null;
			let raw = 0;
			if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
				const arr = value === null ? [] : Array.isArray(value) ? value : [value];
				raw = arr
					.map((x) => parsePoint(x))
					.filter((p): p is { x: number; y: number } => Boolean(p))
					.map(mapOnePoint)
					.reduce((a, b) => a + b, 0);
			} else {
				const p = parsePoint(value);
				raw = p ? mapOnePoint(p) : Number(decl.areaMapping.defaultValue || 0);
			}

			const lower = decl.areaMapping.lowerBound;
			const upper = decl.areaMapping.upperBound;
			if (typeof lower === 'number' && raw < lower) raw = lower;
			if (typeof upper === 'number' && raw > upper) raw = upper;
			return qtiValue('float', 'single', raw);
		}
		case 'expr.randomInteger': {
			// QTI 2.2.2: pick integer in [min,max] satisfying min + step*n
			const minRaw = toNumber(evalExpr(env, expr.min));
			const maxRaw = toNumber(evalExpr(env, expr.max));
			const stepRaw = expr.step ? toNumber(evalExpr(env, expr.step)) : 1;

			const min = Math.ceil(minRaw);
			const max = Math.floor(maxRaw);
			const step = Math.floor(stepRaw);

			if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
				return qtiNull();
			}
			if (min > max) return qtiNull();

			const count = Math.floor((max - min) / step) + 1;
			const k = Math.floor(env.rng() * count);
			return qtiValue('integer', 'single', min + step * k);
		}
		case 'expr.randomFloat': {
			// QTI 2.2.2: pick float in [min,max]
			const min = toNumber(evalExpr(env, expr.min));
			const max = toNumber(evalExpr(env, expr.max));
			if (!Number.isFinite(min) || !Number.isFinite(max)) return qtiNull();
			if (min > max) return qtiNull();
			const n = min + env.rng() * (max - min);
			return qtiValue('float', 'single', n);
		}
		case 'expr.mathConstant': {
			const v = expr.name === 'pi' ? Math.PI : Math.E;
			return qtiValue('float', 'single', v);
		}
		case 'expr.integerToFloat': {
			const v = evalExpr(env, expr.value);
			if (v.kind === 'invalid') return qtiNull();
			if (v.kind === 'null') return qtiNull();
			const n = toNumber(v);
			if (!Number.isFinite(n)) return qtiNull();
			return qtiValue('float', 'single', n);
		}
		case 'expr.integerModulus': {
			const aV = evalExpr(env, expr.a);
			const bV = evalExpr(env, expr.b);
			if (aV.kind === 'invalid' || bV.kind === 'invalid') return qtiNull();
			if (isNullValue(aV) || isNullValue(bV)) return qtiNull('integer', 'single');
			// The operands divide as they are — no truncation — so only an actual zero divisor is
			// NULL, and the identity x = integerDivide(x,y)*y + integerModulus(x,y) holds for float
			// operands too.
			const a = toNumber(aV);
			const b = toNumber(bV);
			if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return qtiNull();
			// Mathematical modulus: a - b*floor(a/b)
			const m = a - b * Math.floor(a / b);
			return qtiValue('integer', 'single', m === 0 ? 0 : m);
		}
		case 'expr.gcd':
		case 'expr.lcm': {
			// QTI ASI §15.3: the operands may be single, multiple or ordered, and a container takes
			// part with each of its values. A NULL operand, an empty container among them (§5), or a
			// value that is not numerical gives NULL. gcd(0, n) is n and gcd(0, 0) is 0; lcm is 0
			// when any value is 0.
			const ints: number[] = [];
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiNull('integer', 'single');
				const numbers = numericOperandValues(v);
				if (numbers === null || numbers.some((n) => !Number.isFinite(n))) return qtiNull('integer', 'single');
				for (const n of numbers) ints.push(Math.trunc(n));
			}
			if (expr.kind === 'expr.gcd') {
				return qtiValue('integer', 'single', ints.reduce((acc, n) => greatestCommonDivisor(acc, n), 0));
			}
			const lcm = ints.reduce((acc, n) => {
				if (acc === 0 || n === 0) return 0;
				return Math.abs(acc / greatestCommonDivisor(acc, n)) * Math.abs(n);
			}, 1);
			return qtiValue('integer', 'single', lcm);
		}
		case 'expr.mathOperator': {
			const args = expr.values.map((e) => evalExpr(env, e));
			if (args.some((v) => v.kind === 'invalid' || isNullValue(v))) return qtiNull();
			const nums = args.map((v) => toNumber(v));
			if (nums.some((n) => !Number.isFinite(n))) return qtiNull();

			const one = (): number => nums[0]!;
			const two = (): [number, number] => [nums[0]!, nums[1]!];

			const safeReciprocal = (x: number): number | null => (x === 0 ? null : 1 / x);
			const inUnit = (x: number): boolean => x >= -1 && x <= 1;

			let result: number | null = null;
			let resultBaseType: 'float' | 'integer' = 'float';

			switch (expr.name) {
				case 'sin':
					result = Math.sin(one());
					break;
				case 'cos':
					result = Math.cos(one());
					break;
				case 'tan':
					result = Math.tan(one());
					break;
				case 'sec': {
					const r = safeReciprocal(Math.cos(one()));
					result = r;
					break;
				}
				case 'csc': {
					const r = safeReciprocal(Math.sin(one()));
					result = r;
					break;
				}
				case 'cot': {
					const r = safeReciprocal(Math.tan(one()));
					result = r;
					break;
				}
				case 'asin': {
					const x = one();
					result = inUnit(x) ? Math.asin(x) : null;
					break;
				}
				case 'acos': {
					const x = one();
					result = inUnit(x) ? Math.acos(x) : null;
					break;
				}
				case 'atan':
					result = Math.atan(one());
					break;
				case 'atan2': {
					if (nums.length < 2) return qtiNull();
					const [y, x] = two();
					result = Math.atan2(y, x);
					break;
				}
				case 'asec': {
					const inv = safeReciprocal(one());
					result = inv !== null && inUnit(inv) ? Math.acos(inv) : null;
					break;
				}
				case 'acsc': {
					const inv = safeReciprocal(one());
					result = inv !== null && inUnit(inv) ? Math.asin(inv) : null;
					break;
				}
				case 'acot': {
					const inv = safeReciprocal(one());
					result = inv !== null ? Math.atan(inv) : null;
					break;
				}
				case 'sinh':
					result = Math.sinh(one());
					break;
				case 'cosh':
					result = Math.cosh(one());
					break;
				case 'tanh':
					result = Math.tanh(one());
					break;
				case 'sech': {
					const r = safeReciprocal(Math.cosh(one()));
					result = r;
					break;
				}
				case 'csch': {
					const r = safeReciprocal(Math.sinh(one()));
					result = r;
					break;
				}
				case 'coth': {
					const r = safeReciprocal(Math.tanh(one()));
					result = r;
					break;
				}
				case 'log': {
					const x = one();
					result = x > 0 ? Math.log10(x) : null;
					break;
				}
				case 'ln': {
					const x = one();
					result = x > 0 ? Math.log(x) : null;
					break;
				}
				case 'exp':
					result = Math.exp(one());
					break;
				case 'abs':
					result = Math.abs(one());
					break;
				case 'signum':
					resultBaseType = 'integer';
					result = Math.sign(one());
					break;
				case 'floor':
					resultBaseType = 'integer';
					result = Math.floor(one());
					break;
				case 'ceil':
					resultBaseType = 'integer';
					result = Math.ceil(one());
					break;
				case 'toDegrees':
					result = (one() * 180) / Math.PI;
					break;
				case 'toRadians':
					result = (one() * Math.PI) / 180;
					break;
				default:
					return qtiNull();
			}

			if (result === null || !Number.isFinite(result)) return qtiNull();
			return qtiValue(resultBaseType, 'single', result);
		}
		case 'expr.roundTo': {
			const valueV = evalExpr(env, expr.value);
			// An empty string is NULL, as QTI reads it (ASI §5).
			if (valueV.kind === 'invalid' || isNullValue(valueV)) return qtiNull();
			const value = toNumber(valueV);
			const figures = Math.floor(toNumber(evalExpr(env, expr.figures)));
			if (!Number.isFinite(value) || !Number.isFinite(figures) || figures < 0) return qtiNull();

			try {
				const d = new Decimal(value);
				const rounded =
					expr.roundingMode === 'significantFigures'
						? d.toSignificantDigits(figures, Decimal.ROUND_HALF_UP)
						: d.toDecimalPlaces(figures, Decimal.ROUND_HALF_UP);
				return qtiValue('float', 'single', Number(rounded.toString()));
			} catch {
				return qtiNull();
			}
		}
		default: {
			// If we missed a node kind, fail loudly.
			return qtiInvalid(`Unhandled expression kind: ${(expr as any).kind}`);
		}
	}
}
