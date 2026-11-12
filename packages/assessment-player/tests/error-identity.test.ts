/**
 * A coded error is recognized whichever copy of the errors module created it.
 *
 * Copies are routine: the player-elements bundle compiles the shell and core from source
 * while importing this package's built entry (and that bundle inlines its own copy beside
 * any `@pie-qti/assessment-player` a host loads). With an `instanceof` check, the core's
 * errors failed the element's check, so the `player-error` event lost its `code`.
 */

import { describe, expect, test } from 'bun:test';
import {
	AssessmentPlayerError,
	assessmentErrorDisplay,
	isAssessmentPlayerError,
	isSubmissionBlockedError,
} from '../src/core/errors.js';

type ErrorsModule = typeof import('../src/core/errors.js');

/**
 * A second evaluation of errors.ts. Bun keys modules by the full specifier, query included,
 * so this is the same source loaded twice, as in a bundle that carries two copies.
 */
async function secondCopy(): Promise<ErrorsModule> {
	const specifier = '../src/core/errors.ts?second-copy';
	const copy = (await import(specifier)) as ErrorsModule;
	expect(copy.AssessmentPlayerError).not.toBe(AssessmentPlayerError);
	return copy;
}

describe('AssessmentPlayerError across module copies', () => {
	test('an error from the other copy is a coded error, in both directions', async () => {
		const copy = await secondCopy();

		expect(isAssessmentPlayerError(new copy.AssessmentPlayerError('submitFailed', 'Backend down'))).toBe(true);
		expect(copy.isAssessmentPlayerError(new AssessmentPlayerError('submitFailed', 'Backend down'))).toBe(true);
	});

	test('the checks built on it accept the other copy too', async () => {
		const copy = await secondCopy();

		expect(isSubmissionBlockedError(new copy.AssessmentPlayerError('finalizeResponseRequired', 'Unanswered'))).toBe(
			true,
		);
		expect(assessmentErrorDisplay(new copy.AssessmentPlayerError('submitFailed', 'Backend down'))).toEqual({
			i18nKey: 'assessment.errors.codes.submitFailed',
			params: {},
			supportCode: 'submitFailed',
		});
	});

	test('anything else is still not a coded error', () => {
		expect(isAssessmentPlayerError(new Error('Backend down'))).toBe(false);
		expect(isAssessmentPlayerError({ name: 'AssessmentPlayerError', code: 'submitFailed', message: 'x' })).toBe(false);
		expect(isAssessmentPlayerError(undefined)).toBe(false);
		expect(isAssessmentPlayerError('submitFailed')).toBe(false);
	});
});
