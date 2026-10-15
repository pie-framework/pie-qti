/**
 * Outcome-processing inputs: a QTI 2.2 assessmentTest and its QTI 3.0 twin read every delivered
 * item's variables, section path, categories, weights, presented/responded/correct flags and
 * declared normal bounds, including items not yet submitted.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** A keyed choice item, or with `keyed: false` one whose response declares no correct response. */
const item = (identifier: string, { keyed = true, bounds = 'normalMinimum="0" normalMaximum="1"' } = {}) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">${keyed ? '<correctResponse><value>A</value></correctResponse>' : ''}</responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" ${bounds}><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="HITS" cardinality="single" baseType="integer"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><baseValue baseType="identifier">A</baseValue></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      <setOutcomeValue identifier="HITS"><baseValue baseType="integer">1</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

const ITEMS22: Record<string, string> = {
	'item-1': item('item-1', { bounds: 'normalMinimum="-1" normalMaximum="1"' }),
	'item-2': item('item-2'),
	'item-3': item('item-3'),
	'item-4': item('item-4', { keyed: false, bounds: '' }),
};

const outcome = (identifier: string, baseType: string, expression: string) => ({
	declaration: `<outcomeDeclaration identifier="${identifier}" cardinality="single" baseType="${baseType}"/>`,
	rule: `<setOutcomeValue identifier="${identifier}">${expression}</setOutcomeValue>`,
});

const OUTCOMES = [
	outcome('PRESENTED', 'integer', '<numberPresented/>'),
	outcome('RESPONDED', 'integer', '<numberResponded/>'),
	outcome('SELECTED', 'integer', '<numberSelected/>'),
	outcome('CORRECT', 'integer', '<numberCorrect/>'),
	outcome('INCORRECT', 'integer', '<numberIncorrect/>'),
	outcome('MATH_CORRECT', 'integer', '<numberCorrect sectionIdentifier="math"/>'),
	outcome('ALGEBRA_SELECTED', 'integer', '<numberSelected sectionIdentifier="algebra"/>'),
	outcome('CORE_SELECTED', 'integer', '<numberSelected includeCategory="core"/>'),
	outcome('NOT_MATH_SELECTED', 'integer', '<numberSelected excludeCategory="mathematics"/>'),
	outcome('HITS_TOTAL', 'integer', '<sum><testVariables variableIdentifier="HITS"/></sum>'),
	outcome('WEIGHTED', 'float', '<sum><testVariables variableIdentifier="SCORE" weightIdentifier="W"/></sum>'),
	outcome('MIN_TOTAL', 'float', '<sum><outcomeMinimum outcomeIdentifier="SCORE"/></sum>'),
	outcome('MAX_TOTAL', 'float', '<sum><outcomeMaximum outcomeIdentifier="SCORE"/></sum>'),
	outcome('MATH_MAX', 'float', '<sum><outcomeMaximum outcomeIdentifier="SCORE" sectionIdentifier="math" weightIdentifier="W"/></sum>'),
];

const QTI22 = `<assessmentTest ${NS} identifier="inputs-test" title="Inputs test">
  ${OUTCOMES.map((o) => o.declaration).join('\n  ')}
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="math" title="Math" visible="true">
      <assessmentSection identifier="algebra" title="Algebra" visible="true">
        <assessmentItemRef identifier="item-1" href="item-1.xml" category="mathematics core"><weight identifier="W" value="2"/></assessmentItemRef>
      </assessmentSection>
      <assessmentItemRef identifier="item-2" href="item-2.xml" category="mathematics"/>
    </assessmentSection>
    <assessmentSection identifier="ela" title="ELA" visible="true">
      <assessmentItemRef identifier="item-3" href="item-3.xml" category="reading core"/>
      <assessmentItemRef identifier="item-4" href="item-4.xml"/>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    ${OUTCOMES.map((o) => o.rule).join('\n    ')}
  </outcomeProcessing>
</assessmentTest>`;

const VERSIONS = {
	'QTI 2.2': { test: QTI22, item: (id: string) => ITEMS22[id] },
	'QTI 3.0': { test: convertQti2ToQti3(QTI22), item: (id: string) => convertQti2ToQti3(ITEMS22[id]) },
};

afterEach(() => localStorage.clear());

async function deliver(version: keyof typeof VERSIONS) {
	const { test: xml, item: itemXml } = VERSIONS[version];
	const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, {
		itemXmlMap: Object.fromEntries(Object.keys(ITEMS22).map((id) => [`${id}.xml`, itemXml(id)])),
	});
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const { sessionId } = await backend.initSession({ assessmentId: assessment.identifier, candidateId: 'candidate' });
	const submit = async (itemIdentifier: string, responses: Record<string, string>) =>
		(await backend.submitResponses({ sessionId, itemIdentifier, responses, submittedAt: Date.now() })).outcomes;
	return { assessment, submit };
}

describe.each(Object.keys(VERSIONS) as Array<keyof typeof VERSIONS>)('%s outcome-processing inputs', (version) => {
	test('parses item-ref categories and weights', async () => {
		const { assessment } = await deliver(version);
		const math = assessment.testParts[0].sections[0];
		expect(math.sections?.[0].assessmentItemRefs[0]).toMatchObject({
			categories: ['mathematics', 'core'],
			weights: [{ identifier: 'W', value: 2 }],
		});
		expect(math.assessmentItemRefs[0].categories).toEqual(['mathematics']);
	});

	test('counts and filters over every delivered item, submitted or not', async () => {
		const { submit } = await deliver(version);
		await submit('item-1', { RESPONSE: 'A' });
		await submit('item-3', { RESPONSE: 'B' });
		const outcomes = await submit('item-4', { RESPONSE: 'A' });

		expect(outcomes).toMatchObject({
			PRESENTED: 3,
			RESPONDED: 3,
			SELECTED: 4,
			// item-4 declares no correct response, so it is neither correct nor incorrect.
			CORRECT: 1,
			INCORRECT: 1,
			MATH_CORRECT: 1,
			ALGEBRA_SELECTED: 1,
			CORE_SELECTED: 2,
			NOT_MATH_SELECTED: 2,
			HITS_TOTAL: 2,
			WEIGHTED: 3,
		});
	});

	test('an empty response presents the item without responding to it', async () => {
		const { submit } = await deliver(version);
		const outcomes = await submit('item-2', {});
		expect(outcomes).toMatchObject({ PRESENTED: 1, RESPONDED: 0, CORRECT: 0, INCORRECT: 1 });
	});

	test('outcomeMinimum and outcomeMaximum read declared normal bounds', async () => {
		const { submit } = await deliver(version);
		const outcomes = await submit('item-1', { RESPONSE: 'B' });
		expect(outcomes).toMatchObject({ MIN_TOTAL: -1, MATH_MAX: 3 });
		// item-4 declares no normalMaximum, so the maximum over the whole test is NULL.
		expect(outcomes?.MAX_TOTAL).toBeNull();
	});
});
