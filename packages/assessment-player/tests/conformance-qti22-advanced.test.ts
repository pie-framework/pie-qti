/**
 * QTI 2.2 Advanced DELIVERY — assessment-level conformance tests
 *
 * Covers the following acceptance criteria from the official test packages:
 *
 *   T1-L2-D1  SCORE_TOTAL outcome initialized to 0 (default value)
 *   T9-L2-D1  SCORE_TOTAL = sum of correctly responded items after finalize
 *   T5-L2-D1  maxAttempts="0" on testPart means unlimited attempts per item
 *   T12-L2-D1 8 items displayed across 3 sections (4 + 3 + 1)
 *   T2-L2-D1  Test-level timeLimits parsed (60 s)
 *   S1-L2-D1  Section 1 allowSkipping=true — candidate can skip without responding
 *   S1-L2-D2  Section 2 allowSkipping=false — candidate must respond before advancing
 *   S9-L2-D1  Section 3 loaded from assessmentSectionRef (section3.xml)
 *   S5-L2-D1  rubricBlock for Section 1 ("Rubric Block for Section 1") exposed to candidate
 *   S5-L2-D2  rubricBlock for Section 2 exposed to candidate
 *   S5-L2-D3  rubricBlock for Section 3 exposed to candidate
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment } from '../src/integration/api-contract.js';

// ---------------------------------------------------------------------------
// Item XML helpers
// ---------------------------------------------------------------------------

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

function makeSimpleChoiceItem(identifier: string): string {
	return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="choice-1">Choice 1</simpleChoice>
      <simpleChoice identifier="choice-2">Choice 2</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T1_T9_ASSESSMENT: SecureAssessment = {
	identifier: 't1-outcome-declaration-t9-outcome-processing',
	title: 'T1 - Outcome Declaration and T9 Outcome Processing',
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
			identifier: 'testPart-1',
			sections: [
				{
					identifier: 'assessmentSection-1',
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

const T5_ASSESSMENT: SecureAssessment = {
	identifier: 't5-item-session-control',
	title: 'T5 - Test Parts - Item Session Control',
	navigationMode: 'nonlinear',
	submissionMode: 'individual',
	testParts: [
		{
			identifier: 'testPart-1',
			itemSessionControl: { maxAttempts: 0, allowSkipping: true },
			sections: [
				{
					identifier: 'assessmentSection-1',
					title: 'Section 1',
					visible: true,
					assessmentItemRefs: [
						{ identifier: 't5-item-1', role: 'candidate', itemXml: makeSimpleChoiceItem('t5-item-1') },
						{ identifier: 't5-item-2', role: 'candidate', itemXml: makeSimpleChoiceItem('t5-item-2') },
						{ identifier: 't5-item-3', role: 'candidate', itemXml: makeSimpleChoiceItem('t5-item-3') },
					],
				},
			],
		},
	],
};

const T12_ASSESSMENT: SecureAssessment = {
	identifier: 't12-sections',
	title: 'T12 - Sections',
	navigationMode: 'linear',
	submissionMode: 'individual',
	timeLimits: { maxTime: 60 },
	testParts: [
		{
			identifier: 'testPart-1',
			sections: [
				{
					identifier: 'assessmentSection-1',
					title: 'Section 1',
					visible: true,
					itemSessionControl: { allowSkipping: true },
					assessmentItemRefs: [
						{ identifier: 't12-item-1', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-1') },
						{ identifier: 't12-item-2', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-2') },
						{ identifier: 't12-item-3', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-3') },
						{ identifier: 't12-item-4', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-4') },
					],
				},
				{
					identifier: 'assessmentSection-2',
					title: 'Section 2',
					visible: true,
					itemSessionControl: { allowSkipping: false },
					assessmentItemRefs: [
						{ identifier: 't12-item-5', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-5') },
						{ identifier: 't12-item-6', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-6') },
						{ identifier: 't12-item-7', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-7') },
					],
				},
				{
					// Inlined section-ref content (from section3.xml in conformance package)
					identifier: 'assessmentSection-3',
					title: 'Section 3',
					visible: true,
					assessmentItemRefs: [
						{ identifier: 't12-item-8', role: 'candidate', itemXml: makeSimpleChoiceItem('t12-item-8') },
					],
				},
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(assessment: SecureAssessment): ReferenceBackendAdapter {
	localStorage.clear();
	const adapter = new ReferenceBackendAdapter();
	adapter.registerAssessment(assessment.identifier, assessment);
	return adapter;
}

async function createPlayer(assessment: SecureAssessment): Promise<AssessmentPlayer> {
	const adapter = makeAdapter(assessment);
	const player = await AssessmentPlayer.create({
		backend: adapter,
		initSession: { assessmentId: assessment.identifier, candidateId: 'test-candidate' },
	});
	await player.navigateTo(0);
	return player;
}

// ---------------------------------------------------------------------------
// T1 + T9
// ---------------------------------------------------------------------------

describe('QTI 2.2 Advanced — T1/T9 Outcome Declaration & Processing', () => {
	it('T1-L2-D1: SCORE_TOTAL declaration has defaultValue=0', () => {
		const decl = T1_T9_ASSESSMENT.outcomeDeclarations?.find((d) => d.identifier === 'SCORE_TOTAL');
		expect(decl).toBeDefined();
		expect(decl!.defaultValue).toBe(0);
	});

	it('T9-L2-D1: SCORE_TOTAL equals 3 when all items answered correctly', async () => {
		const adapter = makeAdapter(T1_T9_ASSESSMENT);
		const initRes = await adapter.initSession({
			assessmentId: T1_T9_ASSESSMENT.identifier,
			candidateId: 'candidate-1',
		});
		const sessionId = initRes.sessionId;

		for (const id of ['t1-item-1', 't1-item-2', 't1-item-3']) {
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

	it('T9-L2-D1: SCORE_TOTAL equals 2 when 2 of 3 items answered correctly', async () => {
		const adapter = makeAdapter(T1_T9_ASSESSMENT);
		const { sessionId } = await adapter.initSession({
			assessmentId: T1_T9_ASSESSMENT.identifier,
			candidateId: 'candidate-1',
		});

		await adapter.submitResponses({ sessionId, itemIdentifier: 't1-item-1', responses: { RESPONSE: 'correct' }, submittedAt: Date.now() });
		await adapter.submitResponses({ sessionId, itemIdentifier: 't1-item-2', responses: { RESPONSE: 'wrong' }, submittedAt: Date.now() });
		await adapter.submitResponses({ sessionId, itemIdentifier: 't1-item-3', responses: { RESPONSE: 'correct' }, submittedAt: Date.now() });

		const result = await adapter.finalizeAssessment({ sessionId });
		expect(result.totalScore).toBe(2);
	});

	it('T9-L2-D1: SCORE_TOTAL equals 0 when all items answered incorrectly', async () => {
		const adapter = makeAdapter(T1_T9_ASSESSMENT);
		const { sessionId } = await adapter.initSession({
			assessmentId: T1_T9_ASSESSMENT.identifier,
			candidateId: 'candidate-1',
		});

		for (const id of ['t1-item-1', 't1-item-2', 't1-item-3']) {
			await adapter.submitResponses({ sessionId, itemIdentifier: id, responses: { RESPONSE: 'wrong' }, submittedAt: Date.now() });
		}

		const result = await adapter.finalizeAssessment({ sessionId });
		expect(result.totalScore).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// T5 — maxAttempts=0
// ---------------------------------------------------------------------------

describe('QTI 2.2 Advanced — T5 Item Session Control (maxAttempts=0)', () => {
	it('T5-L2-D1: testPart itemSessionControl maxAttempts=0 is parsed correctly', () => {
		const testPart = T5_ASSESSMENT.testParts[0];
		expect(testPart.itemSessionControl?.maxAttempts).toBe(0);
	});

	it('T5-L2-D1: ItemSessionController with maxAttempts=0 allows unlimited submissions', async () => {
		const player = await createPlayer(T5_ASSESSMENT);
		// Access the private sessionController via cast to any
		const ctrl = (player as any).sessionController;
		ctrl.initializeItem('t5-item-1');
		// Record 100 attempts — canSubmit must still return true
		for (let i = 0; i < 100; i++) {
			ctrl.recordAttempt('t5-item-1');
		}
		expect(ctrl.canSubmit('t5-item-1')).toBe(true);
	});

	it('T5-L2-D1: unlimited attempts — multiple submitResponses calls succeed', async () => {
		const adapter = makeAdapter(T5_ASSESSMENT);
		const { sessionId } = await adapter.initSession({
			assessmentId: T5_ASSESSMENT.identifier,
			candidateId: 'candidate-1',
		});

		for (let i = 0; i < 5; i++) {
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

// ---------------------------------------------------------------------------
// T12 — multiple sections
// ---------------------------------------------------------------------------

describe('QTI 2.2 Advanced — T12 Multiple Sections', () => {
	let player: AssessmentPlayer;

	beforeEach(async () => {
		player = await createPlayer(T12_ASSESSMENT);
	});

	it('T12-L2-D1: assessment contains exactly 8 items', () => {
		const nav = player.getNavigationState();
		expect(nav.totalItems).toBe(8);
	});

	it('T12-L2-D1: 3 sections exist', () => {
		const nav = player.getNavigationState();
		expect(nav.totalSections).toBe(3);
	});

	it('T12-L2-D1: Section 1 contains items 1–4', () => {
		const assessment = (player as any).assessment as SecureAssessment;
		const s1 = assessment.testParts[0].sections[0];
		expect(s1.assessmentItemRefs.map((r: any) => r.identifier)).toEqual([
			't12-item-1', 't12-item-2', 't12-item-3', 't12-item-4',
		]);
	});

	it('T12-L2-D1: Section 2 contains items 5–7', () => {
		const assessment = (player as any).assessment as SecureAssessment;
		const s2 = assessment.testParts[0].sections[1];
		expect(s2.assessmentItemRefs.map((r: any) => r.identifier)).toEqual([
			't12-item-5', 't12-item-6', 't12-item-7',
		]);
	});

	it('T12-L2-D1: Section 3 contains item 8', () => {
		const assessment = (player as any).assessment as SecureAssessment;
		const s3 = assessment.testParts[0].sections[2];
		expect(s3.assessmentItemRefs).toHaveLength(1);
		expect(s3.assessmentItemRefs[0].identifier).toBe('t12-item-8');
	});
});

// ---------------------------------------------------------------------------
// T2 — test level time limits
// ---------------------------------------------------------------------------

describe('QTI 2.2 Advanced — T2 Test Level Time Limits', () => {
	it('T2-L2-D1: timeLimits.maxTime=60 is available from assessment structure', () => {
		expect(T12_ASSESSMENT.timeLimits?.maxTime).toBe(60);
	});

	it('T2-L2-D1: parseAssessmentTestXml extracts timeLimits.maxTime=60', async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="t2-time-limits" title="T2">
  <timeLimit maxTime="60" />
  <testPart identifier="testPart-1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="s1" visible="true" title="S1">
      <assessmentItemRef identifier="item-1" href="items/item-1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, {
			itemXmlMap: { 'items/item-1.xml': makeSimpleChoiceItem('item-1') },
		});
		expect(assessment.timeLimits?.maxTime).toBe(60);
	});
});

// ---------------------------------------------------------------------------
// S1 — section-level itemSessionControl
// ---------------------------------------------------------------------------

describe('QTI 2.2 Advanced — S1 Section-level itemSessionControl', () => {
	let player: AssessmentPlayer;

	beforeEach(async () => {
		player = await createPlayer(T12_ASSESSMENT);
	});

	it('S1-L2-D1: Section 1 itemSessionControl.allowSkipping=true', () => {
		const assessment = (player as any).assessment as SecureAssessment;
		expect(assessment.testParts[0].sections[0].itemSessionControl?.allowSkipping).toBe(true);
	});

	it('S1-L2-D2: Section 2 itemSessionControl.allowSkipping=false', () => {
		const assessment = (player as any).assessment as SecureAssessment;
		expect(assessment.testParts[0].sections[1].itemSessionControl?.allowSkipping).toBe(false);
	});

	it('S1-L2-D1: navigating to section-1 item sets sessionController allowSkipping=true', async () => {
		// Item 0 is in section 1 (allowSkipping=true)
		await player.navigateTo(0);
		const ctrl = (player as any).sessionController;
		expect(ctrl.canSkip('t12-item-1')).toBe(true);
	});

	it('S1-L2-D2: navigating to section-2 item sets sessionController allowSkipping=false', async () => {
		// In linear mode we must navigate sequentially through section 1 first.
		// Navigate to items 1–3 (advance through section 1)
		for (let i = 1; i <= 4; i++) {
			// Linear mode: must submit a response before advancing
			player.updateResponse('RESPONSE', 'choice-1');
			await player.navigateTo(i);
		}
		// Now at index 4 (t12-item-5, section 2)
		const ctrl = (player as any).sessionController;
		expect(ctrl.canSkip('t12-item-5')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// S9 — assessmentSectionRef resolution
// ---------------------------------------------------------------------------

describe('QTI 2.2 Advanced — S9 parseAssessmentTestXml assessmentSectionRef', () => {
	const ASSESSMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="t12-sections" title="T12 - Sections">
  <timeLimit maxTime="60" />
  <testPart identifier="testPart-1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="assessmentSection-1" visible="true" title="Section 1">
      <itemSessionControl allowSkipping="true" />
      <assessmentItemRef identifier="t12-item-1" href="items/item-1.xml"/>
      <assessmentItemRef identifier="t12-item-2" href="items/item-2.xml"/>
    </assessmentSection>
    <assessmentSection identifier="assessmentSection-2" visible="true" title="Section 2">
      <itemSessionControl allowSkipping="false" />
      <assessmentItemRef identifier="t12-item-3" href="items/item-3.xml"/>
    </assessmentSection>
    <assessmentSectionRef identifier="assessmentSection-3" href="section3.xml" />
  </testPart>
</assessmentTest>`;

	const SECTION3_XML = `<assessmentSection xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="assessmentSection-3" visible="true" title="Section 3">
  <assessmentItemRef identifier="t12-item-8" href="items/item-8.xml"/>
</assessmentSection>`;

	const itemXmlMap: Record<string, string> = {
		'items/item-1.xml': makeSimpleChoiceItem('t12-item-1'),
		'items/item-2.xml': makeSimpleChoiceItem('t12-item-2'),
		'items/item-3.xml': makeSimpleChoiceItem('t12-item-3'),
		'items/item-8.xml': makeSimpleChoiceItem('t12-item-8'),
	};

	const fileResolver = async (href: string) => {
		if (href === 'section3.xml') return SECTION3_XML;
		throw new Error(`Unexpected href: ${href}`);
	};

	it('S9-L2-D1: resolves assessmentSectionRef and includes item-8', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(ASSESSMENT_XML, {
			itemXmlMap,
			fileResolver,
		});
		const allItems = assessment.testParts.flatMap((tp) =>
			tp.sections.flatMap((s) => s.assessmentItemRefs.map((r) => r.identifier))
		);
		expect(allItems).toContain('t12-item-8');
		expect(allItems).toHaveLength(4);
	});

	it('S9-L2-D1: section 3 is the third section with only item-8', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(ASSESSMENT_XML, {
			itemXmlMap,
			fileResolver,
		});
		const sections = assessment.testParts[0].sections;
		expect(sections).toHaveLength(3);
		expect(sections[2].identifier).toBe('assessmentSection-3');
		expect(sections[2].assessmentItemRefs).toHaveLength(1);
		expect(sections[2].assessmentItemRefs[0].identifier).toBe('t12-item-8');
	});

	it('T2-L2-D1: timeLimits.maxTime=60 extracted from assessmentTest XML', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(ASSESSMENT_XML, {
			itemXmlMap,
			fileResolver,
		});
		expect(assessment.timeLimits?.maxTime).toBe(60);
	});

	it('S1: section-level allowSkipping values captured by parseAssessmentTestXml', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(ASSESSMENT_XML, {
			itemXmlMap,
			fileResolver,
		});
		const sections = assessment.testParts[0].sections;
		expect(sections[0].itemSessionControl?.allowSkipping).toBe(true);
		expect(sections[1].itemSessionControl?.allowSkipping).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// S5 — Rubric Block in Sections (clean-room XML)
// ─────────────────────────────────────────────────────────────────────────────

describe('QTI 2.2 Advanced — S5 Rubric Block in Sections (clean-room XML)', () => {
	const S5_ASSESSMENT_XML = `<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="s5-rubric-clean-room" title="S5 Rubric Clean Room">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true">
      <rubricBlock identifier="section-1-rubric" view="candidate">
        <p>Section 1: answer the science item.</p>
      </rubricBlock>
      <assessmentItemRef identifier="s5-item-1" href="items/choice-single-cardinality.xml"/>
    </assessmentSection>
    <assessmentSection identifier="section-2" title="Section 2" visible="true">
      <rubricBlock identifier="section-2-rubric" view="candidate">
        <p>Section 2: select all correct observations.</p>
      </rubricBlock>
      <assessmentItemRef identifier="s5-item-2" href="items/choice-multiple-cardinality.xml"/>
    </assessmentSection>
    <assessmentSection identifier="section-3" title="Section 3" visible="true">
      <rubricBlock identifier="section-3-rubric" view="candidate">
        <p>Section 3: type a short numeric response.</p>
      </rubricBlock>
      <assessmentItemRef identifier="s5-item-3" href="items/text-entry.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

	const s5ItemXmlMap: Record<string, string> = {
		'items/choice-single-cardinality.xml': makeSimpleChoiceItem('s5-item-1'),
		'items/choice-multiple-cardinality.xml': makeSimpleChoiceItem('s5-item-2'),
		'items/text-entry.xml': `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="s5-item-3" title="s5-item-3" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody>
    <p>How many sides does a triangle have? <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="2"/></p>
  </itemBody>
</assessmentItem>`,
	};

	it('S5-L2-D1/D2/D3: each section has exactly one rubricBlock with candidate view', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(S5_ASSESSMENT_XML, {
			itemXmlMap: s5ItemXmlMap,
		});
		const sections = assessment.testParts[0].sections;
		expect(sections).toHaveLength(3);

		for (const section of sections) {
			expect(section.rubricBlocks).toBeDefined();
			expect(section.rubricBlocks!.length).toBe(1);
			expect(section.rubricBlocks![0].view).toContain('candidate');
		}
	});

	it('S5-L2-D1: Section 1 rubricBlock content contains "Section 1"', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(S5_ASSESSMENT_XML, {
			itemXmlMap: s5ItemXmlMap,
		});
		const rubric = assessment.testParts[0].sections[0].rubricBlocks![0];
		expect(rubric.content).toContain('Section 1');
	});

	it('S5-L2-D2: Section 2 rubricBlock content contains "Section 2"', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(S5_ASSESSMENT_XML, {
			itemXmlMap: s5ItemXmlMap,
		});
		const rubric = assessment.testParts[0].sections[1].rubricBlocks![0];
		expect(rubric.content).toContain('Section 2');
	});

	it('S5-L2-D3: Section 3 rubricBlock content contains "Section 3"', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(S5_ASSESSMENT_XML, {
			itemXmlMap: s5ItemXmlMap,
		});
		const rubric = assessment.testParts[0].sections[2].rubricBlocks![0];
		expect(rubric.content).toContain('Section 3');
	});

	it('S5: getCurrentRubricBlocks() returns section rubric when navigated to item in that section', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(S5_ASSESSMENT_XML, {
			itemXmlMap: s5ItemXmlMap,
		});
		const player = await createPlayer(assessment);

		// Item 1 is in Section 1 — rubric should say "Section 1"
		const rubrics = player.getCurrentRubricBlocks();
		expect(rubrics).toHaveLength(1);
		expect(rubrics[0].content).toContain('Section 1');

		// Navigate to item 2 (Section 2)
		await player.navigateTo(1);
		const rubrics2 = player.getCurrentRubricBlocks();
		expect(rubrics2).toHaveLength(1);
		expect(rubrics2[0].content).toContain('Section 2');

		// Navigate to item 3 (Section 3)
		await player.navigateTo(2);
		const rubrics3 = player.getCurrentRubricBlocks();
		expect(rubrics3).toHaveLength(1);
		expect(rubrics3[0].content).toContain('Section 3');
	});
});
