/**
 * patternMask (QTI 2.1 textEntryInteraction / extendedTextInteraction; QTI 3.0 §5.48.4,
 * §5.162.5): "If given, the pattern mask specifies a regular expression that the candidate's
 * response must match in order to be considered valid. The regular expression language used is
 * defined in Appendix F of [XML Schema Part 2]."
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const item = (declaration: string, interaction: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="pattern-mask" title="Pattern mask" adaptive="false" timeDependent="false">
  ${declaration}
  <itemBody>${interaction}</itemBody>
</assessmentItem>`;

const TEXT_ENTRY = item(
	'<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>',
	'<p>Code: <textEntryInteraction responseIdentifier="RESPONSE" patternMask="[0-9]{3}"/></p>',
);

const EXTENDED_TEXT = item(
	'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="string"/>',
	'<extendedTextInteraction responseIdentifier="RESPONSE" maxStrings="2" patternMask="\\p{IsBasicLatin}+"/>',
);

describe.each([
	['QTI 2.2', TEXT_ENTRY, EXTENDED_TEXT],
	['QTI 3.0', convertQti2ToQti3(TEXT_ENTRY), convertQti2ToQti3(EXTENDED_TEXT)],
])('patternMask response validity (%s)', (_version, textEntry, extendedText) => {
	const entry = (itemXml: string, value: unknown) =>
		new Player({ itemXml }).validateResponses({ RESPONSE: value }).entries.RESPONSE;

	test('a text entry that does not match its patternMask is invalid', () => {
		expect(entry(textEntry, '123')).toMatchObject({ valid: true });
		expect(entry(textEntry, '12a')).toMatchObject({ valid: false });
		expect(entry(textEntry, '1234')).toMatchObject({ valid: false });
	});

	test('no response is not checked against the pattern', () => {
		expect(entry(textEntry, null)).toMatchObject({ valid: true });
		expect(entry(textEntry, '')).toMatchObject({ valid: true });
	});

	test('every string of an extended text response must match, read as XSD', () => {
		expect(entry(extendedText, ['abc', 'def'])).toMatchObject({ valid: true });
		expect(entry(extendedText, ['abc', 'é'])).toMatchObject({ valid: false });
	});

	test('an invalid response cannot be submitted', () => {
		const player = new Player({ itemXml: textEntry });
		expect(player.canSubmitResponses({ RESPONSE: '12a' })).toBe(false);
		expect(player.canSubmitResponses({ RESPONSE: '123' })).toBe(true);
	});
});

test('a numeric response is not checked: its value is not the text the candidate entered', () => {
	const itemXml = item(
		'<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float"/>',
		'<p><textEntryInteraction responseIdentifier="RESPONSE" patternMask="[0-9]+\\.[0-9]{2}"/></p>',
	);
	// The candidate typed "3.50"; the float response holds 3.5.
	expect(new Player({ itemXml }).validateResponses({ RESPONSE: 3.5 }).entries.RESPONSE).toMatchObject({ valid: true });
});

test('a patternMask that does not compile does not reject responses', () => {
	const itemXml = TEXT_ENTRY.replace('[0-9]{3}', '(');
	expect(new Player({ itemXml }).validateResponses({ RESPONSE: 'x' }).entries.RESPONSE).toMatchObject({ valid: true });
});
