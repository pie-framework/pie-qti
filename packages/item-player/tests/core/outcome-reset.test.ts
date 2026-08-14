import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

describe('Player.processResponses()', () => {
	test('resets outcome variables to their defaults before each run', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="reset-outcomes" title="Reset Outcomes" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Dummy</p></itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <baseValue baseType="identifier">A</baseValue>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="integer">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <!-- intentionally does not set SCORE -->
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

		const p = new Player({ itemXml, seed: 1, role: 'candidate' });

		p.setResponses({ RESPONSE: 'A' });
		expect(p.processResponses().outcomeValues.SCORE).toBe(1);

		p.setResponses({ RESPONSE: 'B' });
		const r2 = p.processResponses();
		expect(r2.outcomeValues.SCORE).toBe(0);
		expect(r2.score).toBe(0);
	});
});

/**
 * QTI 2.1 §5.2: an outcome declared without a <defaultValue> initializes to NULL unless it is of a
 * numeric type, in which case it initializes to 0.
 */
describe('numeric outcome variables with no declared default', () => {
	const itemWith = (declarations: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="implied-defaults" title="Implied defaults" adaptive="false" timeDependent="false">
  ${declarations}
  <itemBody><p>Dummy</p></itemBody>
</assessmentItem>`;

	test('float and integer outcomes initialize to 0, other base types to NULL', () => {
		const p = new Player({
			itemXml: itemWith(`
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <outcomeDeclaration identifier="TALLY" cardinality="single" baseType="integer"/>
  <outcomeDeclaration identifier="GRADE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="PASSED" cardinality="single" baseType="boolean"/>`),
		});
		const decls = p.getDeclarations();

		expect(decls.SCORE.value).toEqual({ kind: 'value', baseType: 'float', cardinality: 'single', value: 0 });
		expect(decls.TALLY.value).toEqual({ kind: 'value', baseType: 'integer', cardinality: 'single', value: 0 });
		expect(decls.GRADE.value.kind).toBe('null');
		expect(decls.PASSED.value.kind).toBe('null');
	});

	test('an authored default wins, and is not marked as implied', () => {
		const p = new Player({
			itemXml: itemWith(`
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>3.5</value></defaultValue>
  </outcomeDeclaration>`),
		});
		const decls = p.getDeclarations();

		expect(decls.SCORE.value).toMatchObject({ kind: 'value', value: 3.5 });
		expect(decls.SCORE.impliedNumericDefault).toBe(false);
	});

	test('response variables keep NULL so an unanswered numeric response stays distinguishable from 0', () => {
		const p = new Player({
			itemXml: itemWith(`
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>`),
		});
		const decls = p.getDeclarations();

		expect(decls.RESPONSE.value.kind).toBe('null');
		expect(decls.RESPONSE.impliedNumericDefault).toBe(false);
		expect(decls.SCORE.impliedNumericDefault).toBe(true);
	});

	test('multiple-cardinality numeric outcomes are not given a scalar 0', () => {
		const p = new Player({
			itemXml: itemWith('<outcomeDeclaration identifier="SCORES" cardinality="multiple" baseType="float"/>'),
		});

		expect(p.getDeclarations().SCORES.value.kind).toBe('null');
	});
});

describe('MAXSCORE declared without a default', () => {
	const itemWith = (maxScoreDeclaration: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="bare-maxscore" title="Bare MAXSCORE" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  ${maxScoreDeclaration}
  <itemBody><p>Dummy</p></itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

	function captureWarnings(run: () => void): string[] {
		const warnings: string[] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(' '));
		};
		try {
			run();
		} finally {
			console.warn = original;
		}
		return warnings;
	}

	test('reports 0 as the maximum and warns once, naming the item', () => {
		let result: { maxScore: number } | undefined;
		const warnings = captureWarnings(() => {
			const p = new Player({
				itemXml: itemWith('<outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float"/>'),
			});
			result = p.processResponses();
			p.processResponses();
		});

		expect(result?.maxScore).toBe(0);
		const maxScoreWarnings = warnings.filter((w) => w.includes('MAXSCORE is 0'));
		expect(maxScoreWarnings).toHaveLength(1);
		expect(maxScoreWarnings[0]).toContain('bare-maxscore');
	});

	test('stays silent when MAXSCORE carries an authored default', () => {
		const warnings = captureWarnings(() => {
			const p = new Player({
				itemXml: itemWith(`<outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>`),
			});
			p.processResponses();
		});

		expect(warnings.filter((w) => w.includes('MAXSCORE is 0'))).toHaveLength(0);
	});

	test('undeclared MAXSCORE still falls back to a maximum of 1', () => {
		const warnings = captureWarnings(() => {
			const p = new Player({ itemXml: itemWith('') });
			expect(p.processResponses().maxScore).toBe(1);
		});

		expect(warnings.filter((w) => w.includes('MAXSCORE is 0'))).toHaveLength(0);
	});
});


