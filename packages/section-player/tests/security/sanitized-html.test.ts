import { describe, expect, test } from 'bun:test';
import { sanitizeSectionSharedHtml } from '../../src/security/sanitizeSharedHtml.js';

describe('sanitizeSectionSharedHtml', () => {
	test('sanitizes shared passage html before render sinks', () => {
		const sanitized = String(
			sanitizeSectionSharedHtml('<p onclick="alert(1)">Passage</p><script>alert(2)</script>', undefined, {
				kind: 'passage',
				source: 'section-1',
			})
		);

		expect(sanitized).toContain('Passage');
		expect(sanitized).not.toContain('onclick');
		expect(sanitized).not.toContain('<script');
	});

	test('re-sanitizes precomputed html values before render sinks', () => {
		const sanitized = String(
			sanitizeSectionSharedHtml('<img src=x onerror="alert(1)">', undefined, {
				kind: 'rubric',
				source: 'section-1',
			})
		);

		expect(sanitized).not.toContain('onerror');
	});
});
