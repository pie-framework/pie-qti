import { describe, expect, it } from 'bun:test';
import { Qti2xElementNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import {
	parseInterpolationTableDeclaration,
	parseMatchTableDeclaration,
} from '../src/xml/lookupTable.js';
import { parseXml } from '../src/xml/parse.js';
import { findFirstDescendant } from '../src/xml/traverse.js';

const QTI2_MATCH_TABLE = `<matchTable defaultValue=" none ">
	<matchTableEntry sourceValue=" 1 " targetValue="low"/>
	<matchTableEntry sourceValue="2" targetValue=" high "/>
	<matchTableEntry sourceValue="3" targetValue=""/>
</matchTable>`;

const QTI2_INTERPOLATION_TABLE = `<interpolationTable defaultValue="F">
	<interpolationTableEntry sourceValue=" 90 " targetValue=" A "/>
	<interpolationTableEntry sourceValue="80" targetValue="B" includeBoundary="false"/>
	<interpolationTableEntry sourceValue="not-a-number" targetValue="X"/>
	<interpolationTableEntry sourceValue="50" targetValue="C"/>
</interpolationTable>`;

const el = (xml: string, name: string): Element => {
	const found = findFirstDescendant(parseXml(xml), name);
	if (!found) throw new Error(`fixture has no <${name}>`);
	return found;
};

describe('parseMatchTableDeclaration', () => {
	it('trims source, target and default values, keeping their lexical form', () => {
		const table = parseMatchTableDeclaration(el(QTI2_MATCH_TABLE, 'matchtable'), new Qti2xElementNameMapper());
		expect(table).toEqual({
			kind: 'table.matchTable',
			defaultValue: 'none',
			entries: [
				{ sourceValue: '1', targetValue: 'low' },
				{ sourceValue: '2', targetValue: 'high' },
				{ sourceValue: '3', targetValue: '' },
			],
		});
	});

	it('requires the mapper for the item version and reads QTI 3 entry spellings', () => {
		const qti3 = `<qti-match-table default-value="none">
			<qti-match-table-entry source-value="1" target-value="low"/>
		</qti-match-table>`;
		const table = parseMatchTableDeclaration(el(qti3, 'qti-match-table'), new Qti3ElementNameMapper());
		expect(table.entries).toEqual([{ sourceValue: '1', targetValue: 'low' }]);
		expect(table.defaultValue).toBe('none');
	});

	it('gives no defaultValue when the table declares none', () => {
		const table = parseMatchTableDeclaration(
			el('<matchTable><matchTableEntry sourceValue="1" targetValue="one"/></matchTable>', 'matchtable'),
			new Qti2xElementNameMapper(),
		);
		expect(table.defaultValue).toBeUndefined();
	});
});

describe('parseInterpolationTableDeclaration', () => {
	it('coerces numeric sources, keeps targets lexical, and drops non-numeric sources', () => {
		const table = parseInterpolationTableDeclaration(
			el(QTI2_INTERPOLATION_TABLE, 'interpolationtable'),
			new Qti2xElementNameMapper(),
		);
		expect(table).toEqual({
			kind: 'table.interpolationTable',
			defaultValue: 'F',
			entries: [
				{ sourceValue: 90, targetValue: 'A', includeBoundary: true },
				{ sourceValue: 80, targetValue: 'B', includeBoundary: false },
				{ sourceValue: 50, targetValue: 'C', includeBoundary: true },
			],
		});
	});
});
