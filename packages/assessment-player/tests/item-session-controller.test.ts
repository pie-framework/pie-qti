/**
 * ItemSessionController QTI defaults (issue: maxAttempts default).
 *
 * QTI itemSessionControl defaults are one attempt (0 = unlimited, for adaptive items),
 * feedback/solution/comment off, review and skipping on, response validation off. The
 * controller previously defaulted maxAttempts to 0 (unlimited), silently granting
 * unlimited retries on every non-adaptive item.
 */

import { describe, expect, test } from 'bun:test';
import { ItemSessionController } from '../src/core/ItemSessionController.js';

describe('ItemSessionController QTI defaults', () => {
	test('defaults match the QTI itemSessionControl defaults', () => {
		const controller = new ItemSessionController();
		expect(controller.getSettings()).toEqual({
			maxAttempts: 1,
			showFeedback: false,
			allowReview: true,
			showSolution: false,
			allowComment: false,
			allowSkipping: true,
			validateResponses: false,
		});
	});

	test('maxAttempts=1 allows exactly one submission', () => {
		const controller = new ItemSessionController();
		controller.initializeItem('a');
		expect(controller.canSubmit('a')).toBe(true);
		expect(controller.getRemainingAttempts('a')).toBe(1);

		controller.recordAttempt('a');
		expect(controller.canSubmit('a')).toBe(false);
		expect(controller.getRemainingAttempts('a')).toBe(0);
	});

	test('maxAttempts=0 stays unlimited for adaptive delivery', () => {
		const controller = new ItemSessionController({ maxAttempts: 0 });
		controller.initializeItem('adaptive');
		controller.recordAttempt('adaptive');
		controller.recordAttempt('adaptive');
		expect(controller.canSubmit('adaptive')).toBe(true);
		expect(controller.getRemainingAttempts('adaptive')).toBeNull();
	});

	test('per-item settings override the shared defaults without leaking', () => {
		const controller = new ItemSessionController();
		controller.setItemSettings('b', { maxAttempts: 3 });
		controller.initializeItem('b');
		controller.recordAttempt('b');

		expect(controller.getRemainingAttempts('b')).toBe(2);
		expect(controller.getRemainingAttempts('a')).toBeNull();
		controller.initializeItem('a');
		expect(controller.getRemainingAttempts('a')).toBe(1);
		expect(controller.getItemSettings('b').maxAttempts).toBe(3);
	});
});
