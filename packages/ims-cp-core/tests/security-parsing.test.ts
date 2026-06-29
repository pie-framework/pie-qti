import { describe, expect, test } from 'bun:test';
import {
	decodeXmlAttribute,
	isBlockedStylesheetCss,
	parseSrcsetCandidates,
} from '../src/security-parsing';

describe('security parsing helpers', () => {
	test('decodes named, decimal, and hex XML attribute entities', () => {
		expect(decodeXmlAttribute('a&amp;b&#x2f;c&#47;d&apos;s&quot;')).toBe('a&b/c/d\'s"');
	});

	test('parses srcset candidates without splitting data URLs at base64 commas', () => {
		expect(parseSrcsetCandidates('data:image/png;base64,AAAA 1x, images/large.png 2x')).toEqual([
			{
				raw: 'data:image/png;base64,AAAA 1x',
				url: 'data:image/png;base64,AAAA',
				descriptors: '1x',
			},
			{
				raw: 'images/large.png 2x',
				url: 'images/large.png',
				descriptors: '2x',
			},
		]);
	});

	test('blocks obfuscated stylesheet URL loading forms', () => {
		expect(isBlockedStylesheetCss('.x { background: u/**/rl("https://evil.example/a.png"); }')).toBe(true);
		expect(isBlockedStylesheetCss('.x { background: \\75 rl("https://evil.example/a.png"); }')).toBe(true);
		expect(isBlockedStylesheetCss('.x { background: image-set("https://evil.example/a.png" 1x); }')).toBe(true);
		expect(isBlockedStylesheetCss('.x { color: #123456; }')).toBe(false);
	});
});
