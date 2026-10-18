import { describe, expect, test } from 'bun:test';
import { qtiNull, qtiValue } from '@pie-qti/qti-processing';
import {
	formatPrintf,
	type PrintedVariableOptions,
	printVariable,
} from '../../src/document/printedVariable.js';

const defaults: PrintedVariableOptions = { base: 10, powerForm: false, delimiter: ';', mappingIndicator: '=' };
const print = (value: Parameters<typeof printVariable>[0], options: Partial<PrintedVariableOptions> = {}) =>
	printVariable(value, { ...defaults, ...options });

describe('formatPrintf', () => {
	test('integer conversions', () => {
		expect(formatPrintf('%d', 42)).toBe('42');
		expect(formatPrintf('%5d|%-5d|%05d', -42)).toBe('  -42|-42  |-0042');
		expect(formatPrintf('%+d % d', 7)).toBe('+7  7');
		expect(formatPrintf('%.4d', 7)).toBe('0007');
		expect(formatPrintf('%d', 3.9)).toBe('3');
		expect(formatPrintf('%x %X %#x %o %#o', 255)).toBe('ff FF 0xff 377 0377');
		expect(formatPrintf('%i', 255, 2)).toBe('11111111');
		expect(formatPrintf('%d', 255, 2)).toBe('255');
	});

	test('floating-point conversions', () => {
		expect(formatPrintf('%f', 1.23456)).toBe('1.234560');
		expect(formatPrintf('%.2f', 1.23456)).toBe('1.23');
		expect(formatPrintf('%8.3f|%-8.1f|%08.2f', -2.5)).toBe('  -2.500|-2.5    |-0002.50');
		expect(formatPrintf('%.0f %#.0f', 2)).toBe('2 2.');
		expect(formatPrintf('%e', 1234.5)).toBe('1.234500e+03');
		expect(formatPrintf('%.2E', 0.000123)).toBe('1.23E-04');
		expect([100000, 1000000, 0.0001, 0.00001234].map((n) => formatPrintf('%g', n))).toEqual([
			'100000',
			'1e+06',
			'0.0001',
			'1.234e-05',
		]);
		expect(formatPrintf('%.3g', 1.23456)).toBe('1.23');
		expect(formatPrintf('%G', 1e-10)).toBe('1E-10');
		expect(formatPrintf('%#g', 1.5)).toBe('1.50000');
		expect(formatPrintf('%f %F', Number.POSITIVE_INFINITY)).toBe('inf INF');
	});

	test('strings, characters, literals and length modifiers', () => {
		expect(formatPrintf('[%s] [%5s] [%-5s] [%.2s]', 'abc')).toBe('[abc] [  abc] [abc  ] [ab]');
		expect(formatPrintf('%c', 65)).toBe('A');
		expect(formatPrintf('%d%% of %ld', 50)).toBe('50% of 50');
		expect(formatPrintf('%d', 'n/a')).toBe('n/a');
		expect(formatPrintf('value', 1)).toBe('value');
	});
});

describe('printVariable', () => {
	test('prints a single value by base type, NULL as nothing', () => {
		expect(print(qtiValue('integer', 'single', 7))).toEqual(['7']);
		expect(print(qtiValue('boolean', 'single', true))).toEqual(['true']);
		expect(print(qtiValue('pair', 'single', 'A B'))).toEqual(['A B']);
		expect(print(qtiNull('float', 'single'))).toEqual([]);
	});

	test('joins containers by delimiter and indexes ordered values from 1', () => {
		const ordered = qtiValue('integer', 'ordered', [10, 20, 30]);
		expect(print(ordered).join('')).toBe('10;20;30');
		expect(print(ordered, { delimiter: ', ', format: '%.1f' }).join('')).toBe('10.0, 20.0, 30.0');
		expect(print(ordered, { index: 2 })).toEqual(['20']);
		expect(print(ordered, { index: 4 })).toEqual([]);
		expect(print(qtiValue('identifier', 'multiple', ['a', 'b']), { index: 1 }).join('')).toBe('a;b');
	});

	test('prints a record field, or every field with the mapping indicator', () => {
		const record = qtiValue(undefined, 'record', {
			mass: qtiValue('float', 'single', 2.5),
			unit: qtiValue('string', 'single', 'kg'),
		});
		expect(print(record, { field: 'mass', format: '%.2f' })).toEqual(['2.50']);
		expect(print(record, { field: 'missing' })).toEqual([]);
		expect(print(record).join('')).toBe('mass=2.5;unit=kg');
		expect(print(record, { mappingIndicator: ': ', delimiter: ', ' }).join('')).toBe('mass: 2.5, unit: kg');
	});

	test('writes power form with a superscript exponent', () => {
		expect(print(qtiValue('float', 'single', 123456), { format: '%.2e', powerForm: true })).toEqual([
			'1.23 × 10',
			{ superscript: '5' },
		]);
		expect(print(qtiValue('float', 'single', 0.00042), { powerForm: true })).toEqual([
			'4.2 × 10',
			{ superscript: '-4' },
		]);
		expect(print(qtiValue('float', 'single', 12.5), { format: '%.1f', powerForm: true })).toEqual(['12.5']);
		expect(print(qtiValue('string', 'single', '1e5'), { powerForm: true })).toEqual(['1e5']);
	});
});
