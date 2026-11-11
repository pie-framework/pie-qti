import { describe, expect, test } from 'bun:test';
import { buildResponseProcessingAst } from '../src/ast/build.js';
import { execProgram } from '../src/exec/execute.js';
import { DeclarationContext } from '../src/runtime/context.js';
import { qtiValue } from '../src/runtime/value.js';
import { xsdPatternSource, xsdPatternToRegExp } from '../src/runtime/xsd-pattern.js';
import { parseXml } from '../src/xml/parse.js';

/** The compiled pattern; fails the test when it does not compile. */
const xsd = (pattern: string): RegExp => {
	const re = xsdPatternToRegExp(pattern);
	if (!re) throw new Error(`pattern did not compile: ${pattern}`);
	return re;
};

describe('xsdPatternToRegExp', () => {
	test('matches the whole string', () => {
		expect(xsdPatternToRegExp('[0-9]{3}')?.test('123')).toBe(true);
		expect(xsdPatternToRegExp('[0-9]{3}')?.test('12345')).toBe(false);
		expect(xsdPatternToRegExp('a|b')?.test('ab')).toBe(false);
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

// XML Schema Part 2 (Second Edition), appendix F — the regular expression language QTI cites for
// patternMatch and patternMask (QTI 2.1 info model; QTI 3.0 §5.48.4, §5.104). Section numbers
// below are appendix F's; the datatype patterns are the spec's own built-in type definitions.
describe('XSD regular expressions (XML Schema Part 2, appendix F)', () => {
	test('^ and $ are ordinary characters: an XSD pattern has no anchors (F [10] Char)', () => {
		expect(xsd('^[a-z]+$').test('^abc$')).toBe(true);
		expect(xsd('^[a-z]+$').test('abc')).toBe(false);
		expect(xsd('$[0-9]+').test('$5')).toBe(true);
		expect(xsd('[a^]+').test('^a')).toBe(true);
		expect(xsd('[^a]').test('b')).toBe(true);
		expect(xsd('[^a]').test('a')).toBe(false);
	});

	test('. is any character except newline and carriage return (F.1.1, WildcardEsc [^\\n\\r])', () => {
		expect(xsd('a.c').test('a\u2028c')).toBe(true);
		expect(xsd('a.c').test('a\u2029c')).toBe(true);
		expect(xsd('a.c').test('a\nc')).toBe(false);
		expect(xsd('a.c').test('a\rc')).toBe(false);
		expect(xsd('[.]').test('x')).toBe(false);
		expect(xsd('[.]').test('.')).toBe(true);
	});

	test('\\s is exactly space, tab, newline and carriage return; \\S the rest (F.1.1)', () => {
		expect(xsd('a\\sb').test('a b')).toBe(true);
		expect(xsd('a\\sb').test('a\tb')).toBe(true);
		expect(xsd('a\\sb').test('a\u00a0b')).toBe(false);
		expect(xsd('a\\sb').test('a\fb')).toBe(false);
		expect(xsd('a\\Sb').test('a\u00a0b')).toBe(true);
		expect(xsd('a\\Sb').test('a b')).toBe(false);
		expect(xsd('[\\s,]+').test(' ,\t')).toBe(true);
		expect(xsd('[\\s,]+').test('\u00a0')).toBe(false);
		// The spec's own pattern example (§2.5.1.2 list datatypes)
		expect(xsd('123 (\\d+\\s)*456').test('123 987 456')).toBe(true);
		expect(xsd('123 (\\d+\\s)*456').test('123 987\u00a0456')).toBe(false);
	});

	test('\\w is every character but punctuation, separators and other characters (F.1.1)', () => {
		// [#x0000-#x10FFFF]-[\p{P}\p{Z}\p{C}]: letters, marks, digits and symbols are word characters
		expect(xsd('\\w+').test('é߀٣+')).toBe(true);
		expect(xsd('\\w').test('_')).toBe(false);
		expect(xsd('\\w').test('-')).toBe(false);
		expect(xsd('\\w').test(' ')).toBe(false);
		expect(xsd('\\W').test('_')).toBe(true);
		expect(xsd('\\W').test('a')).toBe(false);
		expect(xsd('[\\w-]+').test('ab-cé')).toBe(true);
		expect(xsd('[\\w-]+').test('a b')).toBe(false);
	});

	test('\\i and \\c are XML name start and name characters, \\I and \\C the rest (F.1.1)', () => {
		expect(xsd('\\i').test(':')).toBe(true);
		expect(xsd('\\i').test('_')).toBe(true);
		expect(xsd('\\i').test('é')).toBe(true);
		expect(xsd('\\i').test('1')).toBe(false);
		expect(xsd('\\i').test('\u00b7')).toBe(false);
		expect(xsd('\\c').test('\u00b7')).toBe(true);
		expect(xsd('\\c').test('-')).toBe(true);
		expect(xsd('\\c').test(' ')).toBe(false);
		expect(xsd('\\I').test('1')).toBe(true);
		expect(xsd('\\I').test('a')).toBe(false);
		expect(xsd('\\C').test(' ')).toBe(true);
		expect(xsd('\\C').test('a')).toBe(false);
	});

	test('\\i and \\c read the XML 1.0 letter tables XSD 1.0 cites, not the later name ranges', () => {
		// U+02B0 is no XML 1.0 Letter, though XML 1.0 Fifth Edition's NameStartChar range has it
		expect(xsd('\\i').test('\u02b0')).toBe(false);
		expect(xsd('\\c').test('\u02b0')).toBe(false);
		// A combining mark (CombiningChar) and an Arabic-Indic digit (Digit) are name characters only
		expect(xsd('\\c').test('\u0483')).toBe(true);
		expect(xsd('\\i').test('\u0483')).toBe(false);
		expect(xsd('\\c').test('\u0663')).toBe(true);
		// Outside the Basic Multilingual Plane XML 1.0 has no letters
		expect(xsd('\\i').test('\u{20000}')).toBe(false);
	});

	test('the Name, NMTOKEN and NCName datatype patterns (§3.3.6, §3.3.4, §3.3.7)', () => {
		const name = xsd('\\i\\c*');
		expect(name.test('a:b-1.é')).toBe(true);
		expect(name.test('1abc')).toBe(false);
		const nmtoken = xsd('\\c+');
		expect(nmtoken.test('1abc')).toBe(true);
		expect(nmtoken.test('a b')).toBe(false);
		// Class subtraction of the colon from \i and \c
		const ncname = xsd('[\\i-[:]][\\c-[:]]*');
		expect(ncname.test('item-1')).toBe(true);
		expect(ncname.test('_x')).toBe(true);
		expect(ncname.test('a:b')).toBe(false);
		expect(ncname.test(':a')).toBe(false);
		expect(ncname.test('1a')).toBe(false);
	});

	test('[G-[C]] is character class subtraction (F.1 [16] charClassSub)', () => {
		expect(xsd('[a-z-[aeiou]]+').test('bcd')).toBe(true);
		expect(xsd('[a-z-[aeiou]]').test('a')).toBe(false);
		expect(xsd('[\\p{L}-[\\p{IsBasicLatin}]]+').test('éß')).toBe(true);
		expect(xsd('[\\p{L}-[\\p{IsBasicLatin}]]').test('a')).toBe(false);
		// Nested: a-z minus (aeiou minus u)
		expect(xsd('[a-z-[aeiou-[u]]]').test('u')).toBe(true);
		expect(xsd('[a-z-[aeiou-[u]]]').test('e')).toBe(false);
		// A negative group is subtracted from as a whole: (not abc) minus d
		expect(xsd('[^abc-[d]]').test('x')).toBe(true);
		expect(xsd('[^abc-[d]]').test('d')).toBe(false);
		expect(xsd('[^abc-[d]]').test('a')).toBe(false);
	});

	test('\\p{IsX} and \\P{IsX} are Unicode block escapes (F.1.1 [36], XSD block table)', () => {
		expect(xsd('\\p{IsBasicLatin}+').test('az~')).toBe(true);
		expect(xsd('\\p{IsBasicLatin}').test('\u007f')).toBe(true);
		expect(xsd('\\p{IsBasicLatin}').test('\u0080')).toBe(false);
		expect(xsd('\\P{IsBasicLatin}').test('é')).toBe(true);
		expect(xsd('\\P{IsBasicLatin}').test('a')).toBe(false);
		expect(xsd('\\p{IsGreek}+').test('αβγ')).toBe(true);
		expect(xsd('\\p{IsCJKUnifiedIdeographs}').test('中')).toBe(true);
		expect(xsd('[\\p{IsBasicLatin}\\p{IsLatin-1Supplement}]+').test('aé')).toBe(true);
		// Specials is listed twice in the table: #xFEFF and #xFFF0-#xFFFD
		expect(xsd('\\p{IsSpecials}').test('\ufeff')).toBe(true);
		expect(xsd('\\p{IsSpecials}').test('\ufffd')).toBe(true);
		expect(xsd('\\p{IsSpecials}').test('\ufff0')).toBe(true);
		expect(xsd('\\p{IsSpecials}').test('\ufefe')).toBe(false);
	});

	test('an unrecognized block name denotes every character (XSD 1.1 §G.4.2.4)', () => {
		expect(xsd('\\p{IsNoSuchBlock}').test('x')).toBe(true);
		expect(xsd('\\P{IsNoSuchBlock}').test('x')).toBe(true);
	});

	test('category escapes keep their Unicode meaning (F.1.1 catEsc)', () => {
		expect(xsd('\\p{Lu}+').test('ÀB')).toBe(true);
		expect(xsd('\\p{Lu}').test('a')).toBe(false);
		expect(xsd('\\P{L}').test('1')).toBe(true);
	});

	test('single character escapes, a hyphen included, match the character (F.1.1 SingleCharEsc)', () => {
		expect(xsd('a\\-b').test('a-b')).toBe(true);
		expect(xsd('[\\-+]?[0-9]+').test('-12')).toBe(true);
		expect(xsd('\\^\\.\\*').test('^.*')).toBe(true);
		expect(xsd('[a\\-z]+').test('a-z')).toBe(true);
		expect(xsd('[a\\-z]').test('b')).toBe(false);
	});

	test('the source compiles for the HTML pattern attribute (v flag)', () => {
		const html = (pattern: string) => new RegExp(`^(?:${xsdPatternSource(pattern)})$`, 'v');
		expect(html('[a-z-[aeiou]]+').test('bcd')).toBe(true);
		expect(html('[a-z-[aeiou]]+').test('bad')).toBe(false);
		expect(html('[\\w-]+').test('ab-c')).toBe(true);
		expect(html('[-a]+').test('-a')).toBe(true);
		expect(html('[a(){}|/,:]+').test('a(){}|/,:')).toBe(true);
		expect(html('[\\i-[:]][\\c-[:]]*').test('item-1')).toBe(true);
		expect(html('^x$').test('^x$')).toBe(true);
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
			{ ctx, rng: () => 0.5 },
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

	test('reads the pattern as an XSD regular expression', () => {
		expect(matches('[a-z-[aeiou]]+', 'bcd')).toMatchObject({ value: true });
		expect(matches('[a-z-[aeiou]]+', 'bad')).toMatchObject({ value: false });
		expect(matches('\\p{IsBasicLatin}+', 'abc')).toMatchObject({ value: true });
		expect(matches('\\p{IsBasicLatin}+', 'abé')).toMatchObject({ value: false });
		expect(matches('^abc$', 'abc')).toMatchObject({ value: false });
		expect(matches('\\w+', 'a_b')).toMatchObject({ value: false });
	});
});
