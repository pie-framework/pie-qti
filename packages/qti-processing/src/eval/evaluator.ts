import Decimal from 'decimal.js';
import type { ExpressionNode } from '../ast/types.js';
import type { DeclarationContext } from '../runtime/context.js';
import type { BaseType, Cardinality, LookupTableTable, QtiValue } from '../runtime/types.js';
import {
	coerceBaseValue,
	normalizeForCompare,
	qtiInvalid,
	qtiNull,
	qtiValue,
	toBoolean,
	toNumber,
	toStringValue,
} from '../runtime/value.js';
import type { TestEvalContext } from '../test/types.js';
import type { OperatorRegistry } from './operators.js';

export interface EvalEnv {
	ctx: DeclarationContext;
	ops: OperatorRegistry;
	rng: () => number;
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

export function applyLookupTable(source: QtiValue, table: LookupTableTable): QtiValue {
	if (source.kind === 'invalid') return qtiInvalid('lookupTable invalid');
	if (source.kind === 'null') {
		const def = table.defaultValue;
		return def === undefined ? qtiNull() : qtiValue('float', 'single', def);
	}
	if (source.kind !== 'value') return qtiNull();
	if (Array.isArray(source.value)) return qtiInvalid('lookupTable expects single cardinality');

	if (table.kind === 'table.matchTable') {
		const srcIsNumber = source.baseType === 'integer' || source.baseType === 'float';
		if (srcIsNumber) {
			const x = toNumber(source);
			for (const entry of table.entries) {
				const k = Number(entry.sourceValue);
				if (!Number.isFinite(k)) continue;
				if (x === k) {
					const n = Number(entry.targetValue);
					return Number.isFinite(n) ? qtiValue('float', 'single', n) : qtiValue('string', 'single', entry.targetValue);
				}
			}
		} else {
			const x = normalizeForCompare(source.value);
			for (const entry of table.entries) {
				if (x === normalizeForCompare(entry.sourceValue)) {
					const n = Number(entry.targetValue);
					return Number.isFinite(n) ? qtiValue('float', 'single', n) : qtiValue('string', 'single', entry.targetValue);
				}
			}
		}

		const def = table.defaultValue;
		return def === undefined ? qtiNull() : qtiValue('float', 'single', def);
	}

	// interpolation table
	if (source.baseType !== 'integer' && source.baseType !== 'float') {
		return qtiInvalid('lookupTable interpolation expects numeric source');
	}
	const method = (table.interpolationMethod || 'linear').toLowerCase();
	if (method !== 'linear') return qtiInvalid(`lookupTable unsupported interpolationMethod: ${method}`);

	const x = toNumber(source);
	if (!Number.isFinite(x)) return qtiInvalid('lookupTable interpolation invalid number');

	const entries = [...table.entries].sort((a, b) => a.sourceValue - b.sourceValue);
	if (entries.length === 0) {
		const def = table.defaultValue;
		return def === undefined ? qtiNull() : qtiValue('float', 'single', def);
	}

	if (x <= entries[0]!.sourceValue) return qtiValue('float', 'single', entries[0]!.targetValue);
	if (x >= entries[entries.length - 1]!.sourceValue) return qtiValue('float', 'single', entries[entries.length - 1]!.targetValue);

	for (let i = 0; i < entries.length - 1; i++) {
		const a = entries[i]!;
		const b = entries[i + 1]!;
		if (x >= a.sourceValue && x <= b.sourceValue) {
			if (a.sourceValue === b.sourceValue) return qtiValue('float', 'single', a.targetValue);
			const t = (x - a.sourceValue) / (b.sourceValue - a.sourceValue);
			return qtiValue('float', 'single', a.targetValue + t * (b.targetValue - a.targetValue));
		}
	}

	// Fallback (shouldn't happen due to bounds checks)
	return qtiValue('float', 'single', entries[entries.length - 1]!.targetValue);
}

export function evalExpr(env: EvalEnv, expr: ExpressionNode): QtiValue {
	const inferBaseType = (values: QtiValue[], fallback: BaseType = 'string'): BaseType => {
		for (const v of values) {
			if (v.kind === 'value') return v.baseType;
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
		return normalizeForCompare(v);
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
			'record',
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

	switch (expr.kind) {
		case 'expr.baseValue':
			return coerceBaseValue(expr.baseType as any, expr.text);
		case 'expr.null':
			return qtiNull();
		case 'expr.variable':
			return env.ctx.getValue(expr.identifier);
		case 'expr.correct':
			return env.ctx.getCorrectResponse(expr.identifier);
		case 'expr.default':
			return env.ctx.getDefaultValue(expr.identifier);
		case 'expr.testVariables': {
			const items = filterTestItems(expr);
			if (!items) return qtiInvalid('testVariables requires env.test');

			const targetBaseType = asBaseType(expr.baseType) || 'float';
			const out: unknown[] = [];

			for (const it of items) {
				const v = it.variables?.[expr.variableIdentifier];
				if (!v || v.kind !== 'value') continue;
				if (v.cardinality !== 'single') continue;
				if (v.value === null || v.value === undefined) continue;

				// Only variables with single cardinality are considered, all NULL values are ignored.
				let raw: unknown = v.value;

				// If weightIdentifier is provided, apply weight to numeric values.
				if (expr.weightIdentifier) {
					const w = resolveWeight(it, expr.weightIdentifier);
					const n = toNumber(v);
					if (Number.isFinite(n)) raw = n * w;
				}

				// Coerce into requested baseType (best effort).
				switch (targetBaseType) {
					case 'boolean':
						out.push(Boolean(raw));
						break;
					case 'integer': {
						const n = Number(raw);
						if (Number.isFinite(n)) out.push(Math.trunc(n));
						break;
					}
					case 'float': {
						const n = Number(raw);
						if (Number.isFinite(n)) out.push(n);
						break;
					}
					default:
						out.push(String(raw));
						break;
				}
			}

			return qtiValue(targetBaseType, 'multiple', out);
		}
		case 'expr.outcomeMinimum':
		case 'expr.outcomeMaximum': {
			const items = filterTestItems(expr);
			if (!items) return qtiInvalid(`${expr.kind} requires env.test`);

			const values: number[] = [];
			for (const it of items) {
				const v = it.variables?.[expr.outcomeIdentifier];
				if (!v || v.kind !== 'value') continue;
				if (v.cardinality !== 'single') continue;
				const n = toNumber(v);
				if (!Number.isFinite(n)) continue;
				const w = resolveWeight(it, (expr as any).weightIdentifier);
				values.push(n * w);
			}
			if (values.length === 0) return qtiNull('float', 'single');
			const out = expr.kind === 'expr.outcomeMinimum' ? Math.min(...values) : Math.max(...values);
			return qtiValue('float', 'single', out);
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
		case 'expr.preCondition': {
			// Treat as boolean-context wrapper. (Our boolean operators already treat NULL/invalid as false.)
			const v = evalExpr(env, expr.expr);
			return qtiValue('boolean', 'single', toBoolean(v));
		}
		case 'expr.isNull': {
			const v = evalExpr(env, expr.expr);
			return qtiValue('boolean', 'single', v.kind === 'null');
		}
		case 'expr.isNotNull': {
			const v = evalExpr(env, expr.expr);
			return qtiValue('boolean', 'single', v.kind !== 'null');
		}
		case 'expr.match': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('match invalid');
			if (a.kind === 'null' || b.kind === 'null') return qtiValue('boolean', 'single', false);

			// Cardinality-aware match: ordered arrays must match in order; multiple is unordered multiset
			if (a.kind === 'value' && b.kind === 'value') {
				const av = a.value;
				const bv = b.value;
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
					// ordered
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
		case 'expr.equal': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('equal invalid');
			// Spec-aligned null propagation: boolean comparisons yield NULL if any operand is NULL.
			if (a.kind === 'null' || b.kind === 'null') return qtiNull('boolean', 'single');

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
			if (a.kind === 'null' || b.kind === 'null') return qtiNull('boolean', 'single');
			if (a.kind !== 'value' || b.kind !== 'value') return qtiValue('boolean', 'single', false);
			if (Array.isArray(a.value) || Array.isArray(b.value)) return qtiValue('boolean', 'single', false);

			const x = toNumber(a);
			const y = toNumber(b);
			if (!Number.isFinite(x) || !Number.isFinite(y)) return qtiInvalid('equalRounded invalid number');

			const modeRaw = (expr.roundingMode || '').trim().toLowerCase();
			const mode =
				modeRaw === 'significantfigure' || modeRaw === 'significantfigures'
					? 'significantFigures'
					: modeRaw === 'decimalplace' || modeRaw === 'decimalplaces'
						? 'decimalPlaces'
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
		case 'expr.notEqual': {
			const eq = evalExpr(env, { kind: 'expr.equal', id: expr.id, a: expr.a, b: expr.b } as any);
			// Spec-aligned null/invalid propagation: if equality is null/invalid, notEqual is also null/invalid.
			// This prevents missing responses (NULL) from becoming truthy via boolean negation.
			if (eq.kind === 'null') return qtiNull();
			if (eq.kind === 'invalid') return eq;
			return qtiValue('boolean', 'single', !toBoolean(eq));
		}
		case 'expr.member': {
			const value = evalExpr(env, expr.value);
			const container = evalExpr(env, expr.container);
			if (value.kind === 'invalid' || container.kind === 'invalid') return qtiInvalid('member invalid');
			if (value.kind === 'null' || container.kind === 'null') return qtiValue('boolean', 'single', false);
			if (value.kind !== 'value' || container.kind !== 'value') return qtiValue('boolean', 'single', false);

			const v = value.value;
			const c = container.value;
			if (!Array.isArray(c)) return qtiValue('boolean', 'single', false);
			const needle = normalizeScalarForCompare(v, container.baseType);
			return qtiValue('boolean', 'single', c.some((x) => normalizeScalarForCompare(x, container.baseType) === needle));
		}
		case 'expr.contains': {
			const container = evalExpr(env, expr.container);
			const value = evalExpr(env, expr.value);
			if (value.kind === 'invalid' || container.kind === 'invalid') return qtiInvalid('contains invalid');
			if (value.kind === 'null' || container.kind === 'null') return qtiValue('boolean', 'single', false);
			if (value.kind !== 'value' || container.kind !== 'value') return qtiValue('boolean', 'single', false);

			const c = container.value;
			if (!Array.isArray(c)) return qtiValue('boolean', 'single', false);
			const needle = normalizeScalarForCompare(value.value, container.baseType);
			return qtiValue('boolean', 'single', c.some((x) => normalizeScalarForCompare(x, container.baseType) === needle));
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
					? container.baseType
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
			const values = expr.values.map((v) => evalExpr(env, v));
			if (values.some((v) => v.kind === 'invalid')) return qtiInvalid(`${expr.kind} invalid`);
			const baseType = inferBaseType(values);
			const out: unknown[] = [];
			for (const v of values) {
				if (v.kind === 'null') {
					out.push(null);
					continue;
				}
				if (v.kind !== 'value') continue;
				if (Array.isArray(v.value)) out.push(...v.value);
				else out.push(v.value);
			}
			const cardinality: Cardinality = expr.kind === 'expr.ordered' ? 'ordered' : 'multiple';
			return qtiValue(baseType, cardinality, out);
		}
		case 'expr.delete': {
			const container = evalExpr(env, expr.container);
			const value = evalExpr(env, expr.value);
			if (container.kind === 'invalid' || value.kind === 'invalid') return qtiInvalid('delete invalid');

			const baseType: BaseType =
				container.kind === 'value' ? container.baseType : value.kind === 'value' ? value.baseType : 'string';

			const needle =
				value.kind === 'value'
					? value.value
					: value.kind === 'null'
						? null
						: null;

			const needles = Array.isArray(needle) ? new Set(needle.map((n) => normalizeForCompare(n))) : null;
			const needleKey = needles ? null : normalizeForCompare(needle);

			const remove = (x: unknown): boolean => {
				const k = normalizeForCompare(x);
				if (needles) return needles.has(k);
				return k === needleKey;
			};

			if (container.kind !== 'value') return qtiNull(baseType, 'single');
			const outCard: Cardinality = container.cardinality;

			if (!Array.isArray(container.value)) {
				// Single value: remove => NULL, else unchanged
				return remove(container.value) ? qtiNull(baseType, 'single') : qtiValue(baseType, 'single', container.value);
			}

			return qtiValue(baseType, outCard, container.value.filter((item) => !remove(item)));
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
				outBaseType = v.baseType;
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
		case 'expr.durationLT': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('durationLT invalid');
			if (a.kind === 'null' || b.kind === 'null') return qtiNull('boolean', 'single');
			if (a.kind !== 'value' || b.kind !== 'value') return qtiInvalid('durationLT expects values');
			if (a.baseType !== 'duration' || b.baseType !== 'duration') return qtiInvalid('durationLT expects duration operands');
			return qtiValue('boolean', 'single', Number(a.value) < Number(b.value));
		}
		case 'expr.durationGTE': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('durationGTE invalid');
			if (a.kind === 'null' || b.kind === 'null') return qtiNull('boolean', 'single');
			if (a.kind !== 'value' || b.kind !== 'value') return qtiInvalid('durationGTE expects values');
			if (a.baseType !== 'duration' || b.baseType !== 'duration') return qtiInvalid('durationGTE expects duration operands');
			return qtiValue('boolean', 'single', Number(a.value) >= Number(b.value));
		}
		case 'expr.inside': {
			const value = evalExpr(env, expr.value);
			if (value.kind === 'invalid') return qtiInvalid('inside invalid');
			if (value.kind === 'null') return qtiNull('boolean', 'single');
			if (value.kind !== 'value') return qtiInvalid('inside expects a value');
			if (value.baseType !== 'point') return qtiInvalid('inside expects point baseType');

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
		case 'expr.record': {
			const record: Record<string, QtiValue> = {};
			for (const f of expr.fields) {
				record[f.fieldIdentifier] = evalExpr(env, f.value);
			}
			return qtiValue('record', 'single', record);
		}
		case 'expr.fieldValue': {
			const rec = evalExpr(env, expr.record);
			if (rec.kind !== 'value' || rec.baseType !== 'record') return qtiNull();
			const obj = rec.value as Record<string, QtiValue> | undefined;
			return obj?.[expr.fieldIdentifier] ?? qtiNull();
		}
		case 'expr.substring': {
			const value = evalExpr(env, expr.value);
			const start = evalExpr(env, expr.start);
			const length = expr.length ? evalExpr(env, expr.length) : undefined;
			if (value.kind === 'invalid' || start.kind === 'invalid' || length?.kind === 'invalid') return qtiInvalid('substring invalid');
			if (value.kind === 'null') return qtiNull('string', 'single');

			const s = toStringValue(value);

			// QTI indexing is 1-based
			const startIdx = Math.max(0, Math.floor(toNumber(start)) - 1);
			if (!Number.isFinite(startIdx)) return qtiInvalid('substring start invalid');

			if (!length) return qtiValue('string', 'single', s.substring(startIdx));
			const len = Math.max(0, Math.floor(toNumber(length)));
			if (!Number.isFinite(len)) return qtiInvalid('substring length invalid');
			return qtiValue('string', 'single', s.substring(startIdx, startIdx + len));
		}
		case 'expr.lookupTable': {
			const source = evalExpr(env, expr.source);
			return applyLookupTable(source, expr.table);
		}
		case 'expr.random': {
			const v = evalExpr(env, expr.value);
			if (v.kind !== 'value') return v;
			if (!Array.isArray(v.value)) return v;
			if (v.value.length === 0) return qtiNull(v.baseType, 'single');
			const idx = Math.min(v.value.length - 1, Math.floor(env.rng() * v.value.length));
			return qtiValue(v.baseType, 'single', (v.value as any[])[idx]);
		}
		case 'expr.power': {
			const a = toNumber(evalExpr(env, expr.a));
			const b = toNumber(evalExpr(env, expr.b));
			const n = Math.pow(a, b);
			if (!Number.isFinite(n)) return qtiInvalid('power invalid');
			return qtiValue('float', 'single', n);
		}
		case 'expr.mod': {
			const a = toNumber(evalExpr(env, expr.a));
			const b = toNumber(evalExpr(env, expr.b));
			const n = a % b;
			if (!Number.isFinite(n)) return qtiInvalid('mod invalid');
			return qtiValue('float', 'single', n);
		}
		case 'expr.integerDivide': {
			const a = toNumber(evalExpr(env, expr.a));
			const b = toNumber(evalExpr(env, expr.b));
			if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return qtiInvalid('integerDivide invalid');
			return qtiValue('integer', 'single', Math.trunc(a / b));
		}
		case 'expr.mean':
		case 'expr.sampleVariance':
		case 'expr.sampleSD':
		case 'expr.popVariance':
		case 'expr.popSD': {
			const valuesExpr = (expr as any).values as ExpressionNode;
			const values = evalExpr(env, valuesExpr);
			if (values.kind === 'invalid') return qtiInvalid(`${expr.kind} invalid`);
			if (values.kind !== 'value') return qtiInvalid(`${expr.kind} expects a container`);

			const arr = Array.isArray(values.value) ? values.value : [values.value];
			const nums = arr.map((x) => Number(x));
			if (nums.length === 0) return qtiInvalid(`${expr.kind} empty`);
			if (nums.some((n) => Number.isNaN(n))) return qtiInvalid(`${expr.kind} NaN`);

			const mean = nums.reduce((a, b) => a + b, 0) / nums.length;

			if (expr.kind === 'expr.mean') return qtiValue('float', 'single', mean);

			const squared = nums.map((n) => (n - mean) * (n - mean)).reduce((a, b) => a + b, 0);
			const denom = expr.kind === 'expr.sampleVariance' || expr.kind === 'expr.sampleSD' ? nums.length - 1 : nums.length;
			if (denom <= 0) return qtiInvalid(`${expr.kind} requires at least 2 values`);
			const variance = squared / denom;

			if (expr.kind === 'expr.sampleVariance' || expr.kind === 'expr.popVariance') {
				return qtiValue('float', 'single', variance);
			}
			return qtiValue('float', 'single', Math.sqrt(variance));
		}
		case 'expr.isTypeOf': {
			const v = evalExpr(env, expr.value);
			const baseType = toStringValue(evalExpr(env, expr.baseType)).trim();
			if (!baseType) return qtiValue('boolean', 'single', false);
			return qtiValue('boolean', 'single', v.kind === 'value' && v.baseType.toLowerCase() === baseType.toLowerCase());
		}
		case 'expr.stringMatch': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('stringMatch invalid');
			if (a.kind === 'null' || b.kind === 'null') return qtiValue('boolean', 'single', false);

			const sa = toStringValue(a);
			const sb = toStringValue(b);

			const left = expr.caseSensitive ? sa : sa.toLowerCase();
			const right = expr.caseSensitive ? sb : sb.toLowerCase();

			if (expr.substring) return qtiValue('boolean', 'single', left.includes(right));
			return qtiValue('boolean', 'single', left === right);
		}
		case 'expr.patternMatch': {
			const value = evalExpr(env, expr.value);
			const pattern = evalExpr(env, expr.pattern);
			if (value.kind === 'invalid' || pattern.kind === 'invalid') return qtiInvalid('patternMatch invalid');
			if (value.kind === 'null' || pattern.kind === 'null') return qtiValue('boolean', 'single', false);

			const sv = toStringValue(value);
			const sp = toStringValue(pattern);

			try {
				const re = new RegExp(sp, expr.caseSensitive ? undefined : 'i');
				return qtiValue('boolean', 'single', re.test(sv));
			} catch {
				// Invalid regex pattern
				return qtiValue('boolean', 'single', false);
			}
		}
		case 'expr.lt':
			return qtiValue('boolean', 'single', toNumber(evalExpr(env, expr.a)) < toNumber(evalExpr(env, expr.b)));
		case 'expr.lte':
			return qtiValue('boolean', 'single', toNumber(evalExpr(env, expr.a)) <= toNumber(evalExpr(env, expr.b)));
		case 'expr.gt':
			return qtiValue('boolean', 'single', toNumber(evalExpr(env, expr.a)) > toNumber(evalExpr(env, expr.b)));
		case 'expr.gte':
			return qtiValue('boolean', 'single', toNumber(evalExpr(env, expr.a)) >= toNumber(evalExpr(env, expr.b)));
		case 'expr.and':
			return qtiValue('boolean', 'single', expr.ops.every((o) => toBoolean(evalExpr(env, o))));
		case 'expr.or':
			return qtiValue('boolean', 'single', expr.ops.some((o) => toBoolean(evalExpr(env, o))));
		case 'expr.not':
			return qtiValue('boolean', 'single', !toBoolean(evalExpr(env, expr.expr)));
		case 'expr.anyN': {
			const trueCount = expr.ops.reduce((acc, o) => acc + (toBoolean(evalExpr(env, o)) ? 1 : 0), 0);
			return qtiValue('boolean', 'single', trueCount >= expr.min && trueCount <= expr.max);
		}
		case 'expr.allN': {
			const trueCount = expr.ops.reduce((acc, o) => acc + (toBoolean(evalExpr(env, o)) ? 1 : 0), 0);
			return qtiValue('boolean', 'single', trueCount <= expr.max);
		}
		case 'expr.sum': {
			let acc = 0;
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiInvalid('sum operand invalid', 'float', 'single');
				if (v.kind === 'null') return qtiNull('float', 'single');
				const n = toNumber(v);
				if (!Number.isFinite(n)) return qtiInvalid('sum operand is not a finite number', 'float', 'single');
				acc += n;
			}
			return qtiValue('float', 'single', acc);
		}
		case 'expr.subtract': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('subtract operand invalid', 'float', 'single');
			if (a.kind === 'null' || b.kind === 'null') return qtiNull('float', 'single');
			const na = toNumber(a);
			const nb = toNumber(b);
			if (!Number.isFinite(na) || !Number.isFinite(nb)) return qtiInvalid('subtract operand is not a finite number', 'float', 'single');
			const out = na - nb;
			return Number.isFinite(out) ? qtiValue('float', 'single', out) : qtiInvalid('subtract result is not finite', 'float', 'single');
		}
		case 'expr.product': {
			let acc = 1;
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiInvalid('product operand invalid', 'float', 'single');
				if (v.kind === 'null') return qtiNull('float', 'single');
				const n = toNumber(v);
				if (!Number.isFinite(n)) return qtiInvalid('product operand is not a finite number', 'float', 'single');
				acc *= n;
			}
			return qtiValue('float', 'single', acc);
		}
		case 'expr.divide': {
			const a = evalExpr(env, expr.a);
			const b = evalExpr(env, expr.b);
			if (a.kind === 'invalid' || b.kind === 'invalid') return qtiInvalid('divide operand invalid', 'float', 'single');
			if (a.kind === 'null' || b.kind === 'null') return qtiNull('float', 'single');
			const na = toNumber(a);
			const nb = toNumber(b);
			if (!Number.isFinite(na) || !Number.isFinite(nb)) return qtiInvalid('divide operand is not a finite number', 'float', 'single');
			const out = na / nb;
			return Number.isFinite(out) ? qtiValue('float', 'single', out) : qtiInvalid('divide result is not finite', 'float', 'single');
		}
		case 'expr.max': {
			if (expr.values.length === 0) return qtiInvalid('max requires at least one operand');
			const nums: number[] = [];
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiInvalid('max operand invalid', 'float', 'single');
				if (v.kind === 'null') return qtiNull('float', 'single');
				const n = toNumber(v);
				if (!Number.isFinite(n)) return qtiInvalid('max operand is not a finite number', 'float', 'single');
				nums.push(n);
			}
			return qtiValue('float', 'single', Math.max(...nums));
		}
		case 'expr.min': {
			if (expr.values.length === 0) return qtiInvalid('min requires at least one operand');
			const nums: number[] = [];
			for (const op of expr.values) {
				const v = evalExpr(env, op);
				if (v.kind === 'invalid') return qtiInvalid('min operand invalid', 'float', 'single');
				if (v.kind === 'null') return qtiNull('float', 'single');
				const n = toNumber(v);
				if (!Number.isFinite(n)) return qtiInvalid('min operand is not a finite number', 'float', 'single');
				nums.push(n);
			}
			return qtiValue('float', 'single', Math.min(...nums));
		}
		case 'expr.round': {
			const v = evalExpr(env, expr.value);
			if (v.kind === 'invalid') return qtiInvalid('round operand invalid', 'float', 'single');
			if (v.kind === 'null') return qtiNull('float', 'single');
			const n = toNumber(v);
			if (!Number.isFinite(n)) return qtiInvalid('round operand is not a finite number', 'float', 'single');
			return qtiValue('float', 'single', Math.round(n));
		}
		case 'expr.truncate': {
			const v = evalExpr(env, expr.value);
			if (v.kind === 'invalid') return qtiInvalid('truncate operand invalid', 'float', 'single');
			if (v.kind === 'null') return qtiNull('float', 'single');
			const n = toNumber(v);
			if (!Number.isFinite(n)) return qtiInvalid('truncate operand is not a finite number', 'float', 'single');
			return qtiValue('float', 'single', Math.trunc(n));
		}
		case 'expr.mapOutcome': {
			const decl = env.ctx.getDeclaration(expr.identifier);
			if (!decl?.mapping) return qtiValue('float', 'single', 0);
			const current = decl.value;
			if (current.kind !== 'value') return qtiValue('float', 'single', decl.mapping.defaultValue ?? 0);

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
				const k = normalizeMappingKey(key);
				const entry =
					decl.mapping!.entries[k] ??
					((decl.baseType === 'string' || decl.baseType === 'identifier') ? decl.mapping!.entries[k.toLowerCase()] : undefined);
				return entry ? Number(entry.mappedValue) : Number(decl.mapping!.defaultValue ?? 0);
			};

			let raw = 0;
			if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
				const arr = Array.isArray(current.value) ? current.value : [current.value];
				raw = arr.map((x) => mapOne(String(x))).reduce((a, b) => a + b, 0);
			} else {
				raw = mapOne(String(current.value));
			}

			const lower = decl.mapping.lowerBound;
			const upper = decl.mapping.upperBound;
			if (typeof lower === 'number' && raw < lower) raw = lower;
			if (typeof upper === 'number' && raw > upper) raw = upper;
			return qtiValue('float', 'single', raw);
		}
		case 'expr.mapResponse': {
			const decl = env.ctx.getDeclaration(expr.identifier);
			if (!decl?.mapping) return qtiValue('float', 'single', 0);
			const current = decl.value;
			if (current.kind !== 'value') return qtiValue('float', 'single', decl.mapping.defaultValue ?? 0);

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
				const k = normalizeMappingKey(key);
				const entry =
					decl.mapping!.entries[k] ??
					((decl.baseType === 'string' || decl.baseType === 'identifier') ? decl.mapping!.entries[k.toLowerCase()] : undefined);
				return entry ? Number(entry.mappedValue) : Number(decl.mapping!.defaultValue ?? 0);
			};

			let raw = 0;
			if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
				const arr = Array.isArray(current.value) ? current.value : [current.value];
				raw = arr.map((x) => mapOne(String(x))).reduce((a, b) => a + b, 0);
			} else {
				raw = mapOne(String(current.value));
			}

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
			if (current.kind !== 'value') return qtiValue('float', 'single', decl.areaMapping.defaultValue ?? 0);

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
					const intersects =
						(yi > p.y) !== (yj > p.y) &&
						p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
					if (intersects) inside = !inside;
				}
				return inside;
			};

			const mapOnePoint = (pt: { x: number; y: number }): number => {
				for (const e of decl.areaMapping!.entries) {
					switch (e.shape) {
						case 'rect':
							if (inRect(pt, e.coords)) return Number(e.mappedValue);
							break;
						case 'circle':
							if (inCircle(pt, e.coords)) return Number(e.mappedValue);
							break;
						case 'ellipse':
							if (inEllipse(pt, e.coords)) return Number(e.mappedValue);
							break;
						case 'poly':
							if (inPoly(pt, e.coords)) return Number(e.mappedValue);
							break;
						case 'default':
							// default always matches if reached
							return Number(e.mappedValue);
						default:
							break;
					}
				}
				return Number(decl.areaMapping!.defaultValue || 0);
			};

			let raw = 0;
			if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
				const arr = Array.isArray(current.value) ? current.value : [current.value];
				raw = arr
					.map((x) => parsePoint(x))
					.filter((p): p is { x: number; y: number } => Boolean(p))
					.map(mapOnePoint)
					.reduce((a, b) => a + b, 0);
			} else {
				const p = parsePoint(current.value);
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
			if (aV.kind === 'null' || bV.kind === 'null') return qtiNull();
			const a = Math.trunc(toNumber(aV));
			const b = Math.trunc(toNumber(bV));
			if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return qtiNull();
			// Mathematical modulus: a - b*floor(a/b)
			const m = a - b * Math.floor(a / b);
			return qtiValue('integer', 'single', m);
		}
		case 'expr.gcd': {
			const vals = expr.values.map((e) => evalExpr(env, e));
			if (vals.some((v) => v.kind === 'invalid' || v.kind === 'null')) return qtiNull();
			const ints = vals.map((v) => Math.trunc(toNumber(v)));
			if (ints.some((n) => !Number.isFinite(n))) return qtiNull();

			const gcd2 = (x: number, y: number): number => {
				x = Math.abs(x);
				y = Math.abs(y);
				while (y !== 0) {
					const t = x % y;
					x = y;
					y = t;
				}
				return x;
			};
			return qtiValue('integer', 'single', ints.reduce((acc, n) => gcd2(acc, n), 0));
		}
		case 'expr.lcm': {
			const vals = expr.values.map((e) => evalExpr(env, e));
			if (vals.some((v) => v.kind === 'invalid' || v.kind === 'null')) return qtiNull();
			const ints = vals.map((v) => Math.trunc(toNumber(v)));
			if (ints.some((n) => !Number.isFinite(n))) return qtiNull();

			const gcd2 = (x: number, y: number): number => {
				x = Math.abs(x);
				y = Math.abs(y);
				while (y !== 0) {
					const t = x % y;
					x = y;
					y = t;
				}
				return x;
			};
			const lcm2 = (x: number, y: number): number => {
				x = Math.abs(x);
				y = Math.abs(y);
				if (x === 0 || y === 0) return 0;
				return (x / gcd2(x, y)) * y;
			};
			return qtiValue('integer', 'single', ints.reduce((acc, n) => lcm2(acc, n), 1));
		}
		case 'expr.mathOperator': {
			const args = expr.values.map((e) => evalExpr(env, e));
			if (args.some((v) => v.kind === 'invalid' || v.kind === 'null')) return qtiNull();
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
			const value = toNumber(evalExpr(env, expr.value));
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


