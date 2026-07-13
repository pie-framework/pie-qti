import type { ExtendedTextInteractionData } from '../shared/types.js';

export const EXTENDED_TEXT_RECORD_FIELD_TYPES = {
	stringValue: 'string',
	floatValue: 'float',
	integerValue: 'integer',
	leftDigits: 'integer',
	rightDigits: 'integer',
	ndp: 'integer',
	nsf: 'integer',
	exponent: 'integer',
} as const;

export type ExtendedTextRecordField = keyof typeof EXTENDED_TEXT_RECORD_FIELD_TYPES;

/** Public/plain representation of the numeric-detail record defined by QTI. */
export interface ExtendedTextNumericRecord {
	stringValue: string;
	floatValue: number | null;
	integerValue: number | null;
	leftDigits: number | null;
	rightDigits: number | null;
	ndp: number | null;
	nsf: number | null;
	exponent: number | null;
}

interface ParsedNumericString {
	valid: boolean;
	value: number | null;
	integerValue: number | null;
	leftDigits: number | null;
	rightDigits: number | null;
	ndp: number | null;
	nsf: number | null;
	exponent: number | null;
}

function digitValue(character: string): number {
	const code = character.toUpperCase().charCodeAt(0);
	if (code >= 48 && code <= 57) return code - 48;
	if (code >= 65 && code <= 90) return code - 65 + 10;
	return -1;
}

function parseDigits(text: string, base: number): number | null {
	let value = 0;
	for (const character of text) {
		const digit = digitValue(character);
		if (digit < 0 || digit >= base) return null;
		value = value * base + digit;
	}
	return value;
}

/**
 * Parse the lexical numeric response used by QTI string interactions.
 *
 * An exponent is recognized for base 10. For other bases, letters such as E
 * are digits and therefore cannot unambiguously introduce an exponent.
 */
function parseNumericString(input: string, base: number): ParsedNumericString {
	if (!Number.isInteger(base) || base < 2 || base > 36) {
		return {
			valid: false,
			value: null,
			integerValue: null,
			leftDigits: null,
			rightDigits: null,
			ndp: null,
			nsf: null,
			exponent: null,
		};
	}

	const lexical = input.trim();
	const match = base === 10
		? /^([+-]?)([0-9]*)(?:\.([0-9]*))?(?:[eE]([+-]?\d+))?$/.exec(lexical)
		: /^([+-]?)([0-9A-Za-z]*)(?:\.([0-9A-Za-z]*))?$/.exec(lexical);
	const left = match?.[2] ?? '';
	const right = match?.[3] ?? '';
	if (!match || left.length + right.length === 0) {
		return {
			valid: false,
			value: null,
			integerValue: null,
			leftDigits: null,
			rightDigits: null,
			ndp: null,
			nsf: null,
			exponent: null,
		};
	}

	const leftValue = parseDigits(left || '0', base);
	const rightValue = parseDigits(right || '0', base);
	if (leftValue === null || rightValue === null) {
		return {
			valid: false,
			value: null,
			integerValue: null,
			leftDigits: null,
			rightDigits: null,
			ndp: null,
			nsf: null,
			exponent: null,
		};
	}

	const exponent = match[4] === undefined ? null : Number.parseInt(match[4], 10);
	const sign = match[1] === '-' ? -1 : 1;
	const significand = leftValue + rightValue / base ** right.length;
	const value = base === 10
		? Number(lexical)
		: sign * significand * base ** (exponent ?? 0);
	if (!Number.isFinite(value)) {
		return {
			valid: false,
			value: null,
			integerValue: null,
			leftDigits: null,
			rightDigits: null,
			ndp: null,
			nsf: null,
			exponent,
		};
	}

	const allDigits = `${left}${right}`;
	const withoutLeadingZeroes = allDigits.replace(/^0+/, '');
	const nsf = withoutLeadingZeroes.length > 0 ? withoutLeadingZeroes.length : 1;
	return {
		valid: true,
		value,
		integerValue: right.length === 0 && exponent === null ? value : null,
		leftDigits: left.length,
		rightDigits: right.length,
		ndp: Math.max(0, right.length - (exponent ?? 0)),
		nsf,
		exponent,
	};
}

/** Build the eight-field numeric detail record mandated by QTI. */
export function createExtendedTextNumericRecord(input: string, base = 10): ExtendedTextNumericRecord {
	const parsed = parseNumericString(input, base);
	return {
		stringValue: input,
		floatValue: parsed.value,
		integerValue: parsed.integerValue,
		leftDigits: parsed.leftDigits,
		rightDigits: parsed.rightDigits,
		ndp: parsed.ndp,
		nsf: parsed.nsf,
		exponent: parsed.exponent,
	};
}

function unwrapRecordStringValue(value: unknown): unknown {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
	const field = (value as Record<string, unknown>).stringValue;
	if (field && typeof field === 'object' && 'kind' in field) {
		return (field as { kind: string; value?: unknown }).kind === 'value'
			? (field as { value?: unknown }).value
			: '';
	}
	return field;
}

/** Convert the current public response value into editor strings. */
export function extendedTextResponseToStrings(
	response: unknown,
	interaction: Pick<ExtendedTextInteractionData, 'cardinality' | 'base'>,
): string[] {
	if (interaction.cardinality === 'record') {
		const raw = unwrapRecordStringValue(response);
		return [raw === null || raw === undefined ? '' : String(raw)];
	}
	if (Array.isArray(response)) {
		return response.length > 0 ? response.map((value) => String(value ?? '')) : [''];
	}
	if (response === null || response === undefined) return [''];
	if (typeof response === 'number' && interaction.base !== 10 && Number.isInteger(response)) {
		return [response.toString(interaction.base)];
	}
	return [String(response)];
}

function numericValue(input: string, interaction: Pick<ExtendedTextInteractionData, 'base' | 'baseType'>): number | null {
	const parsed = parseNumericString(input, interaction.base);
	if (!parsed.valid || parsed.value === null) return null;
	if (interaction.baseType === 'integer') {
		return parsed.integerValue;
	}
	return parsed.value;
}

function hasMeaningfulString(value: string, format?: string): boolean {
	const comparable = format === 'xhtml'
		? value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ')
		: value;
	return comparable.trim().length > 0;
}

/** Convert editor strings into the public response shape for the declaration. */
export function createExtendedTextResponse(
	strings: string[],
	interaction: Pick<ExtendedTextInteractionData, 'cardinality' | 'baseType' | 'base'> &
		Partial<Pick<ExtendedTextInteractionData, 'format'>>,
): string | number | Array<string | number> | ExtendedTextNumericRecord | null {
	const nonEmpty = strings.filter((value) => hasMeaningfulString(value, interaction.format));
	if (interaction.cardinality === 'record') {
		return nonEmpty.length === 0 ? null : createExtendedTextNumericRecord(nonEmpty[0]!, interaction.base);
	}

	const values = nonEmpty
		.map((value) => {
			if (interaction.baseType === 'integer' || interaction.baseType === 'float') {
				return numericValue(value, interaction);
			}
			return value;
		})
		.filter((value): value is string | number => value !== null);

	if (interaction.cardinality === 'multiple' || interaction.cardinality === 'ordered') return values;
	return values[0] ?? null;
}

/** Raw companion response captured by stringIdentifier. */
export function createExtendedTextStringResponse(
	strings: string[],
	cardinality: ExtendedTextInteractionData['cardinality'],
	format?: string,
): string | string[] | null {
	const nonEmpty = strings.filter((value) => hasMeaningfulString(value, format));
	if (cardinality === 'multiple' || cardinality === 'ordered') return nonEmpty;
	return nonEmpty[0] ?? null;
}
