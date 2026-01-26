/**
 * Tests for standardEndAttemptExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardEndAttemptExtractor } from '../../../src/extraction/extractors/endAttemptExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardEndAttemptExtractor', () => {
	test('extracts endAttemptInteraction with title and prompt', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="RESPONSE" title="Finish Test">
				<prompt>Click the button below to end your attempt</prompt>
			</endAttemptInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.title).toBe('Finish Test');
		expect(result.prompt).toBe('Click the button below to end your attempt');
	});

	test('uses default title when title attribute is missing', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="RESPONSE">
				<prompt>End the test</prompt>
			</endAttemptInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.title).toBe('End Attempt');
	});

	test('handles missing prompt', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="RESPONSE" title="Submit"/>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.prompt).toBeNull();
		expect(result.title).toBe('Submit');
	});

	test('handles self-closing tag', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="RESPONSE" title="End Test"/>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.title).toBe('End Test');
		expect(result.prompt).toBeNull();
	});

	test('extracts endAttemptInteraction with different title', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="END_RESPONSE" title="Complete Assessment">
				<prompt>You may end the assessment at any time</prompt>
			</endAttemptInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'END_RESPONSE');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.title).toBe('Complete Assessment');
		expect(result.prompt).toBe('You may end the assessment at any time');
	});

	test('defaults countAttempt to true when attribute is missing', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="RESPONSE" title="Submit"/>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.countAttempt).toBe(true);
	});

	test('sets countAttempt to false when explicitly set', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="HINT" title="Request Hint" countAttempt="false">
				<prompt>Click for a hint (does not count as an attempt)</prompt>
			</endAttemptInteraction>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'HINT');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.countAttempt).toBe(false);
		expect(result.title).toBe('Request Hint');
		expect(result.prompt).toContain('does not count as an attempt');
	});

	test('sets countAttempt to true when explicitly set to true', () => {
		const xml = `
			<endAttemptInteraction responseIdentifier="RESPONSE" title="Submit Answer" countAttempt="true"/>
		`;

		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardEndAttemptExtractor.extract(element, context);

		expect(result.countAttempt).toBe(true);
	});

	describe('canHandle predicate', () => {
		test('handles endAttemptInteraction element', () => {
			const xml = `<endAttemptInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardEndAttemptExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-endAttemptInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardEndAttemptExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct endAttempt data', () => {
			const data = {
				title: 'Submit Test',
				countAttempt: true,
				prompt: null,
			};

			const validation = standardEndAttemptExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for missing title', () => {
			const data = {
				title: '',
				countAttempt: true,
				prompt: null,
			};

			const validation = standardEndAttemptExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('endAttemptInteraction must have a title');
		});

		test('reports warning when countAttempt is false', () => {
			const data = {
				title: 'Request Hint',
				countAttempt: false,
				prompt: null,
			};

			const validation = standardEndAttemptExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'endAttemptInteraction has countAttempt=false - make sure this is intentional'
			);
		});
	});
});
