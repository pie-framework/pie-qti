/**
 * Canonical XML helpers shared across the conversion packages
 *
 * The catalog-idref grammar and XML escaping each used to live in three copies
 * (qti-common, to-pie, pie-to-qti2) that had already drifted — notably, the
 * exporter parsed idrefs with a different grammar than the importer wrote.
 */

import { describe, expect, test } from 'bun:test';
import { CATALOG_IDREF_PATTERN, catalogIdrefFromMatch, escapeXmlAttribute, escapeText } from '../accessibility/index.js';

describe('escapeXmlAttribute', () => {
	test('escapes markup-significant characters and both quote styles', () => {
		expect(escapeXmlAttribute(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
	});

	test('result is safe inside double- and single-quoted attributes', () => {
		const value = `say "hi" & <leave> it's`;
		const escaped = escapeXmlAttribute(value);
		expect(escaped).not.toMatch(/[<>"']/);
		expect(`<x a="${escaped}" a2='${escaped}'/>`).toBe(`<x a="say &quot;hi&quot; &amp; &lt;leave&gt; it&apos;s" a2='say &quot;hi&quot; &amp; &lt;leave&gt; it&apos;s'/>`);
	});

	test('escapeText stays text-scoped (no quote escaping)', () => {
		expect(escapeText(`a"b'c`)).toBe(`a"b'c`);
	});
});

describe('CATALOG_IDREF_PATTERN / catalogIdrefFromMatch', () => {
	test('matches double-quoted, single-quoted, and bare values', () => {
		const markup = [
			`<span data-catalog-idref="cat-1">a</span>`,
			`<span data-catalog-idref='cat-2'>b</span>`,
			`<span data-catalog-idref=cat-3>c</span>`,
		].join('');
		const idrefs = [...markup.matchAll(CATALOG_IDREF_PATTERN)].map(catalogIdrefFromMatch);
		expect(idrefs).toEqual(['cat-1', 'cat-2', 'cat-3']);
	});

	test('does not match lookalike attributes or attribute-name substrings', () => {
		const markup = `<span data-x-catalog-idref="nope" data-catalog-idrefs="nope2">x</span>`;
		expect([...markup.matchAll(CATALOG_IDREF_PATTERN)]).toHaveLength(0);
	});
});
