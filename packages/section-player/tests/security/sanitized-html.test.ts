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

	test('routes shared html asset URLs through the section host asset hook', () => {
		const sanitized = String(
			sanitizeSectionSharedHtml(
				'<img src="https://cdn.example.test/passage.png" srcset="https://cdn.example.test/passage-2x.png 2x">',
				undefined,
				{ kind: 'passage', source: 'section-1' },
				{
					sanitizeAssetUrl: (href) => (href.includes('2x') ? null : href.replace('cdn.example.test', 'assets.example.test')),
				}
			)
		);

		expect(sanitized).toContain('https://assets.example.test/passage.png');
		expect(sanitized).not.toContain('cdn.example.test/passage-2x.png');
	});

	test('blocks unsafe URLs returned by the section host asset hook', () => {
		const sanitized = String(
			sanitizeSectionSharedHtml(
				'<img src="https://cdn.example.test/passage.png">',
				undefined,
				{ kind: 'passage', source: 'section-1' },
				{
					sanitizeAssetUrl: () => 'javascript:alert(1)',
				}
			)
		);

		expect(sanitized).not.toContain('javascript:');
		expect(sanitized).toContain('src="#"');
	});
});
