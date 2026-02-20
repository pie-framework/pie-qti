/**
 * Test Assertion Helpers
 * Common assertions for testing transforms, PIE models, and QTI content
 */

import type { TransformOutput } from '@pie-qti/transform-types';
import { expect } from 'bun:test';

/**
 * Assert that a PIE model has the expected basic structure
 *
 * @param model PIE model object to validate
 *
 * @example
 * ```typescript
 * const result = await transform(qti);
 * expectValidPieModel(result.items[0]);
 * ```
 */
export function expectValidPieModel(model: any): void {
	expect(model).toBeDefined();
	expect(model).toBeObject();

	// Core PIE model fields
	expect(model.id).toBeDefined();
	expect(typeof model.id).toBe('string');

	expect(model.element).toBeDefined();
	expect(typeof model.element).toBe('string');

	// Optional but common fields
	if (model.promptEnabled !== undefined) {
		expect(typeof model.promptEnabled).toBe('boolean');
	}

	if (model.rationaleEnabled !== undefined) {
		expect(typeof model.rationaleEnabled).toBe('boolean');
	}

	if (model.teacherInstructionsEnabled !== undefined) {
		expect(typeof model.teacherInstructionsEnabled).toBe('boolean');
	}
}

/**
 * Assert that a transform result is successful and has items
 *
 * @param result Transform output to validate
 * @param expectedItemCount Optional expected number of items (default: at least 1)
 *
 * @example
 * ```typescript
 * const result = await engine.transform(input, options);
 * expectSuccessfulTransform(result, 3); // Expect exactly 3 items
 * ```
 */
export function expectSuccessfulTransform(
	result: TransformOutput,
	expectedItemCount?: number,
): void {
	expect(result).toBeDefined();
	expect(result.items).toBeDefined();
	expect(Array.isArray(result.items)).toBe(true);

	if (expectedItemCount !== undefined) {
		expect(result.items.length).toBe(expectedItemCount);
	} else {
		expect(result.items.length).toBeGreaterThan(0);
	}

	expect(result.metadata).toBeDefined();
	expect(result.metadata.sourceFormat).toBeDefined();
	expect(result.metadata.targetFormat).toBeDefined();
	expect(result.metadata.pluginId).toBeDefined();
	expect(result.metadata.timestamp).toBeInstanceOf(Date);
}

/**
 * Assert that a QTI round-trip transformation is lossless
 * Tests: QTI → PIE → QTI produces equivalent XML
 *
 * @param originalQti Original QTI XML string
 * @param engine Transform engine with plugins
 * @param normalizeWhitespace Whether to normalize whitespace before comparison (default: true)
 *
 * @example
 * ```typescript
 * await expectLosslessRoundTrip(originalQti, engine);
 * ```
 */
export async function expectLosslessRoundTrip(
	originalQti: string,
	engine: any, // Using 'any' for now since we can't easily import TransformEngine
	normalizeWhitespace = true,
): Promise<void> {
	// QTI → PIE
	const pieHandle = await engine.transform(originalQti, {
		sourceFormat: 'qti22',
		targetFormat: 'pie',
	});
	const pieResult = await pieHandle.result();

	expectSuccessfulTransform(pieResult);
	expect(pieResult.items.length).toBeGreaterThan(0);

	// PIE → QTI
	const qtiHandle = await engine.transform(pieResult.items[0], {
		sourceFormat: 'pie',
		targetFormat: 'qti22',
	});
	const qtiResult = await qtiHandle.result();

	expectSuccessfulTransform(qtiResult);

	// Compare XML
	const normalize = (xml: string) => {
		if (!normalizeWhitespace) return xml;
		return xml
			.replace(/\s+/g, ' ') // Collapse whitespace
			.replace(/>\s+</g, '><') // Remove whitespace between tags
			.trim();
	};

	const normalizedOriginal = normalize(originalQti);
	const normalizedResult = normalize(qtiResult.items[0].content || '');

	expect(normalizedResult).toBe(normalizedOriginal);
}

/**
 * Assert that a choice interaction has expected properties
 *
 * @param interaction Interaction object to validate
 * @param expectedChoiceCount Expected number of choices
 *
 * @example
 * ```typescript
 * expectValidChoiceInteraction(model, 4);
 * ```
 */
export function expectValidChoiceInteraction(
	interaction: any,
	expectedChoiceCount?: number,
): void {
	expect(interaction).toBeDefined();
	expect(interaction.choices).toBeDefined();
	expect(Array.isArray(interaction.choices)).toBe(true);

	if (expectedChoiceCount !== undefined) {
		expect(interaction.choices.length).toBe(expectedChoiceCount);
	}

	// Validate each choice has required fields
	for (const choice of interaction.choices) {
		expect(choice.identifier).toBeDefined();
		expect(typeof choice.identifier).toBe('string');
		expect(choice.text).toBeDefined();
		expect(typeof choice.text).toBe('string');
	}
}

/**
 * Assert that an error result has the expected structure
 *
 * @param result Transform output that should contain an error
 * @param expectedErrorMessage Optional substring to match in error message
 *
 * @example
 * ```typescript
 * expectTransformError(result, 'Invalid QTI XML');
 * ```
 */
export function expectTransformError(
	result: any,
	expectedErrorMessage?: string,
): void {
	expect(result).toBeDefined();
	expect(result.errors).toBeDefined();
	expect(Array.isArray(result.errors)).toBe(true);
	expect(result.errors.length).toBeGreaterThan(0);

	if (expectedErrorMessage) {
		const errorMessages = result.errors.map((e: any) => e.message).join(' ');
		expect(errorMessages).toContain(expectedErrorMessage);
	}
}

/**
 * Assert that metadata contains expected fields
 *
 * @param metadata Transform metadata object
 * @param expectedFields Expected field names and their types
 *
 * @example
 * ```typescript
 * expectMetadata(result.metadata, {
 *   vendor: 'string',
 *   processingTime: 'number',
 * });
 * ```
 */
export function expectMetadata(
	metadata: any,
	expectedFields: Record<string, string>,
): void {
	expect(metadata).toBeDefined();

	for (const [field, expectedType] of Object.entries(expectedFields)) {
		expect(metadata[field]).toBeDefined();
		expect((typeof metadata[field]) === expectedType).toBe(true);
	}
}

/**
 * Assert that an array contains objects with specific property values
 *
 * @param array Array to search
 * @param property Property name to check
 * @param expectedValues Expected values
 *
 * @example
 * ```typescript
 * expectArrayContains(model.choices, 'identifier', ['A', 'B', 'C']);
 * ```
 */
export function expectArrayContains<T>(
	array: T[],
	property: keyof T,
	expectedValues: any[],
): void {
	expect(array).toBeDefined();
	expect(Array.isArray(array)).toBe(true);

	const actualValues = array.map((item) => item[property]);

	for (const expectedValue of expectedValues) {
		expect(actualValues).toContain(expectedValue);
	}
}
