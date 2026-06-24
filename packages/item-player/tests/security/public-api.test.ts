import { describe, expect, test } from 'bun:test';
import {
	enforceItemXmlLimits,
	sanitizeResourceUrl,
	sanitizeSharedHtml,
	type PlayerSecurityConfig,
} from '../../src/security/index.js';

describe('@pie-qti/item-player/security public API', () => {
	test('sanitizeSharedHtml strips script tags and event handlers', () => {
		const html = '<p onclick="alert(1)">Safe text</p><script>alert(2)</script>';

		const sanitized = String(sanitizeSharedHtml(html));

		expect(sanitized).toContain('Safe text');
		expect(sanitized).not.toContain('<script');
		expect(sanitized).not.toContain('onclick');
	});

	test('sanitizeSharedHtml applies the same URL policy shape as item-player', () => {
		const security: PlayerSecurityConfig = {
			urlPolicy: {
				allowHttps: true,
				allowHttp: false,
			},
		};

		const sanitized = String(
			sanitizeSharedHtml('<img src="javascript:alert(1)"><a href="http://example.test">x</a>', security)
		);

		expect(sanitized).not.toContain('javascript:');
		expect(sanitized).not.toContain('http://example.test');
	});

	test('sanitizeResourceUrl honors blocked URL schemes', () => {
		expect(sanitizeResourceUrl('javascript:alert(1)', undefined, 'img')).toBeNull();
	});

	test('enforceItemXmlLimits remains opt-in through parsingLimits', () => {
		expect(() => enforceItemXmlLimits('<!DOCTYPE qti><assessmentItem />')).not.toThrow();
		expect(() =>
			enforceItemXmlLimits('<!DOCTYPE qti><assessmentItem />', {
				parsingLimits: { enabled: true, rejectDoctype: true },
			})
		).toThrow();
	});
});
