import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** Two responses: a single identifier and a multiple one, the second optionally without a key. */
const item = (keyed: boolean) => `<assessmentItem ${NS} identifier="two-responses" title="Two" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="R1" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <responseDeclaration identifier="R2" cardinality="multiple" baseType="identifier">${keyed ? '<correctResponse><value>X</value><value>Y</value></correctResponse>' : ''}</responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="R1" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
    <choiceInteraction responseIdentifier="R2" maxChoices="0"><simpleChoice identifier="X">X</simpleChoice><simpleChoice identifier="Y">Y</simpleChoice><simpleChoice identifier="Z">Z</simpleChoice></choiceInteraction>
  </itemBody>
</assessmentItem>`;

const score = (xml: string, responses: Record<string, unknown>) => {
	const session = createAssessmentItemDefinition({ itemXml: xml, role: 'scorer' }).openSession({ responses });
	try {
		return session.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false }).result?.scoring;
	} finally {
		session.dispose();
	}
};

describe.each([
	['QTI 2.2', (keyed: boolean) => item(keyed)],
	['QTI 3.0', (keyed: boolean) => convertQti2ToQti3(item(keyed))],
] as const)('%s scoring correctness', (_version, xml) => {
	test('is true only when every response matches its correct response, without MAXSCORE', () => {
		expect(score(xml(true), { R1: 'A', R2: ['Y', 'X'] })?.correct).toBe(true);
		expect(score(xml(true), { R1: 'A', R2: ['X'] })?.correct).toBe(false);
		expect(score(xml(true), { R1: 'B', R2: ['X', 'Y'] })?.correct).toBe(false);
		expect(score(xml(true), {})?.correct).toBe(false);
	});

	test('is absent when a response declares no correct response', () => {
		expect(score(xml(false), { R1: 'A', R2: ['X'] })?.correct).toBeUndefined();
	});
});
