/**
 * Tests for standardHottextExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardHottextExtractor } from '../../../src/extraction/extractors/hottextExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardHottextExtractor', () => {
	describe('Single Selection Hottext', () => {
		test('extracts hottextInteraction with single selection', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<prompt>Select the correct word:</prompt>
					<p>The <hottext identifier="H1">cat</hottext> sat on the <hottext identifier="H2">mat</hottext>.</p>
				</hottextInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardHottextExtractor.extract(element, context);

			expect(result.prompt).toBe('Select the correct word:');
			expect(result.maxChoices).toBe(1);
			expect(result.hottextChoices).toHaveLength(2);
			expect(result.hottextChoices[0].identifier).toBe('H1');
			expect(result.hottextChoices[0].text).toBe('cat');
			expect(result.hottextChoices[1].identifier).toBe('H2');
			expect(result.hottextChoices[1].text).toBe('mat');
		});
	});

	describe('Multiple Selection Hottext', () => {
		test('extracts hottextInteraction with multiple selection', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE" maxChoices="3">
					<prompt>Select all nouns:</prompt>
					<p>
						The <hottext identifier="H1">quick</hottext>
						<hottext identifier="H2">fox</hottext>
						<hottext identifier="H3">jumps</hottext> over the
						<hottext identifier="H4">dog</hottext>.
					</p>
				</hottextInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardHottextExtractor.extract(element, context);

			expect(result.maxChoices).toBe(3);
			expect(result.hottextChoices).toHaveLength(4);
			expect(result.hottextChoices[0].text).toBe('quick');
			expect(result.hottextChoices[1].text).toBe('fox');
			expect(result.hottextChoices[2].text).toBe('jumps');
			expect(result.hottextChoices[3].text).toBe('dog');
		});
	});

	describe('Complex Content', () => {
		test('handles hottextInteraction with multiple paragraphs', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE" maxChoices="2">
					<prompt>Select two statements that are facts:</prompt>
					<p><hottext identifier="H1">Water freezes at 0°C</hottext></p>
					<p><hottext identifier="H2">Summer is the best season</hottext></p>
					<p><hottext identifier="H3">The Earth orbits the Sun</hottext></p>
				</hottextInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardHottextExtractor.extract(element, context);

			expect(result.hottextChoices).toHaveLength(3);
			expect(result.hottextChoices[0].text).toBe('Water freezes at 0°C');
			expect(result.hottextChoices[1].text).toBe('Summer is the best season');
			expect(result.hottextChoices[2].text).toBe('The Earth orbits the Sun');
		});

		test('preserves HTML content structure', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<p>Select the verb: The <hottext identifier="H1">dog</hottext> <hottext identifier="H2">barks</hottext> loudly.</p>
				</hottextInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardHottextExtractor.extract(element, context);

			expect(result.contentHtml).toContain('<p>');
			expect(result.contentHtml).toContain('hottext');
		});
	});

	describe('Default Values', () => {
		test('uses default maxChoices when not specified', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE">
					<p>Select: <hottext identifier="H1">option1</hottext></p>
				</hottextInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardHottextExtractor.extract(element, context);

			expect(result.maxChoices).toBe(1);
			expect(result.prompt).toBeNull();
		});
	});

	describe('Edge Cases', () => {
		test('handles empty hottext elements', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<p>Text with <hottext identifier="H1"></hottext> empty hottext.</p>
				</hottextInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardHottextExtractor.extract(element, context);

			expect(result.hottextChoices).toHaveLength(1);
			expect(result.hottextChoices[0].text).toBe('');
		});

		test('handles no hottext elements', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<p>Text without any selectable elements.</p>
				</hottextInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardHottextExtractor.extract(element, context);

			expect(result.hottextChoices).toHaveLength(0);
		});
	});

	describe('canHandle predicate', () => {
		test('handles hottextInteraction element', () => {
			const xml = `
				<hottextInteraction responseIdentifier="RESPONSE">
					<p><hottext identifier="H1">Text</hottext></p>
				</hottextInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardHottextExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-hottextInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardHottextExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct hottext data', () => {
			const data = {
				hottextChoices: [
					{ identifier: 'H1', text: 'Text 1' },
					{ identifier: 'H2', text: 'Text 2' },
				],
				contentHtml: '<p>Content</p>',
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardHottextExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for empty hottextChoices', () => {
			const data = {
				hottextChoices: [],
				contentHtml: '<p>Content</p>',
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardHottextExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('hottextInteraction must have at least one hottext');
		});

		test('reports error for duplicate identifiers', () => {
			const data = {
				hottextChoices: [
					{ identifier: 'H1', text: 'Text 1' },
					{ identifier: 'H1', text: 'Text 2' },
				],
				contentHtml: '<p>Content</p>',
				maxChoices: 1,
				prompt: null,
			};

			const validation = standardHottextExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('Duplicate hottext identifier: H1');
		});

		test('reports warning when maxChoices exceeds hottext count', () => {
			const data = {
				hottextChoices: [
					{ identifier: 'H1', text: 'Text 1' },
					{ identifier: 'H2', text: 'Text 2' },
				],
				contentHtml: '<p>Content</p>',
				maxChoices: 5,
				prompt: null,
			};

			const validation = standardHottextExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('maxChoices (5) exceeds the number of hottext choices (2)');
		});
	});
});
