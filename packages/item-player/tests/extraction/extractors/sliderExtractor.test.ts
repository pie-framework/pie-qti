/**
 * Tests for standardSliderExtractor
 */

import { describe, expect, test } from 'bun:test';
import { standardSliderExtractor } from '../../../src/extraction/extractors/sliderExtractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardSliderExtractor', () => {
	test('extracts basic slider interaction', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="RESPONSE"
				lowerBound="0"
				upperBound="100"
				step="1"
			>
				<prompt>Rate your satisfaction (0-100)</prompt>
			</sliderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.lowerBound).toBe(0);
		expect(result.upperBound).toBe(100);
		expect(result.step).toBe(1);
		expect(result.prompt).toBe('Rate your satisfaction (0-100)');
	});

	test('uses default values when attributes not specified', () => {
		const xml = `<sliderInteraction responseIdentifier="RESPONSE" />`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.lowerBound).toBe(0);
		expect(result.upperBound).toBe(100);
		expect(result.step).toBe(1);
		expect(result.orientation).toBe('horizontal');
		expect(result.reverse).toBe(false);
	});

	test('handles custom bounds and step', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="RESPONSE"
				lowerBound="10"
				upperBound="50"
				step="5"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.lowerBound).toBe(10);
		expect(result.upperBound).toBe(50);
		expect(result.step).toBe(5);
	});

	test('handles decimal step values', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="RESPONSE"
				lowerBound="0"
				upperBound="10"
				step="0.5"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.step).toBe(0.5);
	});

	test('handles vertical orientation', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="RESPONSE"
				orientation="vertical"
				lowerBound="0"
				upperBound="100"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.orientation).toBe('vertical');
	});

	test('handles reverse attribute', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="RESPONSE"
				reverse="true"
				lowerBound="0"
				upperBound="100"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.reverse).toBe(true);
	});

	test('handles negative bounds', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="RESPONSE"
				lowerBound="-50"
				upperBound="50"
				step="10"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.lowerBound).toBe(-50);
		expect(result.upperBound).toBe(50);
	});

	test('handles interaction without prompt', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="RESPONSE"
				lowerBound="0"
				upperBound="10"
			/>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.prompt).toBe(null);
	});

	test('handles temperature scale example', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="TEMP"
				lowerBound="-40"
				upperBound="120"
				step="1"
				orientation="vertical"
			>
				<prompt>Set temperature (°F)</prompt>
			</sliderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.lowerBound).toBe(-40);
		expect(result.upperBound).toBe(120);
		expect(result.orientation).toBe('vertical');
		expect(result.prompt).toContain('temperature');
	});

	test('handles percentage scale with decimals', () => {
		const xml = `
			<sliderInteraction
				responseIdentifier="PERCENT"
				lowerBound="0"
				upperBound="1"
				step="0.01"
			>
				<prompt>Select percentage (0.00 - 1.00)</prompt>
			</sliderInteraction>
		`;
		const element = parseQTI(xml);
		const context = createTestContext(element, 'RESPONSE');

		const result = standardSliderExtractor.extract(element, context);

		expect(result.lowerBound).toBe(0);
		expect(result.upperBound).toBe(1);
		expect(result.step).toBe(0.01);
	});

	describe('canHandle predicate', () => {
		test('handles sliderInteraction element', () => {
			const xml = `<sliderInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardSliderExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-sliderInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardSliderExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct slider data', () => {
			const data = {
				lowerBound: 0,
				upperBound: 100,
				step: 1,
				orientation: 'horizontal',
				reverse: false,
				prompt: null,
			};

			const validation = standardSliderExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error when lowerBound >= upperBound', () => {
			const data = {
				lowerBound: 100,
				upperBound: 0,
				step: 1,
				orientation: 'horizontal',
				reverse: false,
				prompt: null,
			};

			const validation = standardSliderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('lowerBound must be less than upperBound');
		});

		test('reports error for non-positive step', () => {
			const data = {
				lowerBound: 0,
				upperBound: 100,
				step: 0,
				orientation: 'horizontal',
				reverse: false,
				prompt: null,
			};

			const validation = standardSliderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('step must be greater than 0');
		});

		test('reports error for invalid orientation', () => {
			const data = {
				lowerBound: 0,
				upperBound: 100,
				step: 1,
				orientation: 'diagonal',
				reverse: false,
				prompt: null,
			};

			const validation = standardSliderExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('orientation must be "horizontal" or "vertical"');
		});

		test('reports warning when step > range', () => {
			const data = {
				lowerBound: 0,
				upperBound: 10,
				step: 20,
				orientation: 'horizontal',
				reverse: false,
				prompt: null,
			};

			const validation = standardSliderExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain('step (20) is larger than the range (10)');
		});
	});
});
