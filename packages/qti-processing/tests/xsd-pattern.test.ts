import { describe, expect, test } from 'bun:test';
import { buildResponseProcessingAst } from '../src/ast/build.js';
import { OperatorRegistry } from '../src/eval/operators.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import { qtiValue } from '../src/runtime/value.js';
import { xsdPatternSource, xsdPatternToRegExp } from '../src/runtime/xsd-pattern.js';
import { parseXml } from '../src/xml/parse.js';

describe('xsdPatternToRegExp', () => {
	test('matches the whole string', () => {
		expect(xsdPatternToRegExp('[0-9]{3}')?.test('123')).toBe(true);
		expect(xsdPatternToRegExp('[0-9]{3}')?.test('12345')).toBe(false);
		expect(xsdPatternToRegExp('a|b')?.test('ab')).toBe(false);
		expect(xsdPatternToRegExp('^[a-z]+$')?.test('abc')).toBe(true);
	});

	test('reads \\d as any decimal digit and \\D as anything else', () => {
		expect(xsdPatternToRegExp('\\d+')?.test('٣٤')).toBe(true);
		expect(xsdPatternToRegExp('[\\d.]+')?.test('۳.۵')).toBe(true);
		expect(xsdPatternToRegExp('\\D+')?.test('٣')).toBe(false);
		expect(xsdPatternToRegExp('[0-9]+')?.test('٣٤')).toBe(false);
	});

	test('gives a source the HTML pattern attribute compiles', () => {
		// The attribute compiles `^(?:source)$` with the v flag.
		const html = new RegExp(`^(?:${xsdPatternSource('\\d{2}')})$`, 'v');
		expect(html.test('٣٤')).toBe(true);
		expect(html.test('345')).toBe(false);
	});

	test('leaves an escaped backslash alone', () => {
		expect(xsdPatternSource('\\\\d')).toBe('\\\\d');
		expect(xsdPatternToRegExp('\\\\d')?.test('\\d')).toBe(true);
	});

	test('compiles patterns the u flag rejects without it', () => {
		expect(xsdPatternToRegExp('a\\-b')?.test('a-b')).toBe(true);
	});

	test('is null for a pattern that does not compile', () => {
		expect(xsdPatternToRegExp('(')).toBeNull();
	});
});

describe('patternMatch', () => {
	const matches = (pattern: string, response: string, template?: string) => {
		const ctx = new DeclarationContext({
			...(template === undefined
				? {}
				: {
						TPL: {
							identifier: 'TPL',
							baseType: 'string',
							cardinality: 'single',
							value: qtiValue('string', 'single', template),
						},
					}),
			RESPONSE: {
				identifier: 'RESPONSE',
				baseType: 'string',
				cardinality: 'single',
				value: qtiValue('string', 'single', response),
			},
			OUT: {
				identifier: 'OUT',
				baseType: 'boolean',
				cardinality: 'single',
				value: qtiValue('boolean', 'single', false),
			},
		});
		const body = `<setOutcomeValue identifier="OUT"><patternMatch pattern="${pattern}"><variable identifier="RESPONSE"/></patternMatch></setOutcomeValue>`;
		execProgram(
			{ ctx, ops: new OperatorRegistry(), rng: () => 0.5 },
			buildResponseProcessingAst(parseXml(`<responseProcessing>${body}</responseProcessing>`).documentElement, {}),
		);
		return ctx.getValue('OUT');
	};

	test('matches the whole response', () => {
		expect(matches('[0-9]{3}', '123')).toMatchObject({ value: true });
		expect(matches('[0-9]{3}', '12345')).toMatchObject({ value: false });
	});

	test('reads \\d as any decimal digit', () => {
		expect(matches('\\d+', '٣٤')).toMatchObject({ value: true });
	});

	test('reads a template variable reference', () => {
		expect(matches('{TPL}', 'ab1', '[a-z]+\\d')).toMatchObject({ value: true });
		expect(matches('{TPL}', 'ab', '[a-z]+\\d')).toMatchObject({ value: false });
	});

	test('is false for a pattern that does not compile', () => {
		expect(matches('(', 'x')).toMatchObject({ value: false });
	});
});
