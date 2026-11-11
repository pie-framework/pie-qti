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

	it('matchTable requires an integer source: anything else is invalid, not a miss', () => {
		// The spec defines integer sources only (2.1: matchTable "transforms a source integer",
		// matchTableEntry@sourceValue [1]: integer; 3.0 lookupOutcomeValue: "Integer type is
		// required when the associated table is a matchTable"). The engine once fell back to a
		// string comparison for other base types; that leniency is gone.
		const table = {
			kind: 'table.matchTable' as const,
			defaultValue: 'none',
			entries: [{ sourceValue: '1', targetValue: 'one' }],
		};
		expect(applyLookupTable(qtiValue('string', 'single', '1'), table, 'identifier')).toMatchObject({ kind: 'invalid' });
		expect(applyLookupTable(qtiValue('float', 'single', 1), table, 'identifier')).toMatchObject({ kind: 'invalid' });
		expect(applyLookupTable(qtiValue('boolean', 'single', true), table, 'identifier')).toMatchObject({ kind: 'invalid' });
		expect(applyLookupTable(qtiValue('integer', 'multiple', [1]), table, 'identifier')).toMatchObject({ kind: 'invalid' });
	});
});