/**
 * Responses are read in the item's content language before scoring: digits in any script, the
 * Arabic separators, the language's decimal mark, invisible bidi controls and the language's case
 * fold. The response is stored as typed.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { createAssessmentItemDefinition as createServerDefinition } from '../../src/server.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';
const MATCH_CORRECT = '<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>';
const MAP_RESPONSE = '<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>';
const STRING_MATCH = `<responseProcessing><responseCondition><responseIf>
    <stringMatch caseSensitive="false"><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></stringMatch>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  </responseIf><responseElse>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue>
  </responseElse></responseCondition></responseProcessing>`;

const item = (language: string, baseType: string, declaration: string, processing: string) => `<assessmentItem ${NS}
  identifier="typed" title="Typed" adaptive="false" timeDependent="false" xml:lang="${language}">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="${baseType}">${declaration}</responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><p>Answer: <textEntryInteraction responseIdentifier="RESPONSE"/></p></itemBody>
  ${processing}
</assessmentItem>`;

const numberItem = (language: string) =>
	item(language, 'float', '<correctResponse><value>3.5</value></correctResponse>', MATCH_CORRECT);
const wordItem = (language: string, answer: string, processing = MATCH_CORRECT) =>
	item(language, 'string', `<correctResponse><value>${answer}</value></correctResponse>`, processing);

type Definition = typeof createAssessmentItemDefinition;

const scoreWith = (create: Definition, convert: (xml: string) => string) => (xml: string, response: string) => {
	const session = create({ itemXml: convert(xml), role: 'scorer' }).openSession({ responses: { RESPONSE: response } });
	try {
		return session.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false }).result?.scoring
			?.score;
	} finally {
		session.dispose();
	}
};

const asIs = (xml: string) => xml;

describe.each([
	['QTI 2.2', 'client', createAssessmentItemDefinition, asIs],
	['QTI 3.0', 'client', createAssessmentItemDefinition, convertQti2ToQti3],
	['QTI 2.2', 'server', createServerDefinition as unknown as Definition, asIs],
	['QTI 3.0', 'server', createServerDefinition as unknown as Definition, convertQti2ToQti3],
] as const)('%s typed responses (%s definition)', (_version, _entry, create, convert) => {
	const score = scoreWith(create, convert);

	test('read Arabic-Indic and Persian digits and the Arabic decimal separator', () => {
		expect(score(numberItem('ar'), '٣٫٥')).toBe(1);
		expect(score(numberItem('ar'), '۳٫۵')).toBe(1);
		expect(score(numberItem('ar'), '3.5')).toBe(1);
		expect(score(numberItem('ar'), '٣٫٦')).toBe(0);
	});

	test('read the decimal comma where the content language writes one', () => {
		expect(score(numberItem('fr'), '3,5')).toBe(1);
		expect(score(numberItem('ar-MA'), '٣٫٥')).toBe(1);
		expect(score(numberItem('en'), '3,5')).toBe(0);
	});

	test('ignore bidi controls and tatweel in a string answer', () => {
		expect(score(wordItem('ar', 'كتاب'), '‏كــتاب')).toBe(1);
		expect(score(wordItem('ar', 'كتاب'), 'كتب')).toBe(0);
	});

	test('fold case in the content language', () => {
		expect(score(wordItem('en', 'Paris', STRING_MATCH), '‫PARIS‬')).toBe(1);
		expect(score(wordItem('tr', 'İstanbul', STRING_MATCH), 'istanbul')).toBe(1);
		expect(score(wordItem('tr', 'İstanbul', STRING_MATCH), 'ISTANBUL')).toBe(0);
	});

	test('find a mapping entry by its normalised key', () => {
		const mapped = item(
			'ar',
			'string',
			`<mapping defaultValue="0">
        <mapEntry mapKey="كتاب" mappedValue="2"/>
        <mapEntry mapKey="Paris" mappedValue="3" caseSensitive="false"/>
      </mapping>`,
			MAP_RESPONSE,
		);
		expect(score(mapped, 'كــتاب')).toBe(2);
		expect(score(mapped, '‎PARIS')).toBe(3);
		expect(score(mapped, 'London')).toBe(0);
	});
});

test('stores the response as typed', () => {
	const session = createAssessmentItemDefinition({ itemXml: wordItem('ar', 'كتاب') }).openSession({
		responses: { RESPONSE: '‏كــتاب' },
	});
	try {
		expect(session.state().responses.RESPONSE).toBe('‏كــتاب');
	} finally {
		session.dispose();
	}
});
