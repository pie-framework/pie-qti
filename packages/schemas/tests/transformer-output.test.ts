/**
 * Schema vs transformer contract tests.
 *
 * The schemas here were originally synced from the upstream pie-elements repo;
 * their `required`/`additionalProperties` are now aligned to what THIS repo's
 * QTI-to-PIE transformers emit, so these tests run the real transformers and
 * validate their output against the schemas.
 *
 * Provenance of the wiring (test-only, no package dependency): the tests read
 * to-pie's QTI fixtures read-only via a relative path and import the to-pie
 * transformer sources directly. Nothing here is published and no manifest
 * dependency on @pie-qti/to-pie is declared; if to-pie's source layout moves,
 * this test fails loudly instead of the contract drifting silently.
 */

import { describe, expect, test } from 'bun:test';
import Ajv from 'ajv';
import { parse } from 'node-html-parser';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadSchema } from '../src/index.js';
import { transformMatch } from '../../to-pie/src/transformers/match.js';
import { transformMultipleChoice } from '../../to-pie/src/transformers/multiple-choice.js';

const TO_PIE_FIXTURES = resolve(import.meta.dirname, '../../to-pie/tests/fixtures');

function parseQtiItem(qtiXml: string) {
	const doc = parse(qtiXml, { lowerCaseTagName: false, comment: false });
	const itemElement =
		doc.querySelector('assessmentItem') || doc.getElementsByTagName('assessmentItem')[0];
	if (!itemElement) {
		throw new Error('No assessmentItem element found in QTI XML');
	}
	return itemElement;
}

async function readFixture(...segments: string[]): Promise<string> {
	return readFile(resolve(TO_PIE_FIXTURES, ...segments), 'utf-8');
}

function compile(schema: object) {
	const ajv = new Ajv({ allErrors: true, strict: false });
	return ajv.compile(schema);
}

describe('schema vs to-pie transformer output', () => {
	test('multiple-choice.json accepts multiple-choice transformer output', async () => {
		const schema = await loadSchema('multiple-choice');
		const validate = compile(schema);

		const qtiXml = await readFixture('multiple-choice.xml');
		const item = await transformMultipleChoice(parseQtiItem(qtiXml), 'mc-basic-001');
		const model = item.config.models[0];

		const valid = validate(model);
		expect(valid).toBe(true);
		expect(validate.errors).toBeNull();
	});

	test('multiple-choice.json accepts grid-layout transformer output', async () => {
		const schema = await loadSchema('multiple-choice');
		const validate = compile(schema);

		const qtiXml = await readFixture('conversion-fidelity', 'orientation-grid.xml');
		const item = await transformMultipleChoice(parseQtiItem(qtiXml), 'cf-orientation-grid-001');
		const model = item.config.models[0];

		// The grid orientation collapses onto the schema's optional layout fields.
		expect(model.choicesLayout).toBe('grid');
		expect(model.gridColumns).toBe(2);

		const valid = validate(model);
		expect(valid).toBe(true);
		expect(validate.errors).toBeNull();
	});

	test('match.json accepts match transformer output', async () => {
		const schema = await loadSchema('match');
		const validate = compile(schema);

		const qtiXml = await readFixture('match.xml');
		const item = transformMatch(qtiXml, 'ma-basic-001');
		const model = item.config.models[0];

		const valid = validate(model);
		expect(valid).toBe(true);
		expect(validate.errors).toBeNull();
	});

	test('schemas still reject models that omit required fields', async () => {
		const mcSchema = await loadSchema('multiple-choice');
		const mcValidate = compile(mcSchema);
		const validMc = mcValidate({
			id: 'x',
			element: '@pie-element/multiple-choice',
			prompt: 'p',
			choiceMode: 'radio',
			correctResponse: [],
			partialScoring: false,
			shuffle: false,
		});
		expect(validMc).toBe(false);
		expect(mcValidate.errors?.some((e) => e.message?.includes("must have required property 'choices'"))).toBe(true);

		const matchSchema = await loadSchema('match');
		const matchValidate = compile(matchSchema);
		const validMatch = matchValidate({
			id: 'x',
			element: '@pie-element/match',
			prompt: 'p',
			choiceMode: 'radio',
			lockChoiceOrder: false,
			partialScoring: false,
			layout: 1,
			headers: [''],
		});
		expect(validMatch).toBe(false);
		expect(matchValidate.errors?.some((e) => e.message?.includes("must have required property 'rows'"))).toBe(true);
	});

	test('multiple-choice.json rejects properties outside the transformer contract', async () => {
		const schema = await loadSchema('multiple-choice');
		const validate = compile(schema);

		const valid = validate({
			id: 'x',
			element: '@pie-element/multiple-choice',
			prompt: 'p',
			choices: [{ label: 'a', value: 'a' }],
			choiceMode: 'radio',
			correctResponse: ['a'],
			partialScoring: false,
			shuffle: false,
			notAPieProperty: true,
		});
		expect(valid).toBe(false);
		expect(validate.errors?.some((e) => e.message === 'must NOT have additional properties')).toBe(true);
	});
});
