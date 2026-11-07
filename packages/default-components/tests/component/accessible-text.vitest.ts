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

	test('a label-wrapped input reads the label text once (the control adds nothing)', () => {
		expect(accessibleTextFromHtml('<label><input type="checkbox"> Apples</label>')).toBe('Apples');
		expect(accessibleTextFromHtml('<label><input type="radio" value="pears"><span>Pears</span></label>')).toBe('Pears');
	});

	test('a label associated by for= and its input read the label text once', () => {
		expect(accessibleTextFromHtml('<label for="fruit">Apples</label><input id="fruit" type="checkbox">')).toBe('Apples');
	});

	test('button content is read once, including an image alt inside it', () => {
		expect(accessibleTextFromHtml('<button type="button">Show hint</button>')).toBe('Show hint');
		expect(accessibleTextFromHtml('<button type="button"><img src="x.png" alt="Close"></button>')).toBe('Close');
	});

	test('a decorative icon inside a label or button is skipped', () => {
		expect(accessibleTextFromHtml('<label><span aria-hidden="true">★</span> Favourite</label>')).toBe('Favourite');
		expect(accessibleTextFromHtml('<button><svg aria-hidden="true"><path d="M0 0"/></svg> Next</button>')).toBe('Next');
	});

	test('an aria-hidden icon is skipped even when it carries alt text or a title (no doubled name)', () => {
		// A hidden icon beside the same visible word must not read twice ("Close Close").
		expect(accessibleTextFromHtml('<button><img src="x.svg" alt="Close" aria-hidden="true"> Close</button>')).toBe('Close');
		expect(accessibleTextFromHtml('<label><svg aria-hidden="true"><title>Star</title></svg> Favourite</label>')).toBe('Favourite');
		expect(accessibleTextFromHtml('<math alttext="x squared" aria-hidden="true"></math><span>x squared</span>')).toBe('x squared');
	});
});
