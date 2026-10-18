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

	test('reads QTI 3 spellings without taking identifier from outcome-identifier', () => {
		const html =
			'<p><qti-feedback-inline identifier="CORRECT" outcome-identifier="FEEDBACK" show-hide="hide">Hidden</qti-feedback-inline>' +
			'<qti-feedback-inline outcome-identifier="CORRECT" identifier="FEEDBACK">Unmatched</qti-feedback-inline></p>';
		expect(processFeedbackInline(html, { outcomeValues: { FEEDBACK: 'CORRECT', CORRECT: 'X' } })).toBe('<p></p>');
		expect(processFeedbackInline(html, { outcomeValues: { FEEDBACK: 'OTHER' } })).toBe('<p>Hidden</p>');
	});

	test('resolves nested feedback inside shown feedback and drops it with hidden feedback', () => {
		const html =
			'<feedbackInline outcomeIdentifier="F" identifier="A">a[<feedbackInline outcomeIdentifier="F" identifier="B">b</feedbackInline>' +
			'<feedbackInline outcomeIdentifier="F" identifier="C">c</feedbackInline>]</feedbackInline>' +
			'<feedbackInline outcomeIdentifier="F" identifier="D">d<feedbackInline outcomeIdentifier="F" identifier="B">b</feedbackInline></feedbackInline>';
		expect(processFeedbackInline(html, { outcomeValues: { F: ['A', 'B'] } })).toBe('a[b]');
		expect(processFeedbackInline(html, { outcomeValues: { F: ['B', 'D'] } })).toBe('db');
	});

	test('shows showHide="hide" feedback while the outcome is NULL', () => {
		const html = '<feedbackInline outcomeIdentifier="F" identifier="A" showHide="hide">until A</feedbackInline>';
		expect(processFeedbackInline(html, { outcomeValues: {} })).toBe('until A');
		expect(processFeedbackInline(html, { outcomeValues: { F: 'A' } })).toBe('');
	});

	test('drops empty feedback and leaves an unclosed element as written', () => {
		expect(processFeedbackInline('x<feedbackInline outcomeIdentifier="F" identifier="A"/>y', { outcomeValues: { F: 'A' } })).toBe(
			'xy'
		);
		const unclosed = 'x<feedbackInline outcomeIdentifier="F" identifier="A">y';
		expect(processFeedbackInline(unclosed, { outcomeValues: { F: 'A' } })).toBe(unclosed);
	});

	test('resolves feedbackBlock in both spellings, nested with feedbackInline, without a span wrap', () => {
		const html =
			'<feedbackBlock outcomeIdentifier="F" identifier="A"><p>a<feedbackInline outcomeIdentifier="F" identifier="B">b</feedbackInline></p></feedbackBlock>' +
			'<qti-feedback-block outcome-identifier="F" identifier="C" show-hide="hide"><p>c</p></qti-feedback-block>';
		expect(processFeedbackInline(html, { outcomeValues: { F: ['A', 'C'] } })).toBe('<p>a</p>');
		expect(processFeedbackInline(html, { outcomeValues: { F: ['A', 'B'] }, wrapWithSpan: true })).toBe(
			'<p>a <span class="qti-feedback-inline">b</span></p><p>c</p>'
		);
	});
});
