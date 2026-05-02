/**
 * QTI 2.2 Advanced Level conformance package index.
 *
 * Each entry corresponds to a ZIP file in /static/conformance/qti22-advanced/
 * that was generated directly from the official 1EdTech conformance test packages.
 *
 * The ZIPs preserve the original directory structure and are processed by
 * @pie-qti/ims-cp-browser exactly as a user-uploaded content package would be.
 */

export interface ConformancePackage {
	id: string;
	featureId: string;
	title: string;
	zipPath: string;
	/** 'item' packages open their first item; 'test' packages open the assessment test. */
	type: 'item' | 'test';
	deliveryCriteria: string[];
	description: string;
}

const BASE = '/conformance/qti22-advanced';

export const CONFORMANCE_PACKAGES_QTI22_ADVANCED: ConformancePackage[] = [
	// ── Item-level interaction packages ─────────────────────────────────────
	{
		id: 'q6-gap-match',
		featureId: 'Q6',
		title: 'Q6 – Gap Match Interaction',
		zipPath: `${BASE}/q6-gap-match.zip`,
		type: 'item',
		deliveryCriteria: ['Q6-L2-D1', 'Q6-L2-D2', 'Q6-L2-D3', 'Q6-L2-D4'],
		description:
			'Three gap match items: text choices, MathML choices, and a table with unlimited matchMax.',
	},
	{
		id: 'q8-graphic-gap-match',
		featureId: 'Q8',
		title: 'Q8 – Graphic Gap Match Interaction',
		zipPath: `${BASE}/q8-graphic-gap-match.zip`,
		type: 'item',
		deliveryCriteria: ['Q8-L2-D1', 'Q8-L2-D2', 'Q8-L2-D3', 'Q8-L2-D4'],
		description:
			'Two items: gapImg (image labels onto UK airport map) and gapText (text labels onto same map).',
	},
	{
		id: 'q10-hotspot',
		featureId: 'Q10',
		title: 'Q10 – Hotspot Interaction',
		zipPath: `${BASE}/q10-hotspot.zip`,
		type: 'item',
		deliveryCriteria: ['Q10-L2-D1', 'Q10-L2-D2', 'Q10-L2-D3'],
		description:
			'Three items: single cardinality (UK cities), multiple cardinality, and polygon shapes (plant rhizome on SVG).',
	},
	{
		id: 'q11-hottext',
		featureId: 'Q11',
		title: 'Q11 – Hot-text Interaction',
		zipPath: `${BASE}/q11-hottext.zip`,
		type: 'item',
		deliveryCriteria: ['Q11-L2-D1', 'Q11-L2-D2', 'Q11-L2-D3'],
		description:
			'Two items: single cardinality (select one grammar error) and multiple cardinality (select two errors).',
	},
	{
		id: 'q12-inline-choice',
		featureId: 'Q12',
		title: 'Q12 – Inline Choice Interaction',
		zipPath: `${BASE}/q12-inline-choice.zip`,
		type: 'item',
		deliveryCriteria: ['Q12-L2-D1', 'Q12-L2-D2', 'Q12-L2-D3', 'Q12-L2-D4', 'Q12-L2-D5'],
		description:
			'Four items: simple inline choice, MathML choices, composite (multi-interaction), and invalid cardinality example.',
	},
	{
		id: 'q13-match',
		featureId: 'Q13',
		title: 'Q13 – Match Interaction',
		zipPath: `${BASE}/q13-match.zip`,
		type: 'item',
		deliveryCriteria: ['Q13-L2-D1', 'Q13-L2-D2', 'Q13-L2-D3', 'Q13-L2-D4'],
		description: 'Two items: Shakespeare character-to-play matching (unbounded and maxAssociations=3).',
	},
	{
		id: 'i17-composite-item',
		featureId: 'I17',
		title: 'I17 – Composite Item',
		zipPath: `${BASE}/i17-composite-item.zip`,
		type: 'item',
		deliveryCriteria: ['I17-L2-D1', 'I9-L2-D1', 'I9-L2-D2', 'I9-L2-D3', 'I9-L2-D11'],
		description:
			'One composite item with 3 interactions (2× inlineChoice + 1× textEntry), full responseProcessing (not template), per-interaction subscores.',
	},
	{
		id: 'p7-qti-metadata',
		featureId: 'P7',
		title: 'P7 – QTI Metadata',
		zipPath: `${BASE}/p7-qti-metadata.zip`,
		type: 'item',
		deliveryCriteria: [],
		description:
			'One choice item demonstrating QTI metadata and LOM metadata in the manifest.',
	},
	{
		id: 'q2-choice-interaction',
		featureId: 'Q2',
		title: 'Q2 – Choice Interaction (validation examples)',
		zipPath: `${BASE}/q2-choice-interaction.zip`,
		type: 'item',
		deliveryCriteria: ['Q2-L2-I51', 'Q2-L2-I52'],
		description:
			'Two invalid items used for IMPORT validation: incorrect cardinality and invalid minChoices. Expected to fail or warn.',
	},

	// ── Assessment-level test packages ───────────────────────────────────────
	{
		id: 't1-outcome-declaration',
		featureId: 'T1/T9',
		title: 'T1 – Outcome Declaration / T9 – Outcome Processing',
		zipPath: `${BASE}/t1-outcome-declaration.zip`,
		type: 'test',
		deliveryCriteria: ['T1-L2-D1', 'T9-L2-D1'],
		description:
			'3-item test with SCORE_TOTAL outcomeDeclaration and outcomeProcessing that sums item scores.',
	},
	{
		id: 't5-item-session-control',
		featureId: 'T5',
		title: 'T5 – Test Parts / Item Session Control',
		zipPath: `${BASE}/t5-item-session-control.zip`,
		type: 'test',
		deliveryCriteria: ['T5-L2-D1'],
		description:
			'3-item test with testPart-level itemSessionControl (maxAttempts="0" = unlimited) and nonlinear navigation.',
	},
	{
		id: 't12-sections',
		featureId: 'T12/T2/S1/S5/S9',
		title: 'T12 – Sections (also covers T2, S1, S5, S9)',
		zipPath: `${BASE}/t12-sections.zip`,
		type: 'test',
		deliveryCriteria: [
			'T12-L2-D1',
			'T2-L2-D1',
			'S1-L2-D1',
			'S1-L2-D2',
			'S5-L2-D1',
			'S5-L2-D2',
			'S5-L2-D3',
			'S9-L2-D1',
		],
		description:
			'8-item test in 3 sections: two inline + one referenced via assessmentSectionRef. Tests time limits, per-section allowSkipping, rubric blocks, and external section references.',
	},
	{
		id: 's5-rubric-block',
		featureId: 'S5',
		title: 'S5 – Rubric Block in Sections',
		zipPath: `${BASE}/s5-rubric-block.zip`,
		type: 'test',
		deliveryCriteria: ['S5-L2-D1', 'S5-L2-D2', 'S5-L2-D3'],
		description:
			'3-item test with rubricBlock in each section displaying candidate-facing instructions.',
	},
	{
		id: 's3-s4-selection-ordering',
		featureId: 'S3/S4',
		title: 'S3/S4 – Selection & Ordering',
		zipPath: `${BASE}/s3-s4-selection-ordering.zip`,
		type: 'test',
		deliveryCriteria: ['S3-L2-I1', 'S4-L2-I1', 'S4-L2-I2'],
		description:
			'Assessment with two sections demonstrating item selection (pick 2 of 3) and ordering (shuffle). Note: item XMLs are not bundled — this package tests structure only.',
	},
];

export const ITEM_PACKAGES = CONFORMANCE_PACKAGES_QTI22_ADVANCED.filter((p) => p.type === 'item');
export const TEST_PACKAGES = CONFORMANCE_PACKAGES_QTI22_ADVANCED.filter((p) => p.type === 'test');
