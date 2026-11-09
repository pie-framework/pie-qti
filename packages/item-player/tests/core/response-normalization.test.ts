/**
 * Responses are read in the item's content language before scoring. Typed numbers read digits in
 * any script, the Arabic separators and the language's decimal mark: reading typed text into an
 * integer or float response is the delivery system's part, which QTI leaves to it.
 *
 * String answers compare as QTI defines them: exactly, up to Unicode canonical equivalence, with
 * case folded only where the content asks for it. The host may opt in to folding script input
 * (`stringComparison.foldScriptInput`) and Arabic letter variants
 * (`stringComparison.foldLetterVariants`). The response is stored as typed either way.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { createExtendedTextNumericRecord } from '../../src/interactions/extended-text/response.js';
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

const TEXT_ENTRY = '<textEntryInteraction responseIdentifier="RESPONSE"/>';
const EXTENDED_TEXT = '<extendedTextInteraction responseIdentifier="RESPONSE"/>';

const item = (language: string, baseType: string, declaration: string, processing: string, interaction = TEXT_ENTRY) => `<assessmentItem ${NS}
  identifier="typed" title="Typed" adaptive="false" timeDependent="false" xml:lang="${language}">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="${baseType}">${declaration}</responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><p>Answer: ${interaction}</p></itemBody>
  ${processing}
</assessmentItem>`;

const numberItem = (language: string, interaction = TEXT_ENTRY) =>
	item(language, 'float', '<correctResponse><value>3.5</value></correctResponse>', MATCH_CORRECT, interaction);
const wordItem = (language: string, answer: string, processing = MATCH_CORRECT) =>
	item(language, 'string', `<correctResponse><value>${answer}</value></correctResponse>`, processing);
const mappedItem = () =>
	item(
		'ar',
		'string',
		`<mapping defaultValue="0">
        <mapEntry mapKey="كتاب" mappedValue="2"/>
        <mapEntry mapKey="Paris" mappedValue="3" caseSensitive="false"/>
      </mapping>`,
		MAP_RESPONSE,
	);

const KITAB_WITH_TATWEEL = 'كــتاب';
const FOLD_SCRIPT_INPUT = { foldScriptInput: true } as const;

type Definition = typeof createAssessmentItemDefinition;
type StringComparison = Parameters<Definition>[0]['stringComparison'];

const scoreWith =
	(create: Definition, convert: (xml: string) => string, stringComparison?: StringComparison) =>
	(xml: string, response: string) => {
		const definition = create({ itemXml: convert(xml), role: 'scorer', ...(stringComparison ? { stringComparison } : {}) });
		const session = definition.openSession({ responses: { RESPONSE: response } });
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
	const scoreFolded = scoreWith(create, convert, FOLD_SCRIPT_INPUT);

	test('read Arabic-Indic and Persian digits and the Arabic decimal separator', () => {
		for (const read of [score, scoreFolded]) {
			expect(read(numberItem('ar'), '٣٫٥')).toBe(1);
			expect(read(numberItem('ar'), '۳٫۵')).toBe(1);
			expect(read(numberItem('ar'), '3.5')).toBe(1);
			expect(read(numberItem('ar'), '٣٫٦')).toBe(0);
		}
	});

	test('read script digits typed into an extended text number', () => {
		for (const read of [score, scoreFolded]) {
			expect(read(numberItem('ar', EXTENDED_TEXT), '٣٫٥')).toBe(1);
			expect(read(numberItem('ar', EXTENDED_TEXT), '٣٫٦')).toBe(0);
		}
	});

	test('read the decimal comma where the content language writes one', () => {
		expect(score(numberItem('fr'), '3,5')).toBe(1);
		expect(score(numberItem('ar-MA'), '٣٫٥')).toBe(1);
		expect(score(numberItem('en'), '3,5')).toBe(0);
	});

	test('compare a string answer exactly by default', () => {
		expect(score(wordItem('ar', 'كتاب'), 'كتاب')).toBe(1);
		expect(score(wordItem('ar', 'كتاب'), `\u200F${KITAB_WITH_TATWEEL}`)).toBe(0);
		expect(score(wordItem('ar', '3'), '٣')).toBe(0);
	});

	test('ignore bidi controls and tatweel in a string answer when the host folds script input', () => {
		expect(scoreFolded(wordItem('ar', 'كتاب'), `\u200F${KITAB_WITH_TATWEEL}`)).toBe(1);
		expect(scoreFolded(wordItem('ar', '3'), '٣')).toBe(1);
		expect(scoreFolded(wordItem('ar', 'كتاب'), 'كتب')).toBe(0);
	});

	test('fold case in the content language', () => {
		expect(score(wordItem('en', 'Paris', STRING_MATCH), 'PARIS')).toBe(1);
		expect(score(wordItem('tr', 'İstanbul', STRING_MATCH), 'istanbul')).toBe(1);
		expect(score(wordItem('tr', 'İstanbul', STRING_MATCH), 'ISTANBUL')).toBe(0);
	});

	test('fold case and script input together only when the host folds script input', () => {
		expect(score(wordItem('en', 'Paris', STRING_MATCH), '\u202BPARIS\u202C')).toBe(0);
		expect(scoreFolded(wordItem('en', 'Paris', STRING_MATCH), '\u202BPARIS\u202C')).toBe(1);
	});

	test('find a mapping entry by its exact key, case folded as the entry says', () => {
		expect(score(mappedItem(), 'كتاب')).toBe(2);
		expect(score(mappedItem(), 'PARIS')).toBe(3);
		expect(score(mappedItem(), KITAB_WITH_TATWEEL)).toBe(0);
		expect(score(mappedItem(), '\u200EPARIS')).toBe(0);
		expect(score(mappedItem(), 'London')).toBe(0);
	});

	test('find a mapping entry by its folded key when the host folds script input', () => {
		expect(scoreFolded(mappedItem(), KITAB_WITH_TATWEEL)).toBe(2);
		expect(scoreFolded(mappedItem(), '\u200EPARIS')).toBe(3);
		expect(scoreFolded(mappedItem(), 'London')).toBe(0);
	});

	test('fold Arabic letter variants only when the host asks for it', () => {
		const spelled = wordItem('ar', 'مدرسة');
		expect(score(spelled, 'مدرسه')).toBe(0);
		expect(scoreFolded(spelled, 'مدرسه')).toBe(0);
		expect(scoreWith(create, convert, { foldLetterVariants: true })(spelled, 'مدرسه')).toBe(1);
	});
});

test('stores the response as typed', () => {
	for (const stringComparison of [undefined, FOLD_SCRIPT_INPUT]) {
		const session = createAssessmentItemDefinition({
			itemXml: wordItem('ar', 'كتاب'),
			...(stringComparison ? { stringComparison } : {}),
		}).openSession({ responses: { RESPONSE: `\u200F${KITAB_WITH_TATWEEL}` } });
		try {
			expect(session.state().responses.RESPONSE).toBe(`\u200F${KITAB_WITH_TATWEEL}`);
		} finally {
			session.dispose();
		}
	}
});

test('the extended text numeric record reads script digits and keeps the text as typed', () => {
	const record = createExtendedTextNumericRecord('٣٫٥', 10, 'ar');
	expect(record.stringValue).toBe('٣٫٥');
	expect(record.floatValue).toBe(3.5);
	expect(record.ndp).toBe(1);
});
