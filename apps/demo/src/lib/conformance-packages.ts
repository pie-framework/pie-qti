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

// ── QTI 3.0 Basic Level ──────────────────────────────────────────────────────

const BASE30 = '/conformance/qti30-basic';

export const CONFORMANCE_PACKAGES_QTI30_BASIC: ConformancePackage[] = [
	{
		id: 'q30-q2-single-cardinality',
		featureId: 'Q2',
		title: 'Q2 – Choice Interaction (single cardinality)',
		zipPath: `${BASE30}/q2-single-cardinality.zip`,
		type: 'item',
		deliveryCriteria: ['Q2-L1-D51', 'Q2-L1-D52', 'Q2-L1-D53', 'Q2-L1-D54', 'Q2-L1-D55', 'Q2-L1-D201'],
		description:
			'Baseline item + shared-vocabulary variants: qti-labels-none, qti-orientation-horizontal, qti-choices-stacking-N.',
	},
	{
		id: 'q30-q2-multiple-cardinality',
		featureId: 'Q2',
		title: 'Q2 – Choice Interaction (multiple cardinality)',
		zipPath: `${BASE30}/q2-multiple-cardinality.zip`,
		type: 'item',
		deliveryCriteria: ['Q2-L1-D1', 'Q2-L1-D2', 'Q2-L1-D3', 'Q2-L1-D101'],
		description:
			'Multiple cardinality items with shared-vocabulary label class variants.',
	},
	{
		id: 'q30-q5-extended-text',
		featureId: 'Q5',
		title: 'Q5 – Extended Text Entry Interaction',
		zipPath: `${BASE30}/q5-extended-text.zip`,
		type: 'item',
		deliveryCriteria: ['Q5-L1-D1', 'Q5-L1-D2', 'Q5-L1-D101', 'Q5-L1-D102', 'Q5-L1-D103', 'Q5-L1-D104'],
		description:
			'Baseline string item + height-lines-3, height-lines-6, height-lines-15 variants.',
	},
	{
		id: 'q30-q20-text-entry',
		featureId: 'Q20',
		title: 'Q20 – Text Entry Interaction',
		zipPath: `${BASE30}/q20-text-entry.zip`,
		type: 'item',
		deliveryCriteria: ['Q20-L1-D1', 'Q20-L1-D2', 'Q20-L1-D102', 'Q20-L1-D111', 'Q20-L1-D118'],
		description:
			'Baseline item + qti-input-width-N variants (1–72 ch) and data-patternmask-message validation.',
	},
	{
		id: 'q30-i9b-response-processing',
		featureId: 'I9b',
		title: 'I9b – Response Processing Fixed Templates',
		zipPath: `${BASE30}/i9b-response-processing.zip`,
		type: 'item',
		deliveryCriteria: ['I9-L1-D12', 'I9-L1-D13', 'I9-L1-D14', 'I9-L1-D1', 'I9-L1-D2'],
		description:
			'Two items: match_correct (NULL→0, correct→1) and map_response (multi-select partial credit).',
	},
	{
		id: 'q30-a1-alternate-text',
		featureId: 'A1',
		title: 'A1 – Alternate Text for Graphics',
		zipPath: `${BASE30}/a1-alternate-text.zip`,
		type: 'item',
		deliveryCriteria: ['A1-L1-D1'],
		description: 'Item with an image that has an alt attribute — verify assistive-technology passthrough.',
	},
	{
		id: 'q30-t4-t7-test-structures',
		featureId: 'T4/T7/T14',
		title: 'T4 & T7 – Test Structures',
		zipPath: `${BASE30}/t4-t7-test-structures.zip`,
		type: 'test',
		deliveryCriteria: ['T4-L1-D1', 'T4-L1-D2', 'T7-L1-D1', 'T7-L1-D2', 'T14-L1-D1'],
		description:
			'Assessment with one testPart, one section, four items (Q2×2, Q20, Q5). Linear navigation + individual submission.',
	},
];

export const ITEM_PACKAGES_QTI30_BASIC = CONFORMANCE_PACKAGES_QTI30_BASIC.filter((p) => p.type === 'item');
export const TEST_PACKAGES_QTI30_BASIC = CONFORMANCE_PACKAGES_QTI30_BASIC.filter((p) => p.type === 'test');

// ── QTI 3.0 Advanced Level ───────────────────────────────────────────────────

const BASE30_ADV = '/conformance/qti30-advanced';

export const CONFORMANCE_PACKAGES_QTI30_ADVANCED: ConformancePackage[] = [
	// ── Item-level interaction packages ─────────────────────────────────────
	{
		id: 'q30adv-q2-single',
		featureId: 'Q2',
		title: 'Q2 – Choice Interaction (single cardinality, Advanced)',
		zipPath: `${BASE30_ADV}/q2-single-cardinality.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q2-L2-D51',
			'Q2-L2-D52',
			'Q2-L2-D201',
			'Q2-L2-D202',
			'Q2-L2-D203',
			'Q2-L2-D204',
			'Q2-L2-D205',
			'Q2-L2-D221',
		],
		description:
			'Single-cardinality items with validation examples and Shared Vocabulary: qti-input-control-hidden, qti-labels-none, qti-orientation-*, qti-choices-stacking-N, data-min-selections-message.',
	},
	{
		id: 'q30adv-q2-multiple',
		featureId: 'Q2',
		title: 'Q2 – Choice Interaction (multiple cardinality, Advanced)',
		zipPath: `${BASE30_ADV}/q2-multiple-cardinality.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q2-L2-D101',
			'Q2-L2-D102',
			'Q2-L2-D103',
			'Q2-L2-D104',
			'Q2-L2-D105',
			'Q2-L2-D114',
			'Q2-L2-D115',
			'Q2-L2-D116',
		],
		description:
			'Multiple-cardinality items with qti-input-control-hidden, qti-orientation-*, qti-choices-stacking-N (Z/N patterns), data-max/min-selections-message.',
	},
	{
		id: 'q30adv-q5-extended-text',
		featureId: 'Q5',
		title: 'Q5 – Extended Text Entry Interaction (Advanced)',
		zipPath: `${BASE30_ADV}/q5-extended-text.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q5-L2-D101',
			'Q5-L2-D102',
			'Q5-L2-D103',
			'Q5-L2-D104',
			'Q5-L2-D105',
			'Q5-L2-D106',
			'Q5-L2-D107',
			'Q5-L2-D108',
			'Q5-L2-D109',
			'Q5-L2-D110',
			'Q5-L2-D121',
			'Q5-L2-D131',
		],
		description:
			'qti-height-lines-N for plain/xhtml, qti-counter-down/up (character count), pattern-mask enforcement with message, placeholder-text.',
	},
	{
		id: 'q30adv-q6-gap-match',
		featureId: 'Q6',
		title: 'Q6 – Gap Match Interaction (Advanced)',
		zipPath: `${BASE30_ADV}/q6-gap-match.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q6-L2-D1',
			'Q6-L2-D2',
			'Q6-L2-D3',
			'Q6-L2-D4',
			'Q6-L2-D101',
			'Q6-L2-D102',
			'Q6-L2-D103',
			'Q6-L2-D104',
			'Q6-L2-D105',
			'Q6-L2-D106',
			'Q6-L2-D107',
			'Q6-L2-D108',
			'Q6-L2-D109',
		],
		description:
			'Gap match + Shared Vocabulary: qti-choices-top/bottom/left/right, data-choices-container-width, qti-input-width-N on gaps, selection messages.',
	},
	{
		id: 'q30adv-q8-graphic-gap-match',
		featureId: 'Q8',
		title: 'Q8 – Graphic Gap Match Interaction (Advanced)',
		zipPath: `${BASE30_ADV}/q8-graphic-gap-match.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q8-L2-D1',
			'Q8-L2-D2',
			'Q8-L2-D101',
			'Q8-L2-D102',
			'Q8-L2-D103',
			'Q8-L2-D104',
			'Q8-L2-D105',
			'Q8-L2-D106',
			'Q8-L2-D107',
			'Q8-L2-D108',
			'Q8-L2-D109',
			'Q8-L2-D110',
		],
		description:
			'GapImg + GapText + Shared Vocabulary: choice positioning, data-choices-container-width, qti-selections-dark/light, qti-unselected-hidden, selection messages.',
	},
	{
		id: 'q30adv-q10-hotspot',
		featureId: 'Q10',
		title: 'Q10 – Hotspot Interaction (Advanced)',
		zipPath: `${BASE30_ADV}/q10-hotspot.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q10-L2-D1',
			'Q10-L2-D2',
			'Q10-L2-D3',
			'Q10-L2-D101',
			'Q10-L2-D102',
		],
		description:
			'Three hotspot items + Shared Vocabulary: qti-selections-light/dark, data-min/max-selections-message.',
	},
	{
		id: 'q30adv-q11-hottext',
		featureId: 'Q11',
		title: 'Q11 – Hot-text Interaction (Advanced)',
		zipPath: `${BASE30_ADV}/q11-hottext.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q11-L2-D1',
			'Q11-L2-D2',
			'Q11-L2-D3',
			'Q11-L2-D101',
			'Q11-L2-D102',
		],
		description:
			'Single + multiple cardinality hot-text + Shared Vocabulary: qti-input-control-hidden, selection messages.',
	},
	{
		id: 'q30adv-q12-inline-choice',
		featureId: 'Q12',
		title: 'Q12 – Inline Choice Interaction (Advanced)',
		zipPath: `${BASE30_ADV}/q12-inline-choice.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q12-L2-D1',
			'Q12-L2-D2',
			'Q12-L2-D3',
			'Q12-L2-D4',
			'Q12-L2-D5',
			'Q12-L2-D21',
			'Q12-L2-D101',
			'Q12-L2-D102',
			'Q12-L2-D103',
		],
		description:
			'Composite item, invalid cardinality validation + Shared Vocabulary: qti-input-width-N, data-prompt, data-min-selections-message.',
	},
	{
		id: 'q30adv-q13-match',
		featureId: 'Q13',
		title: 'Q13 – Match Interaction (Advanced)',
		zipPath: `${BASE30_ADV}/q13-match.zip`,
		type: 'item',
		deliveryCriteria: [
			'Q13-L2-D1',
			'Q13-L2-D2',
			'Q13-L2-D3',
			'Q13-L2-D4',
			'Q13-L2-D101',
			'Q13-L2-D102',
			'Q13-L2-D103',
			'Q13-L2-D104',
			'Q13-L2-D105',
			'Q13-L2-D106',
			'Q13-L2-D107',
			'Q13-L2-D108',
			'Q13-L2-D109',
			'Q13-L2-D110',
		],
		description:
			'Match interaction + Shared Vocabulary: qti-choices-top/bottom/left/right, qti-match-tabular with row/column headers, qti-header-hidden, selection messages.',
	},
	{
		id: 'q30adv-i4-shared-stimulus',
		featureId: 'I4',
		title: 'I4 – Shared Stimulus',
		zipPath: `${BASE30_ADV}/i4-shared-stimulus.zip`,
		type: 'item',
		deliveryCriteria: ['I4-L2-D1', 'I4-L2-D2', 'I4-L2-D101'],
		description:
			'Three items sharing a reading passage (unbelievableNight.xml). Item 2 positions stimulus via data-stimulus-idref in left column.',
	},
	{
		id: 'q30adv-i17-composite-item',
		featureId: 'I17',
		title: 'I17 – Composite Item (QTI 3.0)',
		zipPath: `${BASE30_ADV}/i17-composite-item.zip`,
		type: 'item',
		deliveryCriteria: ['I17-L2-D1', 'I9-L2-D1', 'I9-L2-D2', 'I9-L2-D3', 'I9-L2-D11'],
		description:
			'Shakespeare biography item with 3 interactions (2× inlineChoice + 1× textEntry), per-interaction subscores summed to overall SCORE.',
	},
	{
		id: 'q30adv-i20-shared-vocabulary',
		featureId: 'I20',
		title: 'I20 – Shared Vocabulary CSS (Full)',
		zipPath: `${BASE30_ADV}/i20-shared-vocabulary.zip`,
		type: 'item',
		deliveryCriteria: [
			'I20-L2-D1',
			'I20-L2-D2',
			'I20-L2-D3',
			'I20-L2-D4',
			'I20-L2-D5',
			'I20-L2-D21',
		],
		description:
			'Items demonstrating the full QTI 3.0 Shared Vocabulary CSS class set: text formatting, alignment, layout grid, padding, margin, display, and width utilities.',
	},
	{
		id: 'q30adv-a13-a15-captions-glossary',
		featureId: 'A13/A15',
		title: 'A13 – Captions / A15 – Glossary',
		zipPath: `${BASE30_ADV}/a13-a15-captions-glossary.zip`,
		type: 'item',
		deliveryCriteria: ['A13-L2-D1', 'A15-L2-D1', 'A15-L2-D2'],
		description:
			'Video item with caption track (A13) and glossary trigger for "acronym" term (A15, keyboard-accessible).',
	},
	{
		id: 'q30adv-p7-metadata-lom',
		featureId: 'P7',
		title: 'P7 – QTI Metadata (LOM)',
		zipPath: `${BASE30_ADV}/p7-metadata-lom.zip`,
		type: 'item',
		deliveryCriteria: [],
		description: 'Choice item with LOM metadata in the IMS manifest.',
	},
	{
		id: 'q30adv-p7-metadata-qti',
		featureId: 'P7',
		title: 'P7 – QTI Metadata (QTI-only)',
		zipPath: `${BASE30_ADV}/p7-metadata-qti.zip`,
		type: 'item',
		deliveryCriteria: [],
		description: 'Choice item with QTI-only metadata (no LOM) in the IMS manifest.',
	},

	// ── Assessment-level test packages ───────────────────────────────────────
	{
		id: 'q30adv-s3-s4-selection-ordering',
		featureId: 'S3/S4',
		title: 'S3/S4 – Selection & Ordering (QTI 3.0)',
		zipPath: `${BASE30_ADV}/s3-s4-selection-ordering.zip`,
		type: 'test',
		deliveryCriteria: ['S3-L2-D1', 'S3-L2-D2', 'S4-L2-D1', 'S4-L2-D11', 'S4-L2-D12'],
		description:
			'Two sections: Section A selects 2 of 3 items (Item 1 fixed), Section B selects 2 of 3 and shuffles. Nonlinear navigation.',
	},
	{
		id: 'q30adv-s5-rubric-block',
		featureId: 'S5',
		title: 'S5 – Rubric Block in Sections (QTI 3.0)',
		zipPath: `${BASE30_ADV}/s5-rubric-block.zip`,
		type: 'test',
		deliveryCriteria: ['S5-L2-D1', 'S5-L2-D2', 'S5-L2-D3'],
		description: '3-section test with candidate-facing rubricBlock in each section.',
	},
	{
		id: 'q30adv-t1-outcome-declaration',
		featureId: 'T1/T9',
		title: 'T1 – Outcome Declaration / T9 – Outcome Processing (QTI 3.0)',
		zipPath: `${BASE30_ADV}/t1-outcome-declaration.zip`,
		type: 'test',
		deliveryCriteria: ['T1-L2-D1', 'T9-L2-D1'],
		description: '3-item test with SCORE_TOTAL outcomeDeclaration and outcomeProcessing that sums item scores.',
	},
	{
		id: 'q30adv-t5-item-session-control',
		featureId: 'T5',
		title: 'T5 – Test Parts / Item Session Control (QTI 3.0)',
		zipPath: `${BASE30_ADV}/t5-item-session-control.zip`,
		type: 'test',
		deliveryCriteria: ['T5-L2-D1'],
		description: '3-item test with testPart-level itemSessionControl (maxAttempts="0" = unlimited).',
	},
	{
		id: 'q30adv-t12-sections',
		featureId: 'T12/T2/S1/S9',
		title: 'T12 – Sections (also T2, S1, S9) (QTI 3.0)',
		zipPath: `${BASE30_ADV}/t12-sections.zip`,
		type: 'test',
		deliveryCriteria: ['T12-L2-D1', 'T2-L2-D1', 'S1-L2-D1', 'S1-L2-D2', 'S9-L2-D1'],
		description:
			'8-item test in 3 sections with time limit (60s), per-section allowSkipping, and external section reference.',
	},
];

export const ITEM_PACKAGES_QTI30_ADVANCED = CONFORMANCE_PACKAGES_QTI30_ADVANCED.filter((p) => p.type === 'item');
export const TEST_PACKAGES_QTI30_ADVANCED = CONFORMANCE_PACKAGES_QTI30_ADVANCED.filter((p) => p.type === 'test');
