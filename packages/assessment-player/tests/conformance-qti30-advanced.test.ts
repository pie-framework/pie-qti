/**
 * QTI 3.0 Advanced DELIVERY — assessment-level conformance tests.
 *
 * Covers deterministic DELIVERY criteria from the official QTI 3.0 Advanced
 * test packages using the same reference backend path as the demo player.
 */

import './setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment } from '../src/integration/api-contract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFORMANCE = join(__dirname, '../../../../qti-conformance/qti3.0/Advanced');

function readAdvancedXml(packageDir: string, relativePath: string): string {
	return readFileSync(join(CONFORMANCE, packageDir, relativePath), 'utf-8');
}

function makeAdapter(assessment: SecureAssessment): ReferenceBackendAdapter {
	localStorage.clear();
	const adapter = new ReferenceBackendAdapter();
	adapter.registerAssessment(assessment.identifier, assessment);
	return adapter;
}

async function parseAssessment(
	packageDir: string,
	options: {
		itemHrefs?: string[];
		fileResolver?: (href: string) => Promise<string>;
	} = {}
): Promise<SecureAssessment> {
	const itemXmlMap: Record<string, string> = {};
	for (const href of options.itemHrefs ?? []) {
		itemXmlMap[href] = readAdvancedXml(packageDir, href);
	}
	return ReferenceBackendAdapter.parseAssessmentTestXml(
		readAdvancedXml(packageDir, 'assessment.xml'),
		{
			itemXmlMap,
			fileResolver: options.fileResolver,
		}
	);
}

describe('QTI 3.0 Advanced — T1/T9 Outcome Declaration & Processing', () => {
	const packageDir = 'T1 - Outcome Declaration';
	const itemHrefs = ['items/item-1.xml', 'items/item-2.xml', 'items/item-3.xml'];

	it('T1-L2-D1: SCORE_TOTAL declaration has defaultValue=0', async () => {
		const assessment = await parseAssessment(packageDir, { itemHrefs });
		const decl = assessment.outcomeDeclarations?.find((d) => d.identifier === 'SCORE_TOTAL');
		expect(decl).toBeDefined();
		expect(decl!.baseType).toBe('float');
		expect(decl!.defaultValue).toBe(0);
	});

	it('T9-L2-D1: SCORE_TOTAL equals the number of correctly responded items', async () => {
		const assessment = await parseAssessment(packageDir, { itemHrefs });
		const adapter = makeAdapter(assessment);
		const { sessionId } = await adapter.initSession({
			assessmentId: assessment.identifier,
			candidateId: 'candidate-1',
		});

		for (const id of [
			't1-outcome-declaration-item-1',
			't1-outcome-declaration-item-2',
			't1-outcome-declaration-item-3',
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
		const assessment = await parseAssessment('T5 - Test Parts - Item Session Control', {
			itemHrefs: ['items/item-1.xml', 'items/item-2.xml', 'items/item-3.xml'],
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
				itemIdentifier: 't5-item-session-control-item-1',
				responses: { RESPONSE: 'choice-1' },
				submittedAt: Date.now(),
			});
			expect(res.success).toBe(true);
		}
	});
});

describe('QTI 3.0 Advanced — T12/T2/S1/S9 Sections', () => {
	const packageDir = 'T12 - Sections';
	const itemHrefs = [
		'items/item-1.xml',
		'items/item-2.xml',
		'items/item-3.xml',
		'items/item-4.xml',
		'items/item-5.xml',
		'items/item-6.xml',
		'items/item-7.xml',
		'items/item-8.xml',
	];

	async function parseT12() {
		return parseAssessment(packageDir, {
			itemHrefs,
			fileResolver: async (href) => readAdvancedXml(packageDir, href),
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
		expect(sections[2].assessmentItemRefs[0].identifier).toBe('t12-sections-item-8');
	});
});

describe('QTI 3.0 Advanced — S5 Rubric Block in Sections', () => {
	it('S5-L2-D1/D2/D3: candidate rubric blocks are parsed for all sections', async () => {
		const assessment = await parseAssessment('S5 - Rubric Block in Sections', {
			itemHrefs: [
				'items/choice-single-cardinality.xml',
				'items/choice-multiple-cardinality.xml',
				'items/text-entry.xml',
			],
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
