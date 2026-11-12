/**
 * The inline style of a text-entry blank: the authored expectedLength as its width, and a cap
 * that keeps the blank inside its container (WCAG 2.2 SC 1.4.10 Reflow) — at a 320 CSS px
 * viewport (400% zoom), an authored width larger than the viewport must not force
 * two-dimensional scrolling.
 */

import { describe, expect, test } from 'bun:test';
import { textEntryInputStyle } from '../../src/interactions/text-entry/inlineInputStyle.js';

describe('textEntryInputStyle', () => {
	test('a long authored expectedLength is capped at its container', () => {
		const style = textEntryInputStyle({ expectedLength: 60 });
		expect(style).toContain('width: 480px');
		expect(style).toContain('max-width: 100%');
	});

	test('keeps the authored width hint for a small blank', () => {
		const style = textEntryInputStyle({ expectedLength: 10 });
		expect(style).toContain('width: 80px');
		expect(style).toContain('min-width: 100px');
	});

	test('a QTI 3.0 qti-input-width class owns the width; the container cap still applies', () => {
		const style = textEntryInputStyle({ expectedLength: 20 }, { widthClass: 'qti-input-width-10' });
		expect(style).not.toMatch(/(?:^|;)\s*width:/);
		expect(style).toContain('max-width: 100%');
	});
});
