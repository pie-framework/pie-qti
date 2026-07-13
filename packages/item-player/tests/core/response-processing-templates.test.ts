import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Player } from '../../src/core/Player.js';

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
}: {
	processing: string;
	maxScore?: number;
	point?: boolean;
}): string {
	const responseDeclaration = point
		? `<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="point">
			<qti-area-mapping default-value="0">
				<qti-area-map-entry shape="circle" coords="50,50,20" mapped-value="2"/>
			</qti-area-mapping>
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
	options: { maxScore?: number; point?: boolean } = {},
) {
	const player = new Player({ itemXml: itemXml({ processing, ...options }) });
	player.setResponses(responses);
	return player.processResponses().outcomeValues;
}

function expectFixedTemplateToMatchOfficial(
	name: string,
	responses: Record<string, unknown>,
	options: { maxScore?: number; point?: boolean } = {},
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
