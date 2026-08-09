import { describe, expect, test } from 'bun:test';
import { sanitizeHtml } from '../core/sanitizer.js';

describe('SMIL animation vocabulary', () => {
	test('removes an active SVG element inside an svg subtree', () => {
		const html = sanitizeHtml(
			'<svg viewBox="0 0 10 10"><rect><set attributeName="href" to="javascript:alert(1)" /></rect></svg>'
		);

		expect(html).not.toContain('<set');
		expect(html).not.toContain('javascript:');
		expect(html).toContain('<rect>');
	});

	test('unwraps the same tag name in item HTML, keeping the stem text', () => {
		const html = sanitizeHtml(
			'<p>Which evidence <set bf=""><strong>best</strong> supports the inference?</set></p>'
		);

		expect(html).not.toContain('<set');
		expect(html).toContain('Which evidence');
		expect(html).toContain('<strong>best</strong> supports the inference?');
	});

	test('sanitizes the children it keeps when unwrapping', () => {
		const html = sanitizeHtml('<p><set><span onclick="alert(1)">Read this</span></set></p>');

		expect(html).not.toContain('onclick');
		expect(html).toContain('Read this');
	});
});

describe('non-QTI custom elements', () => {
	test('unwraps a hyphenated element while preserving readable content', () => {
		const html = sanitizeHtml('<p><vendor-widget>Choose the best answer.</vendor-widget></p>');

		expect(html).not.toContain('vendor-widget');
		expect(html).toContain('Choose the best answer.');
	});
});
