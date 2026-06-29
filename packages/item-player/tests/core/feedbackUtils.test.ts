import { describe, expect, test } from 'bun:test';
import { processFeedbackInline } from '../../src/components/utils/feedbackUtils.js';

describe('processFeedbackInline', () => {
	test('matches feedback identifiers inside multiple outcome values', () => {
		const html = [
			'<p>',
			'<feedbackInline outcomeIdentifier="FEEDBACK" identifier="CORRECT" showHide="show">Correct</feedbackInline>',
			'<feedbackInline outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show">Incorrect</feedbackInline>',
			'</p>',
		].join('');

		const processed = processFeedbackInline(html, {
			outcomeValues: { FEEDBACK: ['SOLUTION', 'SEEN-SOLUTION'] },
		});

		expect(processed).toContain('<p>');
		expect(processed).not.toContain('Correct');
		expect(processed).not.toContain('Incorrect');
		expect(processed).not.toContain('feedbackInline');

		const solutionProcessed = processFeedbackInline(html, {
			outcomeValues: { FEEDBACK: ['CORRECT', 'SEEN-SOLUTION'] },
		});

		expect(solutionProcessed).toContain('Correct');
		expect(solutionProcessed).not.toContain('Incorrect');
		expect(solutionProcessed).not.toContain('feedbackInline');
	});

	test('reads feedback attributes independent of order and quote style', () => {
		const html = [
			'<p>',
			"<feedbackInline showHide='show' identifier='CORRECT' outcomeIdentifier='FEEDBACK'>Correct</feedbackInline>",
			'<feedbackInline showHide="show" identifier="INCORRECT" outcomeIdentifier="FEEDBACK">Incorrect</feedbackInline>',
			'</p>',
		].join('');

		const processed = processFeedbackInline(html, {
			outcomeValues: { FEEDBACK: 'CORRECT' },
		});

		expect(processed).toContain('Correct');
		expect(processed).not.toContain('Incorrect');
		expect(processed).not.toContain('feedbackInline');
	});
});
