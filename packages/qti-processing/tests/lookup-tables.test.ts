import { describe, expect, it } from 'bun:test';
import { applyLookupTable } from '../src/eval/evaluator.js';
import type { InterpolationTableDef } from '../src/runtime/types.js';
import { qtiNull, qtiValue } from '../src/runtime/value.js';

const steps: InterpolationTableDef = {
	kind: 'table.interpolationTable',
	defaultValue: '0',
	entries: [
		{ sourceValue: 10, targetValue: '3' },
		{ sourceValue: 5, targetValue: '2', includeBoundary: false },
		{ sourceValue: 0, targetValue: '1' },
	],
};

describe('applyLookupTable', () => {
	it('interpolationTable steps through entries in document order and coerces to the target base type', () => {
		const at = (x: number) => applyLookupTable(qtiValue('float', 'single', x), steps, 'integer');
		expect(at(11)).toEqual(qtiValue('integer', 'single', 3));
		expect(at(10)).toEqual(qtiValue('integer', 'single', 3));
		expect(at(7.5)).toEqual(qtiValue('integer', 'single', 2));
		expect(at(5)).toEqual(qtiValue('integer', 'single', 1));
		expect(at(-1)).toEqual(qtiValue('integer', 'single', 0));
		expect(applyLookupTable(qtiValue('float', 'single', -1), { ...steps, defaultValue: undefined }, 'integer')).toEqual(
			qtiNull('integer', 'single'),
		);
	});

	it('matchTable keeps targets and defaultValue in the target base type', () => {
		const table = {
			kind: 'table.matchTable' as const,
			defaultValue: 'none',
			entries: [{ sourceValue: '1', targetValue: 'one' }],
		};
		expect(applyLookupTable(qtiValue('integer', 'single', 1), table, 'identifier')).toEqual(
			qtiValue('identifier', 'single', 'one'),
		);
		expect(applyLookupTable(qtiValue('integer', 'single', 2), table, 'identifier')).toEqual(
			qtiValue('identifier', 'single', 'none'),
		);
		expect(applyLookupTable(qtiNull('integer', 'single'), table, 'identifier')).toEqual(
			qtiValue('identifier', 'single', 'none'),
		);
	});
});
