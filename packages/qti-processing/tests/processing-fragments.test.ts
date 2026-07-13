import { describe, expect, it } from 'bun:test';
import { buildResponseProcessingAst } from '../src/ast/build.js';
import { execProgram } from '../src/exec/execute.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { DeclarationContext } from '../src/runtime/context.js';
import type { DeclarationMap } from '../src/runtime/types.js';
import { qtiValue } from '../src/runtime/value.js';
import { parseXml } from '../src/xml/parse.js';

const XI = 'http://www.w3.org/2001/XInclude';

function responseProcessing(body: string): Element {
	return parseXml(`<responseProcessing xmlns:xi="${XI}">${body}</responseProcessing>`).documentElement;
}

function scoreDeclarations(): DeclarationMap {
	return {
		SCORE: {
			identifier: 'SCORE',
			baseType: 'float',
			cardinality: 'single',
			defaultValue: qtiValue('float', 'single', 0),
			value: qtiValue('float', 'single', 0),
		},
	};
}

describe('external QTI processing fragments', () => {
	it('resolves and executes xi:include through a host-owned resolver', () => {
		const requests: string[] = [];
		const program = buildResponseProcessingAst(
			responseProcessing('<xi:include href="processing/score.xml"/>'),
			{
				resolveProcessingFragment: (request) => {
					requests.push(`${request.mode}:${request.href}:${request.depth}`);
					return [
						'<responseProcessingFragment>',
						'<setOutcomeValue identifier="SCORE">',
						'<baseValue baseType="float">1</baseValue>',
						'</setOutcomeValue>',
						'</responseProcessingFragment>',
					].join('');
				},
			},
		);
		const ctx = new DeclarationContext(scoreDeclarations());

		execProgram({ ctx, ops: new OperatorRegistry(), rng: () => 0.5 }, program);

		expect(requests).toEqual(['response:processing/score.xml:0']);
		expect(ctx.getValue('SCORE')).toEqual(qtiValue('float', 'single', 1));
	});

	it('uses xi:fallback only when the host cannot resolve the fragment', () => {
		const program = buildResponseProcessingAst(
			responseProcessing([
				'<xi:include href="missing.xml">',
				'<xi:fallback>',
				'<setOutcomeValue identifier="SCORE"><baseValue baseType="float">2</baseValue></setOutcomeValue>',
				'</xi:fallback>',
				'</xi:include>',
			].join('')),
			{ resolveProcessingFragment: () => null },
		);
		const ctx = new DeclarationContext(scoreDeclarations());

		execProgram({ ctx, ops: new OperatorRegistry(), rng: () => 0.5 }, program);

		expect(ctx.getValue('SCORE')).toEqual(qtiValue('float', 'single', 2));
	});

	it('fails clearly when no host resolver or fallback is available', () => {
		expect(() =>
			buildResponseProcessingAst(responseProcessing('<xi:include href="score.xml"/>')),
		).toThrow('no resolveProcessingFragment host callback was provided');
	});

	it('rejects circular includes and cumulative resolver output beyond the configured limit', () => {
		const circular = () =>
			buildResponseProcessingAst(responseProcessing('<xi:include href="a.xml"/>'), {
				resolveProcessingFragment: () =>
					`<responseProcessingFragment xmlns:xi="${XI}"><xi:include href="a.xml"/></responseProcessingFragment>`,
			});
		expect(circular).toThrow('Circular QTI processing fragment include');

		expect(() =>
			buildResponseProcessingAst(responseProcessing('<xi:include href="large.xml"/>'), {
				resolveProcessingFragment: () =>
					'<responseProcessingFragment><setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue></responseProcessingFragment>',
				maxProcessingFragmentCharacters: 32,
			}),
		).toThrow('cumulative characters');
	});

	it('rejects a fragment whose processing mode does not match the include site', () => {
		expect(() =>
			buildResponseProcessingAst(responseProcessing('<xi:include href="outcomes.xml"/>'), {
				resolveProcessingFragment: () => '<outcomeProcessingFragment/>',
			}),
		).toThrow('included from responseProcessing');
	});
});
