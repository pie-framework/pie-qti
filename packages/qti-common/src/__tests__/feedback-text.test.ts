import { describe, expect, test } from 'bun:test';
import { feedbackInlineAttr, processFeedbackInline } from '../index.js';

describe('feedbackInlineAttr', () => {
	test('reads an attribute in either QTI spelling', () => {
		const camel = 'identifier="A" outcomeIdentifier="FEEDBACK" showHide="show"';
		expect(feedbackInlineAttr(camel, 'identifier')).toBe('A');
		expect(feedbackInlineAttr(camel, 'outcomeIdentifier')).toBe('FEEDBACK');
		expect(feedbackInlineAttr(camel, 'showHide')).toBe('show');

		const kebab = 'identifier="A" outcome-identifier="FEEDBACK" show-hide="hide"';
		expect(feedbackInlineAttr(kebab, 'identifier')).toBe('A');
		expect(feedbackInlineAttr(kebab, 'outcomeIdentifier')).toBe('FEEDBACK');
		expect(feedbackInlineAttr(kebab, 'showHide')).toBe('hide');
	});

	test('reads single-quoted values and gives null for an absent attribute', () => {
		expect(feedbackInlineAttr("identifier='B'", 'identifier')).toBe('B');
		expect(feedbackInlineAttr('other="x"', 'identifier')).toBeNull();
	});

	test('repeated calls agree: the attribute matchers are compiled once and reused', () => {
		const attrs = 'identifier="A" outcome-identifier="FEEDBACK"';
		const first = [feedbackInlineAttr(attrs, 'identifier'), feedbackInlineAttr(attrs, 'outcomeIdentifier')];
		for (let i = 0; i < 5; i++) {
			expect([feedbackInlineAttr(attrs, 'identifier'), feedbackInlineAttr(attrs, 'outcomeIdentifier')]).toEqual(first);
		}
	});
});

describe('processFeedbackInline', () => {
	test('shows the feedback whose identifier the outcome holds', () => {
		const html = '<p>Hi<feedbackInline identifier="RIGHT" outcomeIdentifier="FEEDBACK">correct!</feedbackInline>'
			+ '<feedbackInline identifier="WRONG" outcomeIdentifier="FEEDBACK">wrong</feedbackInline></p>';
		expect(processFeedbackInline(html, { outcomeValues: { FEEDBACK: 'RIGHT' } })).toBe('<p>Hicorrect!</p>');
	});

	test('reads QTI 3 kebab-case attributes on qti-feedback-inline', () => {
		const html = '<p>Hi<qti-feedback-inline identifier="RIGHT" outcome-identifier="FEEDBACK">correct!</qti-feedback-inline>'
			+ '<qti-feedback-inline identifier="WRONG" outcome-identifier="FEEDBACK">wrong</qti-feedback-inline></p>';
		expect(processFeedbackInline(html, { outcomeValues: { FEEDBACK: 'RIGHT' } })).toBe('<p>Hicorrect!</p>');
	});

	test('showHide="hide" hides the matching element and keeps the rest', () => {
		const html = '<feedbackInline identifier="SEEN" outcomeIdentifier="OUT" showHide="hide">gone</feedbackInline>'
			+ '<feedbackInline identifier="OTHER" outcomeIdentifier="OUT" showHide="hide">kept</feedbackInline>';
		expect(processFeedbackInline(html, { outcomeValues: { OUT: 'SEEN' } })).toBe('kept');
	});

	test('repeated runs of the same document give the same result', () => {
		const html = '<qti-feedback-block identifier="F1" outcome-identifier="FB">text</qti-feedback-block>';
		const first = processFeedbackInline(html, { outcomeValues: { FB: 'F1' } });
		expect(processFeedbackInline(html, { outcomeValues: { FB: 'F1' } })).toBe(first);
	});
});
