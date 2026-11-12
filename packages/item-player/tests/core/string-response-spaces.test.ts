/**
 * A string response is the candidate's text, spaces included (INT-01/INT-10): the text fields are
 * controlled by the stored response — the extended text rebuilds its fields from what the session
 * holds after every keystroke — so a value trimmed at rest echoes back and deletes the space the
 * candidate just typed, corrupting every multi-word typed answer. Only text that is entirely
 * white space is no response; numbers keep their numeric reading (whitespace never means anything
 * there), and identifier responses stay trimmed identifiers.
 *
 * Scoring compares string answers as QTI defines it, exactly (see response-normalization.test.ts):
 * the comparison reads the value as stored, so a "Paris " answer and the authored "Paris" now
 * compare as the different strings they are.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';
const MATCH_CORRECT =
	'<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>';

const withInteraction = (interaction: string, extraDeclarations = '') => `<assessmentItem ${NS}
  identifier="spaces" title="Spaces" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse><value>Paris</value></correctResponse>
  </responseDeclaration>
  ${extraDeclarations}
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Answer: ${interaction}</p></itemBody>
  ${MATCH_CORRECT}
</assessmentItem>`;

const EXTENDED_TEXT = '<extendedTextInteraction responseIdentifier="RESPONSE"/>';
const TEXT_ENTRY = '<textEntryInteraction responseIdentifier="RESPONSE"/>';

function session(xml: string, responses?: Record<string, unknown>) {
	return createAssessmentItemDefinition({ itemXml: xml, role: 'candidate' }).openSession({ responses });
}

function stored(xml: string, value: unknown): unknown {
	const live = session(xml);
	try {
		live.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value });
		return live.state().responses.RESPONSE;
	} finally {
		live.dispose();
	}
}

describe.each([
	['extendedTextInteraction', EXTENDED_TEXT],
	['textEntryInteraction', TEXT_ENTRY],
])('typed spaces survive at rest (%s)', (_name, interaction) => {
	const xml = withInteraction(interaction);

	test('the stored response keeps the spaces as typed', () => {
		expect(stored(xml, 'a b c')).toBe('a b c');
	});

	test('every keystroke stores exactly what the field holds', () => {
		// "a b c" typed key by key: the trailing space of "a " is live text at that moment, and
		// the stored value is what the controlled field echoes back.
		for (const prefix of ['a', 'a ', 'a b', 'a b ', 'a b c']) {
			expect(stored(xml, prefix)).toBe(prefix);
		}
	});

	test('leading and trailing spaces are part of the answer', () => {
		expect(stored(xml, ' New York ')).toBe(' New York ');
	});

	test('a newline inside the answer is kept', () => {
		expect(stored(xml, 'line one\nline two')).toBe('line one\nline two');
	});

	test('text that is only white space is no response', () => {
		expect(stored(xml, '   ')).toBeNull();
		expect(stored(xml, ' \n\t ')).toBeNull();
		expect(stored(xml, '')).toBeNull();
	});

	test('a restored session keeps the spaces', () => {
		const live = session(xml, { RESPONSE: 'a b ' });
		try {
			expect(live.state().responses.RESPONSE).toBe('a b ');
		} finally {
			live.dispose();
		}
	});
});

describe('other base types keep their reading (only strings are free text)', () => {
	test('a numeric answer still reads in its base, whitespace around it and all', () => {
		const floatItem = withInteraction(TEXT_ENTRY).replace(
			'<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">',
			'<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float">',
		);
		expect(stored(floatItem, ' 3.5 ')).toBe(3.5);
	});

	test('an identifier response stays a trimmed identifier', () => {
		const choiceItem = `<assessmentItem ${NS}
		  identifier="choice" title="c" adaptive="false" timeDependent="false">
		  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		    <correctResponse><value>A</value></correctResponse>
		  </responseDeclaration>
		  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
		    <defaultValue><value>0</value></defaultValue>
		  </outcomeDeclaration>
		  <itemBody><p>
		    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false">
		      <simpleChoice identifier="A">A</simpleChoice>
		    </choiceInteraction>
		  </p></itemBody>
		  ${MATCH_CORRECT}
		</assessmentItem>`;
		expect(stored(choiceItem, ' A ')).toBe('A');
	});
});

describe('multi-part string answers keep each part verbatim', () => {
	test('a multiple-cardinality extended text keeps the spaces of every part', () => {
		const xml = withInteraction(
			'<extendedTextInteraction responseIdentifier="RESPONSE" maxStrings="3"/>',
		).replace('cardinality="single" baseType="string"', 'cardinality="multiple" baseType="string"');
		expect(stored(xml, ['one two', 'three '])).toEqual(['one two', 'three ']);
		// A part that is only white space is no part.
		expect(stored(xml, ['one', '   '])).toEqual(['one']);
	});
});

describe('string scoring compares the text as stored', () => {
	for (const convert of [(xml: string) => xml, convertQti2ToQti3]) {
		test(`an exact match scores; a padded answer is a different string (${convert === convertQti2ToQti3 ? 'QTI 3.0' : 'QTI 2.2'})`, () => {
			const definition = createAssessmentItemDefinition({ itemXml: convert(withInteraction(EXTENDED_TEXT)), role: 'scorer' });
			const live = definition.openSession({ responses: { RESPONSE: 'Paris' } });
			try {
				expect(live.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false }).result?.scoring?.score).toBe(1);
			} finally {
				live.dispose();
			}
			const padded = definition.openSession({ responses: { RESPONSE: 'Paris ' } });
			try {
				expect(padded.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false }).result?.scoring?.score).toBe(0);
			} finally {
				padded.dispose();
			}
		});
	}
});
