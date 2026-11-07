import { describe, expect, test } from 'vitest';
import { accessibleTextFromHtml } from '../../src/shared/utils/accessibleText.js';

describe('accessibleTextFromHtml', () => {
	test('reads plain text content', () => {
		expect(accessibleTextFromHtml('<p>Paris</p>')).toBe('Paris');
	});

	test('reads an image-only choice through its alt text', () => {
		expect(accessibleTextFromHtml('<img src="sun.png" alt="Sun icon">')).toBe('Sun icon');
	});

	test('reads image alt inline with surrounding text', () => {
		expect(accessibleTextFromHtml('Before <img src="a.png" alt="the sun"> after')).toBe('Before the sun after');
	});

	test('reads MathML alttext instead of flattening the markup', () => {
		// textContent of this markup is "x2"; the alt text is the readable form.
		const mathml = '<math alttext="x squared"><msup><mi>x</mi><mn>2</mn></msup></math>';
		expect(accessibleTextFromHtml(mathml)).toBe('x squared');
	});

	test('reads an SVG through its title element', () => {
		const svg = '<svg><title>A red triangle</title><path d="M0 0"/></svg>';
		expect(accessibleTextFromHtml(svg)).toBe('A red triangle');
	});

	test('skips aria-hidden content', () => {
		expect(accessibleTextFromHtml('Visible <span aria-hidden="true">hidden</span>')).toBe('Visible');
	});

	test('collapses whitespace', () => {
		expect(accessibleTextFromHtml('<p>Hello\n  <b>world</b></p>\t')).toBe('Hello world');
	});

	test('returns empty string for empty or null content', () => {
		expect(accessibleTextFromHtml('')).toBe('');
		expect(accessibleTextFromHtml(null)).toBe('');
		expect(accessibleTextFromHtml(undefined)).toBe('');
	});

	test('returns empty string for content with nothing readable (caller picks the fallback)', () => {
		expect(accessibleTextFromHtml('<img src="a.png" alt="">')).toBe('');
	});
});
