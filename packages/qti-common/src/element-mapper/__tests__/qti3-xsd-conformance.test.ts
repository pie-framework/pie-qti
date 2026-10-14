/**
 * The QTI 3 element map against the 1EdTech QTI 3.0 ASI schema vendored in `schemas/qti3/`,
 * and against the QTI 2.2 vocabulary the generators emit.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Qti3ElementNameMapper } from '../Qti3ElementNameMapper.js';
import { isQti3Element, QTI3_ELEMENT_MAPPINGS } from '../qti3-element-mappings.js';

const PACKAGES = join(import.meta.dir, '..', '..', '..', '..');

function declaredElements(xsdPath: string): Set<string> {
	const xsd = readFileSync(xsdPath, 'utf8');
	return new Set([...xsd.matchAll(/<xs:element name="([A-Za-z0-9-]+)"/g)].map((m) => m[1] as string));
}

const qti3Names = [
	...declaredElements(join(PACKAGES, 'qti-common', 'schemas', 'qti3', 'imsqti_asiv3p0_v1p0.xsd')),
].filter((name) => name.startsWith('qti-'));

/** XHTML elements QTI 2.2 declares in its own namespace; QTI 3 keeps them unprefixed. */
const XHTML = new Set(
	(
		'a abbr acronym address b bdo big blockquote br caption cite code col colgroup dd dfn div dl dt em ' +
		'h1 h2 h3 h4 h5 h6 hr i img kbd label li object ol p param pre q samp small span strong sub sup ' +
		'table tbody td tfoot th thead tr tt ul var'
	).split(' '),
);

/** QTI 2.2 elements QTI 3.0 removed. */
const REMOVED_IN_QTI3 = new Set(['infoControl']);

const qti22Names = [...declaredElements(join(PACKAGES, 'to-pie', 'schemas', 'qti', 'imsqti_v2p2.xsd'))].filter(
	(name) => !XHTML.has(name) && !REMOVED_IN_QTI3.has(name),
);

describe('QTI 3 element map against the QTI 3.0 schema', () => {
	const mapper = new Qti3ElementNameMapper();

	it('reads the schema vocabulary', () => {
		expect(qti3Names.length).toBeGreaterThan(200);
	});

	it('maps every qti-* element the schema declares, in both directions', () => {
		const unmapped = qti3Names.filter(
			(name) => !isQti3Element(name) || mapper.toNative(mapper.toCanonical(name)) !== name,
		);
		expect(unmapped).toEqual([]);
	});

	it('maps no element the schema does not declare', () => {
		const declared = new Set(qti3Names);
		expect(Object.keys(QTI3_ELEMENT_MAPPINGS).filter((name) => !declared.has(name))).toEqual([]);
	});

	it('gives every QTI 2.2 element its QTI 3.0 name', () => {
		const declared = new Set(qti3Names);
		const missing = qti22Names.filter((name) => !declared.has(mapper.toNative(name.toLowerCase())));
		expect(qti22Names.length).toBeGreaterThan(150);
		expect(missing).toEqual([]);
	});
});
