/**
 * The QTI vocabularies against the 1EdTech schemas vendored in this repository: the QTI 2.2 schema
 * the generators emit against, and the QTI 3.0 ASI schema.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QTI3_HTML_ELEMENTS } from '../../element-mapper/qti2-to-qti3.js';
import {
	isQtiVocabularyElement,
	QTI2_ELEMENTS,
	QTI2_XHTML_ELEMENTS,
	QTI3_ELEMENTS,
} from '../vocabulary.js';

const PACKAGES = join(import.meta.dir, '..', '..', '..', '..');

function declaredElements(xsdPath: string): string[] {
	const xsd = readFileSync(xsdPath, 'utf8');
	return [...new Set([...xsd.matchAll(/<xs:element name="([A-Za-z0-9-]+)"/g)].map((m) => m[1] as string))].sort();
}

const qti22Declared = declaredElements(join(PACKAGES, 'to-pie', 'schemas', 'qti', 'imsqti_v2p2.xsd'));
const qti3Declared = declaredElements(join(PACKAGES, 'qti-common', 'schemas', 'qti3', 'imsqti_asiv3p0_v1p0.xsd'));

describe('QTI vocabularies against the schemas', () => {
	it('QTI 2.x vocabulary is exactly the QTI 2.2 schema element set', () => {
		expect(qti22Declared.length).toBeGreaterThan(200);
		expect([...QTI2_ELEMENTS, ...QTI2_XHTML_ELEMENTS].sort()).toEqual(qti22Declared);
	});

	it('QTI 3.0 vocabulary is exactly the QTI 3.0 ASI schema element set', () => {
		expect(qti3Declared.length).toBeGreaterThan(250);
		expect([...QTI3_ELEMENTS, ...QTI3_HTML_ELEMENTS].sort()).toEqual(qti3Declared);
	});

	it('accepts every declared name for its version', () => {
		expect(qti22Declared.filter((name) => !isQtiVocabularyElement(name, '2.x'))).toEqual([]);
		expect(qti3Declared.filter((name) => !isQtiVocabularyElement(name, '3.0'))).toEqual([]);
	});
});

describe('isQtiVocabularyElement', () => {
	it('compares names exactly, as XML does', () => {
		expect(isQtiVocabularyElement('choiceInteraction', '2.x')).toBe(true);
		expect(isQtiVocabularyElement('ChoiceInteraction', '2.x')).toBe(false);
		expect(isQtiVocabularyElement('choiceinteraction', '2.x')).toBe(false);
		expect(isQtiVocabularyElement('durationGTE', '2.x')).toBe(true);
		expect(isQtiVocabularyElement('durationGte', '2.x')).toBe(false);
	});

	it('keeps each version to its own vocabulary', () => {
		expect(isQtiVocabularyElement('qti-choice-interaction', '2.x')).toBe(false);
		expect(isQtiVocabularyElement('choiceInteraction', '3.0')).toBe(false);
		expect(isQtiVocabularyElement('infoControl', '2.x')).toBe(true);
		expect(isQtiVocabularyElement('contextDeclaration', '2.x')).toBe(false);
		expect(isQtiVocabularyElement('qti-context-declaration', '3.0')).toBe(true);
		// QTI 2.2 places HTML5 elements in its separate HTML5 namespace; QTI 3.0 admits them.
		expect(isQtiVocabularyElement('audio', '2.x')).toBe(false);
		expect(isQtiVocabularyElement('audio', '3.0')).toBe(true);
	});

	it('rejects unknown and prototype names', () => {
		for (const name of ['qti-foo-interaction', 'fooInteraction', 'constructor', 'toString', '']) {
			expect(isQtiVocabularyElement(name, '2.x')).toBe(false);
			expect(isQtiVocabularyElement(name, '3.0')).toBe(false);
		}
	});
});
