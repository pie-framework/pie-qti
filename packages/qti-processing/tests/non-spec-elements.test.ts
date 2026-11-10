/**
 * The processing engine accepts only elements some QTI version defines. These names are
 * accepted by no version — no XSD element and no info-model operator/rule anywhere — so
 * building them throws like any unknown tag. (The names survived in earlier engine
 * versions as historical aliases; the removal is recorded in the legacy audit, class B.)
 */

import { describe, expect, it } from 'bun:test';
import { buildResponseProcessingAst } from '../src/ast/build.js';
import { parseXml } from '../src/xml/parse.js';

const REMOVED_EXPRESSIONS = [
	'isNotNull',
	'notEqual',
	'allN',
	'mean',
	'sampleVariance',
	'sampleSD',
	'popVariance',
	'popSD',
	'mod',
	'isTypeOf',
	'mapOutcome',
	'lookupTable',
	'record',
	'preCondition',
];

const REMOVED_STATEMENTS = ['setResponseValue'];

describe('processing rejects elements no QTI version defines', () => {
	for (const tag of REMOVED_EXPRESSIONS) {
		it(`rejects the <${tag}> expression`, () => {
			const xml = `<responseProcessing><setOutcomeValue identifier="X"><${tag}><baseValue baseType="integer">1</baseValue></${tag}></setOutcomeValue></responseProcessing>`;
			// The throw names the tag in its canonical (lowercase) spelling.
			expect(() => buildResponseProcessingAst(parseXml(xml).documentElement)).toThrow(
				`Unknown processing expression tag: <${tag.toLowerCase()}>`,
			);
		});
	}

	for (const tag of REMOVED_STATEMENTS) {
		it(`rejects the <${tag}> response rule`, () => {
			const xml = `<responseProcessing><${tag} identifier="X"><baseValue baseType="integer">1</baseValue></${tag}></responseProcessing>`;
			expect(() => buildResponseProcessingAst(parseXml(xml).documentElement)).toThrow(
				`Unknown processing statement tag: <${tag.toLowerCase()}> (mode=response)`,
			);
		});
	}

	it('rejects the <mean> statistics alias but keeps it on statsOperator', () => {
		const xml = '<responseProcessing><setOutcomeValue identifier="X"><statsOperator name="mean"><variable identifier="V"/></statsOperator></setOutcomeValue></responseProcessing>';
		expect(() => buildResponseProcessingAst(parseXml(xml).documentElement)).not.toThrow();
	});
});
