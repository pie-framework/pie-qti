import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';
import { UnsupportedResponseProcessingTemplateError } from '../../src/core/responseProcessingTemplates.js';

const OFFICIAL_TEMPLATES = join(
	import.meta.dir,
	'..',
	'fixtures',
	'official-response-processing-templates',
);

function officialTemplate(name: string): string {
	return readFileSync(join(OFFICIAL_TEMPLATES, `${name}.xml`), 'utf8').replace(
		/^<\?xml[^>]*>\s*/,
		'',
	);
}

function fixedTemplate(name: string): string {
	return `<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/${name}.xml"/>`;
}

function itemXml({
	processing,
	maxScore = 5,
	point = false,
	multiple = false,
}: {
	processing: string;
	maxScore?: number;
	point?: boolean;
	/** A multi-select RESPONSE whose mapping bounds clamp an empty selection away from 0. */
	multiple?: boolean;
}): string {
	const responseDeclaration = point
		? `<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point">
			<qti-area-mapping default-value="0">
				<qti-area-map-entry shape="circle" coords="50,50,20" mapped-value="2"/>
			</qti-area-mapping>
		</qti-response-declaration>`
		: multiple
			? `<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
				<qti-mapping default-value="-2" lower-bound="1" upper-bound="3">
					<qti-map-entry map-key="A" mapped-value="2"/>
					<qti-map-entry map-key="B" mapped-value="1"/>
				</qti-mapping>
			</qti-response-declaration>`
			: `<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
				<qti-correct-response><qti-value>A</qti-value></qti-correct-response>
				<qti-mapping default-value="0">
					<qti-map-entry map-key="A" mapped-value="2"/>
					<qti-map-entry map-key="B" mapped-value="1"/>
				</qti-mapping>
			</qti-response-declaration>`;

	return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="template-test">
		${responseDeclaration}
		<qti-response-declaration identifier="OTHER" cardinality="single" base-type="identifier">
			<qti-correct-response><qti-value>X</qti-value></qti-correct-response>
			<qti-mapping default-value="0"><qti-map-entry map-key="X" mapped-value="100"/></qti-mapping>
		</qti-response-declaration>
		<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
			<qti-default-value><qti-value>0</qti-value></qti-default-value>
		</qti-outcome-declaration>
		<qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
			<qti-default-value><qti-value>${maxScore}</qti-value></qti-default-value>
		</qti-outcome-declaration>
		<qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier"/>
		<qti-outcome-declaration identifier="FEEDBACKBASIC" cardinality="single" base-type="identifier"/>
		<qti-item-body><p>Template oracle</p></qti-item-body>
		${processing}
	</qti-assessment-item>`;
}

function process(
	processing: string,
	responses: Record<string, unknown>,
	options: { maxScore?: number; point?: boolean; multiple?: boolean } = {},
) {
	const player = new Player({ itemXml: itemXml({ processing, ...options }) });
	player.setResponses(responses);
	return player.processResponses().outcomeValues;
}

function expectFixedTemplateToMatchOfficial(
	name: string,
	responses: Record<string, unknown>,
	options: { maxScore?: number; point?: boolean; multiple?: boolean } = {},
) {
	const actual = process(fixedTemplate(name), responses, options);
	const oracle = process(officialTemplate(name), responses, options);
	for (const identifier of ['SCORE', 'MAXSCORE', 'FEEDBACK', 'FEEDBACKBASIC']) {
		expect(actual[identifier]).toEqual(oracle[identifier]);
	}
	return actual;
}

describe('fixed response-processing templates', () => {
	for (const name of ['match_correct', 'CC2_match']) {
		test(`${name} matches the official template and ignores unrelated responses/MAXSCORE`, () => {
			const correct = expectFixedTemplateToMatchOfficial(name, { RESPONSE: 'A', OTHER: 'wrong' });
			const incorrect = expectFixedTemplateToMatchOfficial(name, { RESPONSE: 'B', OTHER: 'X' });

			expect(correct.SCORE).toBe(1);
			expect(incorrect.SCORE).toBe(0);
		});
	}

	test('CC2_match_basic uses MAXSCORE and sets FEEDBACKBASIC exactly like the official template', () => {
		const correct = expectFixedTemplateToMatchOfficial('CC2_match_basic', {
			RESPONSE: 'A',
			OTHER: 'wrong',
		});
		const incorrect = expectFixedTemplateToMatchOfficial('CC2_match_basic', {
			RESPONSE: 'B',
			OTHER: 'X',
		});

		expect(correct).toMatchObject({ SCORE: 5, FEEDBACKBASIC: 'correct' });
		expect(incorrect).toMatchObject({ SCORE: 0, FEEDBACKBASIC: 'incorrect' });
	});

	test('map_response maps only RESPONSE and handles a null response as zero', () => {
		const mapped = expectFixedTemplateToMatchOfficial('map_response', {
			RESPONSE: 'A',
			OTHER: 'X',
		});
		const empty = expectFixedTemplateToMatchOfficial('map_response', { OTHER: 'X' });

		expect(mapped.SCORE).toBe(2);
		expect(empty.SCORE).toBe(0);
	});

	test('map_response scores a cleared multi-select 0 like the official template, not the bounded empty mapping', () => {
		// The official template guards with isNull, and an empty container is NULL (QTI ASI §5), so
		// a cleared selection scores 0. Mapped, the empty container sums to 0 and lower-bound="1"
		// would clamp it to 1: the guard, not the mapping, decides a cleared response.
		const cleared = expectFixedTemplateToMatchOfficial('map_response', { RESPONSE: [], OTHER: 'X' }, { multiple: true });
		expect(cleared.SCORE).toBe(0);
		const mappedOnly = `<qti-response-processing>
			<qti-set-outcome-value identifier="SCORE"><qti-map-response identifier="RESPONSE"/></qti-set-outcome-value>
		</qti-response-processing>`;
		expect(process(mappedOnly, { RESPONSE: [], OTHER: 'X' }, { multiple: true }).SCORE).toBe(1);

		// A selection is still mapped, within the bounds.
		const selected = expectFixedTemplateToMatchOfficial('map_response', { RESPONSE: ['A', 'B'], OTHER: 'X' }, { multiple: true });
		expect(selected.SCORE).toBe(3);
		const unmapped = expectFixedTemplateToMatchOfficial('map_response', { RESPONSE: ['Z'], OTHER: 'X' }, { multiple: true });
		expect(unmapped.SCORE).toBe(1);
	});

	test('CC2_map_response scores a cleared multi-select 0 like the official template', () => {
		const cleared = expectFixedTemplateToMatchOfficial(
			'CC2_map_response',
			{ RESPONSE: [], OTHER: 'X' },
			{ multiple: true, maxScore: 3 },
		);
		expect(cleared).toMatchObject({ SCORE: 0, FEEDBACK: 'incorrect' });
	});

	test('map_response_point maps only the RESPONSE point and handles null as zero', () => {
		const mapped = expectFixedTemplateToMatchOfficial(
			'map_response_point',
			{ RESPONSE: '50 50', OTHER: 'X' },
			{ point: true },
		);
		const empty = expectFixedTemplateToMatchOfficial(
			'map_response_point',
			{ OTHER: 'X' },
			{ point: true },
		);

		expect(mapped.SCORE).toBe(2);
		expect(empty.SCORE).toBe(0);
	});

	test('CC2_map_response sets SCORE and FEEDBACK like the official template', () => {
		const correct = expectFixedTemplateToMatchOfficial(
			'CC2_map_response',
			{ RESPONSE: 'A', OTHER: 'X' },
			{ maxScore: 2 },
		);
		const incorrect = expectFixedTemplateToMatchOfficial(
			'CC2_map_response',
			{ RESPONSE: 'B', OTHER: 'X' },
			{ maxScore: 2 },
		);

		expect(correct).toMatchObject({ SCORE: 2, FEEDBACK: 'correct' });
		expect(incorrect).toMatchObject({ SCORE: 1, FEEDBACK: 'incorrect' });
	});
});

describe('unsupported response-processing templates', () => {
	test('an unknown template URI fails compilation with a typed error', () => {
		const templateUri = 'https://example.org/rptemplates/vendor_partial_credit.xml';
		let caught: unknown;
		try {
			createAssessmentItemDefinition({
				itemXml: itemXml({ processing: `<qti-response-processing template="${templateUri}"/>` }),
			});
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(UnsupportedResponseProcessingTemplateError);
		expect(caught).toMatchObject({
			code: 'unsupported-response-processing-template',
			templateUri,
			itemIdentifier: 'template-test',
		});
	});

	test('a direct Player construction rejects it too, instead of scoring defaults', () => {
		expect(
			() => new Player({ itemXml: itemXml({ processing: fixedTemplate('no_such_template') }) }),
		).toThrow(UnsupportedResponseProcessingTemplateError);
	});

	test('a template URI with no file name is unsupported', () => {
		expect(
			() => new Player({ itemXml: itemXml({ processing: '<qti-response-processing template="https://example.org/"/>' }) }),
		).toThrow(UnsupportedResponseProcessingTemplateError);
	});

	test('no_response_processing scores nothing, and completes the item', () => {
		const outcomes = process(fixedTemplate('no_response_processing'), { RESPONSE: 'A' });
		expect(outcomes.SCORE).toBe(0);
		// FEEDBACK has no default and the empty template never assigns it: NULL.
		expect(outcomes.FEEDBACK).toBeNull();
		expect(outcomes.MAXSCORE).toBe(5);
	});

	test('inline rules take precedence over an unknown template reference', () => {
		const processing = `<qti-response-processing template="https://example.org/rptemplates/unknown">
			<qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">3</qti-base-value></qti-set-outcome-value>
		</qti-response-processing>`;
		expect(process(processing, { RESPONSE: 'B' }).SCORE).toBe(3);
	});
});
