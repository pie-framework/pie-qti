/**
 * Printed variables
 *
 * `printedVariable` renders an outcome or template variable per QTI's number formatting rules.
 * `format` is an ISO C `printf` conversion applied to each value, with `%i` written in `base`
 * (2–36). An ordered container prints the value at the 1-based `index`, or every value; a
 * container prints its values joined by `delimiter`. A record prints its `field`, or every field
 * as name, `mappingIndicator`, value, joined by `delimiter`. `base` and `index` take an integer or
 * a variable identifier. `powerForm` writes exponential notation as a power of ten with a
 * superscript exponent; a number printed without `format` takes exponential notation for it.
 * NULL, an out-of-range index and a missing field print nothing.
 */

import { getAttr, type QtiValue } from '@pie-qti/qti-processing';

/** A run of text, or an exponent to set as a superscript. */
export type PrintedSegment = string | { readonly superscript: string };

export interface PrintedVariableOptions {
	readonly format?: string;
	readonly base: number;
	readonly index?: number;
	readonly powerForm: boolean;
	readonly field?: string;
	readonly delimiter: string;
	readonly mappingIndicator: string;
}

/**
 * The printing options on a `printedVariable` element, in either QTI spelling. `variable`
 * resolves the identifier form of `base` and `index`.
 */
export function readPrintedVariableOptions(
	element: Element,
	variable: (identifier: string) => QtiValue,
): PrintedVariableOptions {
	const attr = (name: string): string | undefined => getAttr(element, name) ?? undefined;
	const integer = (name: string): number | undefined => {
		const raw = attr(name)?.trim().replace(/^\{(.*)\}$/, '$1');
		if (!raw) return undefined;
		const literal = Number(raw);
		if (Number.isInteger(literal)) return literal;
		const value = variable(raw);
		const resolved = value.kind === 'value' ? Number(value.value) : Number.NaN;
		return Number.isInteger(resolved) ? resolved : undefined;
	};
	const base = integer('base');
	const format = attr('format');
	const index = integer('index');
	const field = attr('field');
	return {
		...(format ? { format } : {}),
		base: base !== undefined && base >= 2 && base <= 36 ? base : 10,
		...(index !== undefined ? { index } : {}),
		powerForm: attr('powerForm')?.trim() === 'true',
		...(field ? { field } : {}),
		delimiter: attr('delimiter') ?? ';',
		mappingIndicator: attr('mappingIndicator') ?? '=',
	};
}

/** `value` as printed text. */
export function printVariable(value: QtiValue, options: PrintedVariableOptions): PrintedSegment[] {
	if (value.kind !== 'value') return [];
	const { cardinality } = value;
	if (cardinality === 'record') return printRecord(value.value as Record<string, QtiValue> | undefined, options);
	if (cardinality === 'multiple' || cardinality === 'ordered') {
		const values = Array.isArray(value.value) ? value.value : [];
		if (cardinality === 'ordered' && options.index !== undefined) {
			const picked = values[options.index - 1];
			return picked === undefined || picked === null ? [] : printSingle(picked, options);
		}
		return joined(
			values.filter((item) => item !== null && item !== undefined).map((item) => printSingle(item, options)),
			options.delimiter,
		);
	}
	return printSingle(value.value, options);
}

function printRecord(record: Record<string, QtiValue> | undefined, options: PrintedVariableOptions): PrintedSegment[] {
	if (!record) return [];
	if (options.field !== undefined) {
		const field = record[options.field];
		return field ? printVariable(field, { ...options, field: undefined }) : [];
	}
	const fields = Object.entries(record).map(([name, field]): PrintedSegment[] => [
		`${name}${options.mappingIndicator}`,
		...printVariable(field, options),
	]);
	return joined(fields, options.delimiter);
}

function joined(parts: PrintedSegment[][], delimiter: string): PrintedSegment[] {
	return parts.flatMap((part, i) => (i === 0 ? part : [delimiter, ...part]));
}

function printSingle(raw: unknown, options: PrintedVariableOptions): PrintedSegment[] {
	const value = Array.isArray(raw) ? raw.join(' ') : raw;
	const numeric = typeof value === 'number';
	let text: string;
	if (options.format) text = formatPrintf(options.format, value, options.base);
	else if (numeric && options.powerForm) text = Number.isFinite(value) ? value.toExponential() : String(value);
	else text = String(value);
	return options.powerForm && numeric ? powerForm(text) : [text];
}

/** Exponential notation in `text` as mantissa × 10 with the exponent as a superscript. */
function powerForm(text: string): PrintedSegment[] {
	const match = /(\d+(?:\.\d*)?)[eE]([+-]?)(\d+)/.exec(text);
	if (!match) return [text];
	const [whole, mantissa, sign, digits] = match as unknown as [string, string, string, string];
	const exponent = `${sign === '-' ? '-' : ''}${digits.replace(/^0+(?=\d)/, '')}`;
	return [
		`${text.slice(0, match.index)}${mantissa} × 10`,
		{ superscript: exponent },
		...(match.index + whole.length < text.length ? [text.slice(match.index + whole.length)] : []),
	];
}

// ---------------------------------------------------------------------------------------------
// printf
// ---------------------------------------------------------------------------------------------

const CONVERSION = /%([-+ 0#]*)(\d+)?(?:\.(\d*))?(?:hh|h|ll|l|L|j|z|t)?([diouxXeEfFgGcs%])/g;

/** `format` with every conversion applied to `value`; `%i` is written in `base`. */
export function formatPrintf(format: string, value: unknown, base = 10): string {
	return format.replace(CONVERSION, (_match, flags: string, width?: string, precision?: string, conversion?: string) => {
		if (conversion === '%') return '%';
		const spec: ConversionSpec = {
			left: flags.includes('-'),
			plus: flags.includes('+'),
			space: flags.includes(' '),
			zero: flags.includes('0'),
			alternate: flags.includes('#'),
			width: width ? Number(width) : 0,
			...(precision !== undefined ? { precision: Number(precision || 0) } : {}),
		};
		return convert(conversion as string, spec, value, base);
	});
}

interface ConversionSpec {
	left: boolean;
	plus: boolean;
	space: boolean;
	zero: boolean;
	alternate: boolean;
	width: number;
	precision?: number;
}

function convert(conversion: string, spec: ConversionSpec, value: unknown, base: number): string {
	if (conversion === 's') {
		const text = String(value);
		return pad(spec.precision === undefined ? text : text.slice(0, spec.precision), spec, false);
	}
	if (conversion === 'c') {
		const text = typeof value === 'number' ? String.fromCharCode(value) : String(value).charAt(0);
		return pad(text, spec, false);
	}
	const number = typeof value === 'number' ? value : Number(value);
	if (typeof value === 'string' && (value.trim() === '' || Number.isNaN(number))) return pad(value, spec, false);

	const negative = number < 0;
	const magnitude = Math.abs(number);
	const sign = negative ? '-' : spec.plus ? '+' : spec.space ? ' ' : '';
	if (!Number.isFinite(magnitude)) {
		const text = Number.isNaN(magnitude) ? 'nan' : 'inf';
		return pad(sign + (/[A-Z]/.test(conversion) ? text.toUpperCase() : text), spec, false);
	}

	let digits: string;
	let prefix = '';
	switch (conversion) {
		case 'd':
		case 'i':
		case 'u':
		case 'o':
		case 'x':
		case 'X': {
			const radix = conversion === 'o' ? 8 : conversion === 'x' || conversion === 'X' ? 16 : conversion === 'i' ? base : 10;
			digits = Math.trunc(magnitude).toString(radix);
			if (spec.precision !== undefined) digits = spec.precision === 0 && digits === '0' ? '' : digits.padStart(spec.precision, '0');
			if (conversion === 'X') digits = digits.toUpperCase();
			if (spec.alternate && conversion === 'o' && !digits.startsWith('0')) digits = `0${digits}`;
			if (spec.alternate && (conversion === 'x' || conversion === 'X') && Math.trunc(magnitude) !== 0) {
				prefix = conversion === 'x' ? '0x' : '0X';
			}
			// C ignores the 0 flag for an integer conversion with a precision.
			return pad(sign + prefix + digits, { ...spec, zero: spec.zero && spec.precision === undefined }, true, sign.length + prefix.length);
		}
		case 'f':
		case 'F':
			digits = fixed(magnitude, spec.precision ?? 6, spec.alternate);
			break;
		case 'e':
		case 'E':
			digits = exponential(magnitude, spec.precision ?? 6, spec.alternate);
			break;
		default:
			digits = general(magnitude, spec.precision ?? 6, spec.alternate);
	}
	if (/[A-Z]/.test(conversion)) digits = digits.toUpperCase();
	return pad(sign + digits, spec, true, sign.length);
}

function fixed(magnitude: number, precision: number, alternate: boolean): string {
	const text = magnitude.toFixed(Math.min(precision, 100));
	return alternate && precision === 0 ? `${text}.` : text;
}

function exponential(magnitude: number, precision: number, alternate: boolean): string {
	const [mantissa, exponent] = magnitude.toExponential(Math.min(precision, 100)).split('e') as [string, string];
	const sign = exponent.startsWith('-') ? '-' : '+';
	const digits = exponent.replace(/^[+-]/, '').padStart(2, '0');
	return `${alternate && precision === 0 ? `${mantissa}.` : mantissa}e${sign}${digits}`;
}

/** `%g`: the shorter of `%e` and `%f` at `precision` significant digits, trailing zeros removed. */
function general(magnitude: number, precision: number, alternate: boolean): string {
	const significant = precision === 0 ? 1 : precision;
	const exponent = magnitude === 0 ? 0 : Number(magnitude.toExponential(significant - 1).split('e')[1]);
	const text =
		exponent < -4 || exponent >= significant
			? exponential(magnitude, significant - 1, alternate)
			: fixed(magnitude, significant - 1 - exponent, alternate);
	if (alternate) return text;
	const [body, exponentPart] = text.split('e') as [string, string | undefined];
	const trimmed = body.includes('.') ? body.replace(/0+$/, '').replace(/\.$/, '') : body;
	return exponentPart === undefined ? trimmed : `${trimmed}e${exponentPart}`;
}

/** `text` padded to the width; zero padding goes after the first `signLength` characters. */
function pad(text: string, spec: ConversionSpec, numeric: boolean, signLength = 0): string {
	if (text.length >= spec.width) return text;
	if (spec.left) return text.padEnd(spec.width, ' ');
	if (numeric && spec.zero) {
		return text.slice(0, signLength) + text.slice(signLength).padStart(spec.width - signLength, '0');
	}
	return text.padStart(spec.width, ' ');
}
