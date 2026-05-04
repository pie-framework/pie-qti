import './setup.js';

import { describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment } from '../src/integration/api-contract.js';

function makeAdapter(assessment: SecureAssessment): ReferenceBackendAdapter {
	localStorage.clear();
	const adapter = new ReferenceBackendAdapter();
	adapter.registerAssessment(assessment.identifier, assessment);
	return adapter;
}

function makeChoiceItem(identifier: string): string {
	return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>correct</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="correct">Correct</simpleChoice>
      <simpleChoice identifier="wrong">Wrong</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;
}

async function parseAssessment(
	testXml: string,
	options: {
		itemXmlMap?: Record<string, string>;
		fileResolver?: (href: string) => Promise<string>;
	} = {}
): Promise<SecureAssessment> {
	return ReferenceBackendAdapter.parseAssessmentTestXml(
		testXml,
		{
			itemXmlMap: options.itemXmlMap,
			fileResolver: options.fileResolver,
		}
	);
}

const T1_ASSESSMENT_XML = `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="t1-outcome-declaration" title="T1 Outcome Declaration">
  <qti-outcome-declaration identifier="SCORE_TOTAL" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <outcomeProcessing>
    <setOutcomeValue identifier="SCORE_TOTAL">
      <sum>
        <testVariables variableIdentifier="SCORE"/>
        <variable identifier="SCORE_TOTAL"/>
      </sum>
    </setOutcomeValue>
  </outcomeProcessing>
  <qti-test-part identifier="part-1" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" title="Section 1" visible="true">
      <qti-assessment-item-ref identifier="t1-item-1" href="items/item-1.xml"/>
      <qti-assessment-item-ref identifier="t1-item-2" href="items/item-2.xml"/>
      <qti-assessment-item-ref identifier="t1-item-3" href="items/item-3.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`;

const T1_ITEM_MAP = {
	'items/item-1.xml': makeChoiceItem('t1-item-1'),
	'items/item-2.xml': makeChoiceItem('t1-item-2'),
	'items/item-3.xml': makeChoiceItem('t1-item-3'),
};

describe('QTI 3.0 Advanced — T1/T9 Outcome Declaration & Processing', () => {
	it('T1-L2-D1: SCORE_TOTAL declaration has defaultValue=0', async () => {
		const assessment = await parseAssessment(T1_ASSESSMENT_XML, { itemXmlMap: T1_ITEM_MAP });
		const decl = assessment.outcomeDeclarations?.find((d) => d.identifier === 'SCORE_TOTAL');
		expect(decl).toBeDefined();
		expect(decl!.baseType).toBe('float');
		expect(decl!.defaultValue).toBe(0);
	});

	it('T9-L2-D1: SCORE_TOTAL equals the number of correctly responded items', async () => {
		const assessment: SecureAssessment = {
			identifier: 'qti3-t9-outcome-processing',
			title: 'QTI 3.0 T9 Outcome Processing',
			navigationMode: 'linear',
			submissionMode: 'individual',
			outcomeDeclarations: [
				{ identifier: 'SCORE_TOTAL', baseType: 'float', cardinality: 'single', defaultValue: 0 },
			],
			outcomeProcessingXml: `<outcomeProcessing xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <setOutcomeValue identifier="SCORE_TOTAL">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
      <variable identifier="SCORE_TOTAL"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>`,
			testParts: [
				{
					identifier: 'part-1',
					sections: [
						{
							identifier: 'section-1',
							title: 'Section 1',
							visible: true,
							assessmentItemRefs: [
								{ identifier: 't1-item-1', role: 'candidate', itemXml: makeChoiceItem('t1-item-1') },
								{ identifier: 't1-item-2', role: 'candidate', itemXml: makeChoiceItem('t1-item-2') },
								{ identifier: 't1-item-3', role: 'candidate', itemXml: makeChoiceItem('t1-item-3') },
							],
						},
					],
				},
			],
		};
		const adapter = makeAdapter(assessment);
		const { sessionId } = await adapter.initSession({
			assessmentId: assessment.identifier,
			candidateId: 'candidate-1',
		});

		for (const id of [
			't1-item-1',
			't1-item-2',
			't1-item-3',
		]) {
			await adapter.submitResponses({
				sessionId,
				itemIdentifier: id,
				responses: { RESPONSE: 'correct' },
				submittedAt: Date.now(),
			});
		}

		const result = await adapter.finalizeAssessment({ sessionId });
		expect(result.success).toBe(true);
		expect(result.totalScore).toBe(3);
	});
});

describe('QTI 3.0 Advanced — T5 Item Session Control', () => {
	it('T5-L2-D1: testPart max-attempts="0" is unlimited', async () => {
		const assessment = await parseAssessment(`<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="t5-item-session-control" title="T5 Item Session Control">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-item-session-control max-attempts="0" allow-skipping="true"/>
    <qti-assessment-section identifier="section-1" title="Section 1" visible="true">
      <qti-assessment-item-ref identifier="t5-item-1" href="items/item-1.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`, {
			itemXmlMap: { 'items/item-1.xml': makeChoiceItem('t5-item-1') },
		});
		expect(assessment.testParts[0].itemSessionControl?.maxAttempts).toBe(0);

		const adapter = makeAdapter(assessment);
		const { sessionId } = await adapter.initSession({
			assessmentId: assessment.identifier,
			candidateId: 'candidate-1',
		});

		for (let attempt = 0; attempt < 5; attempt++) {
			const res = await adapter.submitResponses({
				sessionId,
				itemIdentifier: 't5-item-1',
				responses: { RESPONSE: 'choice-1' },
				submittedAt: Date.now(),
			});
			expect(res.success).toBe(true);
		}
	});
});

describe('QTI 3.0 Advanced — T12/T2/S1/S9 Sections', () => {
	const ASSESSMENT_XML = `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="t12-sections" title="T12 Sections">
  <qti-time-limits max-time="60"/>
  <qti-test-part identifier="part-1" navigation-mode="linear" submission-mode="individual">
    <qti-assessment-section identifier="assessmentSection-1" title="Section 1" visible="true">
      <qti-item-session-control allow-skipping="true"/>
      <qti-assessment-item-ref identifier="t12-item-1" href="items/item-1.xml"/>
      <qti-assessment-item-ref identifier="t12-item-2" href="items/item-2.xml"/>
      <qti-assessment-item-ref identifier="t12-item-3" href="items/item-3.xml"/>
      <qti-assessment-item-ref identifier="t12-item-4" href="items/item-4.xml"/>
    </qti-assessment-section>
    <qti-assessment-section identifier="assessmentSection-2" title="Section 2" visible="true">
      <qti-item-session-control allow-skipping="false"/>
      <qti-assessment-item-ref identifier="t12-item-5" href="items/item-5.xml"/>
      <qti-assessment-item-ref identifier="t12-item-6" href="items/item-6.xml"/>
      <qti-assessment-item-ref identifier="t12-item-7" href="items/item-7.xml"/>
    </qti-assessment-section>
    <qti-assessment-section-ref identifier="assessmentSection-3-ref" href="section3.xml"/>
  </qti-test-part>
</qti-assessment-test>`;

	const SECTION3_XML = `<qti-assessment-section xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="assessmentSection-3" title="Section 3" visible="true">
  <qti-assessment-item-ref identifier="t12-item-8" href="items/item-8.xml"/>
</qti-assessment-section>`;

	const itemXmlMap = Object.fromEntries(
		Array.from({ length: 8 }, (_, index) => {
			const itemNumber = index + 1;
			return [`items/item-${itemNumber}.xml`, makeChoiceItem(`t12-item-${itemNumber}`)];
		})
	);

	async function parseT12() {
		return parseAssessment(ASSESSMENT_XML, {
			itemXmlMap,
			fileResolver: async (href) => {
				if (href === 'section3.xml') return SECTION3_XML;
				throw new Error(`Unexpected href: ${href}`);
			},
		});
	}

	it('T12-L2-D1: assessment has 8 items across 3 sections', async () => {
		const player = await AssessmentPlayer.create({
			backend: makeAdapter(await parseT12()),
			initSession: { assessmentId: 't12-sections', candidateId: 'candidate-1' },
		});
		const nav = player.getNavigationState();
		expect(nav.totalItems).toBe(8);
		expect(nav.totalSections).toBe(3);
	});

	it('T2-L2-D1: qti-time-limits max-time is parsed', async () => {
		const assessment = await parseT12();
		expect(assessment.timeLimits?.maxTime).toBe(60);
	});

	it('S1-L2-D1/D2: section-level allow-skipping values are parsed', async () => {
		const assessment = await parseT12();
		const sections = assessment.testParts[0].sections;
		expect(sections[0].itemSessionControl?.allowSkipping).toBe(true);
		expect(sections[1].itemSessionControl?.allowSkipping).toBe(false);
	});

	it('S9-L2-D1: qti-assessment-section-ref resolves section3.xml', async () => {
		const assessment = await parseT12();
		const sections = assessment.testParts[0].sections;
		expect(sections[2].identifier).toBe('assessmentSection-3');
		expect(sections[2].assessmentItemRefs).toHaveLength(1);
		expect(sections[2].assessmentItemRefs[0].identifier).toBe('t12-item-8');
	});
});

describe('QTI 3.0 Advanced — S5 Rubric Block in Sections', () => {
	it('S5-L2-D1/D2/D3: candidate rubric blocks are parsed for all sections', async () => {
		const assessment = await parseAssessment(`<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="s5-rubric" title="S5 Rubric">
  <qti-test-part identifier="part-1" navigation-mode="nonlinear" submission-mode="individual">
    <qti-assessment-section identifier="section-1" title="Section 1" visible="true">
      <qti-rubric-block identifier="rubric-1" view="candidate"><p>Section 1 candidate directions</p></qti-rubric-block>
      <qti-assessment-item-ref identifier="s5-item-1" href="items/item-1.xml"/>
    </qti-assessment-section>
    <qti-assessment-section identifier="section-2" title="Section 2" visible="true">
      <qti-rubric-block identifier="rubric-2" view="candidate"><p>Section 2 candidate directions</p></qti-rubric-block>
      <qti-assessment-item-ref identifier="s5-item-2" href="items/item-2.xml"/>
    </qti-assessment-section>
    <qti-assessment-section identifier="section-3" title="Section 3" visible="true">
      <qti-rubric-block identifier="rubric-3" view="candidate"><p>Section 3 candidate directions</p></qti-rubric-block>
      <qti-assessment-item-ref identifier="s5-item-3" href="items/item-3.xml"/>
    </qti-assessment-section>
  </qti-test-part>
</qti-assessment-test>`, {
			itemXmlMap: {
				'items/item-1.xml': makeChoiceItem('s5-item-1'),
				'items/item-2.xml': makeChoiceItem('s5-item-2'),
				'items/item-3.xml': makeChoiceItem('s5-item-3'),
			},
		});
		const sections = assessment.testParts[0].sections;
		expect(sections).toHaveLength(3);
		for (const section of sections) {
			expect(section.rubricBlocks).toHaveLength(1);
			expect(section.rubricBlocks![0].view).toContain('candidate');
		}
		expect(sections[0].rubricBlocks![0].content).toContain('Section 1');
		expect(sections[1].rubricBlocks![0].content).toContain('Section 2');
		expect(sections[2].rubricBlocks![0].content).toContain('Section 3');
	});
});
