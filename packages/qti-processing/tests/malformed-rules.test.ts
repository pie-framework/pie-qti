/**
 * Malformed processing rules fail loudly. identifier and expression [1] are required on
 * setOutcomeValue, setTemplateValue, setCorrectResponse, setDefaultValue (QTI 2.1
 * setOutcomeValue.Type and its template siblings, carried into 2.2 and 3.0) and
 * lookupOutcomeValue; the module's convention is to throw on unhandled or malformed rules —
 * silently skipping a broken rule would leave the outcome at its default and change scoring
 * with no signal. (The engine once dropped these rules silently.)
 */

import { describe, expect, it } from 'bun:test';
import {
	buildOutcomeProcessingAst,
	buildResponseProcessingAst,
	buildTemplateProcessingAst,
} from '../src/ast/build.js';
import { parseXml } from '../src/xml/parse.js';

const RULES = [
	{
		tag: 'setOutcomeValue',
		build: (rule: string) => () => buildResponseProcessingAst(parseXml(`<responseProcessing>${rule}</responseProcessing>`).documentElement, {}),
	},
	{
		tag: 'lookupOutcomeValue',
		build: (rule: string) => () => buildOutcomeProcessingAst(parseXml(`<outcomeProcessing>${rule}</outcomeProcessing>`).documentElement, {}),
	},
	{
		tag: 'setTemplateValue',
		build: (rule: string) => () => buildTemplateProcessingAst(parseXml(`<templateProcessing>${rule}</templateProcessing>`).documentElement, {}),
	},
	{
		tag: 'setCorrectResponse',
		build: (rule: string) => () => buildTemplateProcessingAst(parseXml(`<templateProcessing>${rule}</templateProcessing>`).documentElement, {}),
	},
	{
		tag: 'setDefaultValue',
		build: (rule: string) => () => buildTemplateProcessingAst(parseXml(`<templateProcessing>${rule}</templateProcessing>`).documentElement, {}),
	},
];

describe('a processing rule without identifier or expression throws instead of no-oping', () => {
	for (const { tag, build } of RULES) {
		it(`<${tag}> without an identifier throws`, () => {
			expect(build(`<${tag}><baseValue baseType="integer">1</baseValue></${tag}>`)).toThrow(
				`<${tag}> requires an identifier and one child expression`,
			);
		});

		it(`<${tag}> without a child expression throws`, () => {
			expect(build(`<${tag} identifier="SCORE"></${tag}>`)).toThrow(
				`<${tag}> requires an identifier and one child expression`,
			);
		});

		it(`<${tag}> with identifier and expression builds`, () => {
			expect(build(`<${tag} identifier="SCORE"><baseValue baseType="integer">1</baseValue></${tag}>`)).not.toThrow();
		});
	}
});
