/**
 * The on-screen keyboard a text entry requests: numeric only when the authored
 * patternMask proves the answer cannot be negative, because phone number pads
 * have no minus key (nor an exponent).
 */

import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { patternExcludesMinus, textEntryInputMode } from '../../src/interactions/text-entry/inputMode.js';
import type { TextEntryInteractionData } from '../../src/interactions/shared/types.js';

describe('textEntryInputMode', () => {
	test('without a patternMask no numeric keyboard can be proven: keep the text keyboard', () => {
		expect(textEntryInputMode({ baseType: 'integer', patternMask: null })).toBeUndefined();
		expect(textEntryInputMode({ baseType: 'float', patternMask: null })).toBeUndefined();
		// @ts-expect-error -- an absent patternMask from an untyped caller is treated like none.
		expect(textEntryInputMode({ baseType: 'integer', patternMask: undefined })).toBeUndefined();
	});

	test('a patternMask that excludes minus proves a numeric keyboard', () => {
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '^[0-9]+$' })).toBe('numeric');
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '[0-9]{1,3}' })).toBe('numeric');
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '\\d+' })).toBe('numeric');
		expect(textEntryInputMode({ baseType: 'float', patternMask: '[0-9]+([.][0-9]+)?' })).toBe('decimal');
	});

	// A declared non-decimal base needs letters (hex `A`–`F`) or leading zeros (binary),
	// which number pads cannot type: keep the text keyboard.
	test('a declared non-decimal base keeps the text keyboard', () => {
		expect(
			textEntryInputMode({ baseType: 'integer', patternMask: '^[0-9a-fA-F]+', base: 16 }),
		).toBeUndefined();
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '^[01]+', base: 2 })).toBeUndefined();
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '^[0-9]+', base: 10 })).toBe('numeric');
		expect(textEntryInputMode({ baseType: 'float', patternMask: '[0-9]+', base: 8 })).toBeUndefined();
	});

	test('a patternMask that can match minus keeps the text keyboard, for every baseType', () => {
		const possiblyNegative = ['-?[0-9]+', '[0-9]-[0-9]', '.*', '[^a]', '\\D+', '(-)', '0.+', '[0-9]\\-[0-9]'];
		for (const patternMask of possiblyNegative) {
			expect(textEntryInputMode({ baseType: 'integer', patternMask }), patternMask).toBeUndefined();
			expect(textEntryInputMode({ baseType: 'float', patternMask }), patternMask).toBeUndefined();
		}
	});

	test('a malformed patternMask keeps the text keyboard', () => {
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '[' })).toBeUndefined();
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '[^' })).toBeUndefined();
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '\\' })).toBeUndefined();
		expect(textEntryInputMode({ baseType: 'integer', patternMask: '\\p{Nd}+' })).toBeUndefined();
	});

	test('a non-numeric response never gets a numeric keyboard', () => {
		expect(textEntryInputMode({ baseType: 'string', patternMask: '[0-9]+' })).toBeUndefined();
		expect(textEntryInputMode({ baseType: undefined, patternMask: '[0-9]+' })).toBeUndefined();
	});
});

describe('patternExcludesMinus', () => {
	test.each([
		['^[0-9]+$', true],
		['[0-9]+', true],
		['\\d+', true],
		['\\d{4}', true],
		['[0-57-9]+', true],
		['[a-b]', true],
		['[%-2]', false],
		['[a-zA-Z]*', true],
		['[.]', true],
		['[\\s12]', true],
		['[0-9]+([.][0-9]+)?', true],
		['\\w+', true],
		['-?[0-9]+', false],
		['[0-9]-[0-9]', false],
		['[0-9]\\-[0-9]', false],
		['[a-]', false],
		['[-+]?[0-9]+', false],
		['[0-9][-]', false],
		['.+', false],
		['[^0-9]', false],
		['\\D', false],
		['\\W', false],
		['\\S', false],
		['\\P{Nd}', false],
		['\\p{Nd}+', false],
		['[*+-/]', false],
		['x{2,3}y', true],
		['(', true],
		['[', false],
		['(^)', true],
	])('%s excludes minus: %j', (pattern, excludes) => {
		expect(patternExcludesMinus(pattern)).toBe(excludes);
	});
});

describe('InlineTextEntry inputmode', () => {
	function entriesOf(itemXml: string): TextEntryInteractionData[] {
		const s = createAssessmentItemDefinition({ itemXml }).openSession();
		try {
			return s
				.present()
				.flow.flatMap((node) => (node.kind === 'interaction' ? [node.mount.interaction] : [])) as TextEntryInteractionData[];
		} finally {
			s.dispose();
		}
	}

	const item = (patternMask: string, baseType: 'integer' | 'float') => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="n" title="N" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="${baseType}"/>
  <itemBody><p><textEntryInteraction responseIdentifier="RESPONSE" patternMask="${patternMask}"/></p></itemBody>
</assessmentItem>`;

	test('the extractor carries the baseType and patternMask the inputmode rule reads', () => {
		expect(entriesOf(item('[0-9]+', 'integer'))).toMatchObject([{ baseType: 'integer', patternMask: '[0-9]+' }]);
		expect(entriesOf(item('-?[0-9]+', 'integer'))).toMatchObject([{ baseType: 'integer', patternMask: '-?[0-9]+' }]);
		expect(entriesOf(item('[0-9]+', 'float'))).toMatchObject([{ baseType: 'float', patternMask: '[0-9]+' }]);
	});
});

