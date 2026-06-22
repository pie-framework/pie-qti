import { describe, expect, test } from 'bun:test';
import { sanitizeResourceUrl } from '../../src/core/urlPolicy.js';

describe('URL policy', () => {
	test('blocks entity and control character obfuscated dangerous schemes', () => {
		expect(sanitizeResourceUrl('java\tscript:alert(1)', undefined, 'link')).toBeNull();
		expect(sanitizeResourceUrl('java&#x09;script:alert(1)', undefined, 'link')).toBeNull();
		expect(sanitizeResourceUrl('vb&#x0a;script:alert(1)', undefined, 'link')).toBeNull();
	});

	test('preserves normal relative paths with spaces', () => {
		expect(sanitizeResourceUrl('images/my diagram.png', undefined, 'img')).toBe('images/my diagram.png');
	});

	test('allows package blob URLs for media only with explicit opt-in', () => {
		expect(sanitizeResourceUrl('blob:https://player.example/package-audio', undefined, 'media')).toBeNull();
		expect(
			sanitizeResourceUrl(
				'blob:https://player.example/package-audio',
				{ allowBlobMedia: true },
				'media'
			)
		).toBe('blob:https://player.example/package-audio');
	});
});
