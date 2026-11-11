/**
 * Test Assertion Helpers
 * Common assertions for testing transforms and PIE models
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
