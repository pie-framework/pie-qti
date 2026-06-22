import { describe, expect, test } from 'bun:test';
import type { ResolvedManifest } from '../src/package-loader.js';
import { resolveImagesInXml } from '../src/image-resolver.js';
import { createVirtualPackage } from '../src/virtual-package.js';
import type { VirtualFile } from '../src/types.js';

const EMPTY_MANIFEST: ResolvedManifest = {
	identifier: 'test-package',
	manifestPath: 'imsmanifest.xml',
	resources: new Map(),
	items: [],
	passages: [],
	tests: [],
};

describe('resolveImagesInXml', () => {
	test('resolves unique package suffix matches to SVG data URLs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="graphics/diagram.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'shared/graphics/diagram.svg': textSvg('<svg><circle cx="1" cy="1" r="1"/></svg>'),
			}),
			'items/item.xml'
		);

		expect(result).toContain('src="data:image/svg+xml,');
		expect(decodeURIComponent(result)).toContain('<circle');
	});

	test('does not use partial filename substring matches', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="diagram.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'assets/big-diagram.svg': textSvg('<svg><title>Wrong image</title></svg>'),
			}),
			'items/item.xml'
		);

		expect(result).not.toContain('src="diagram.svg"');
		expect(result).not.toContain('data:image/svg+xml');
	});

	test('leaves duplicate basename matches unresolved', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="diagram.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'a/diagram.svg': textSvg('<svg><title>A</title></svg>'),
				'b/diagram.svg': textSvg('<svg><title>B</title></svg>'),
			}),
			'items/item.xml'
		);

		expect(result).not.toContain('src="diagram.svg"');
		expect(result).not.toContain('data:image/svg+xml');
	});

	test('does not recover traversal attempts by basename', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="../diagram.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'safe/diagram.svg': textSvg('<svg><title>Unsafe fallback</title></svg>'),
			}),
			'item.xml'
		);

		expect(result).not.toContain('src="../diagram.svg"');
		expect(result).not.toContain('data:image/svg+xml');
	});

	test('removes encoded traversal attempts instead of preserving rejected package hrefs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="%252e%252e/secret.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'safe/secret.svg': textSvg('<svg><title>Secret</title></svg>'),
			}),
			'items/item.xml'
		);

		expect(result).not.toContain('%252e%252e/secret.svg');
		expect(result).not.toContain('src=');
	});

	test('removes raw SVG data image references before package SVG policy is enabled', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="data:image/svg+xml,%3Csvg%3E%3Cscript%2F%3E%3C%2Fsvg%3E"/></itemBody></assessmentItem>`,
			packageWithFiles({}),
			'items/item.xml'
		);

		expect(result).not.toContain('data:image/svg+xml');
		expect(result).not.toContain('src=');
	});

	test('preserves raster data images but removes active raw object data URLs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody>
        <img src="data:image/png;base64,AAAA"/>
        <object data="data:text/html,%3Cscript%3Ealert(1)%3C%2Fscript%3E"/>
      </itemBody></assessmentItem>`,
			packageWithFiles({}),
			'items/item.xml'
		);

		expect(result).toContain('data:image/png;base64,AAAA');
		expect(result).not.toContain('data:text/html');
		expect(result).not.toContain('<object data=');
	});

	test('preserves external image references but removes script schemes by default', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody>
        <img src="https://example.test/image.png"/>
        <object data="javascript:alert(1)"/>
      </itemBody></assessmentItem>`,
			packageWithFiles({}),
			'items/item.xml'
		);

		expect(result).toContain('https://example.test/image.png');
		expect(result).not.toContain('javascript:alert');
	});

	test('is idempotent for package-resolved blob image URLs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="blob:https://example.test/package-svg"/></itemBody></assessmentItem>`,
			packageWithFiles({}),
			'items/item.xml'
		);

		expect(result).toContain('blob:https://example.test/package-svg');
	});

	test('emits safe double-quoted attributes for SVG data URLs containing apostrophes', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src='graphics/diagram.svg'/></itemBody></assessmentItem>`,
			packageWithFiles({
				'items/graphics/diagram.svg': textSvg(`<svg><title>Bob's diagram</title></svg>`),
			}),
			'items/item.xml'
		);

		expect(result).toContain('src="data:image/svg+xml');
		expect(result).toContain("Bob's%20diagram");
		expect(result).not.toContain("src='data:image/svg+xml");
	});

	test('decodes XML attribute entities before resolving package image refs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="graphics/a&amp;b.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'items/graphics/a&b.svg': textSvg('<svg><title>Ampersand path</title></svg>'),
			}),
			'items/item.xml'
		);

		expect(result).toContain('src="data:image/svg+xml');
		expect(decodeURIComponent(result)).toContain('Ampersand path');
		expect(result).not.toContain('graphics/a&amp;b.svg');
	});

	test('does not use suffix heuristics in strict mode', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="graphics/diagram.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'shared/graphics/diagram.svg': textSvg('<svg><title>Diagram</title></svg>'),
			}),
			'items/item.xml',
			{ heuristicsConfig: { enabled: false } }
		);

		expect(result).not.toContain('src="graphics/diagram.svg"');
		expect(result).not.toContain('data:image/svg+xml');
	});

	test('does not use suffix heuristics when lenient image paths are disabled', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="graphics/diagram.svg"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'shared/graphics/diagram.svg': textSvg('<svg><title>Diagram</title></svg>'),
			}),
			'items/item.xml',
			{ heuristicsConfig: { enabled: true, lenientImagePaths: false } }
		);

		expect(result).not.toContain('src="graphics/diagram.svg"');
		expect(result).not.toContain('data:image/svg+xml');
	});

	test('does not convert non-image binary files to image data URLs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="assets/payload.bin"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'shared/assets/payload.bin': {
					path: 'shared/assets/payload.bin',
					type: 'binary',
					content: new Blob(['not an image'], { type: 'application/octet-stream' }),
					size: 12,
				},
			}),
			'items/item.xml'
		);

		expect(result).not.toContain('src="assets/payload.bin"');
		expect(result).not.toContain('data:image/');
	});

	test('preserves package-local object media refs for downstream media rewriting', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><object type="audio/mpeg" data="media/prompt.mp3">Audio</object></itemBody></assessmentItem>`,
			packageWithFiles({
				'items/media/prompt.mp3': {
					path: 'items/media/prompt.mp3',
					type: 'binary',
					content: new Blob(['audio'], { type: 'audio/mpeg' }),
					size: 5,
				},
			}),
			'items/item.xml'
		);

		expect(result).toContain('data="media/prompt.mp3"');
		expect(result).toContain('type="audio/mpeg"');
	});

	test('rewrites package-backed srcset and video poster image refs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody>
        <img srcset="images/small.png 1x, images/large.png 2x"/>
        <video poster="images/poster.png"/>
      </itemBody></assessmentItem>`,
			packageWithFiles({
				'items/images/small.png': binaryImage('items/images/small.png', 'image/png'),
				'items/images/large.png': binaryImage('items/images/large.png', 'image/png'),
				'items/images/poster.png': binaryImage('items/images/poster.png', 'image/png'),
			}),
			'items/item.xml'
		);

		expect(result).toContain('srcset="data:image/png');
		expect(result).toContain(' 1x, data:image/png');
		expect(result).toContain('poster="data:image/png');
		expect(result).not.toContain('images/small.png');
		expect(result).not.toContain('images/poster.png');
	});

	test('rewrites multiple image attributes on the same tag', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody>
        <img src="images/fallback.png" srcset="images/small.png 1x, images/large.png 2x"/>
        <video src="media/movie.mp4" poster="images/poster.png"/>
      </itemBody></assessmentItem>`,
			packageWithFiles({
				'items/images/fallback.png': binaryImage('items/images/fallback.png', 'image/png'),
				'items/images/small.png': binaryImage('items/images/small.png', 'image/png'),
				'items/images/large.png': binaryImage('items/images/large.png', 'image/png'),
				'items/images/poster.png': binaryImage('items/images/poster.png', 'image/png'),
			}),
			'items/item.xml'
		);

		expect(result).toContain('<img src="data:image/png');
		expect(result).toContain('srcset="data:image/png');
		expect(result).toContain('src="media/movie.mp4"');
		expect(result).toContain('poster="data:image/png');
		expect(result).not.toContain('images/fallback.png');
		expect(result).not.toContain('images/small.png');
		expect(result).not.toContain('images/poster.png');
	});

	test('preserves self-closing XML syntax after rewriting refs', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img src="images/fallback.png"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'items/images/fallback.png': binaryImage('items/images/fallback.png', 'image/png'),
			}),
			'items/item.xml'
		);

		expect(result).toContain('<img src="data:image/png;base64,aW1hZ2U="/>');
	});

	test('rewrites refs after quoted greater-than attributes', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img alt="A > B" src="images/fallback.png"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'items/images/fallback.png': binaryImage('items/images/fallback.png', 'image/png'),
			}),
			'items/item.xml'
		);

		expect(result).toContain('alt="A > B"');
		expect(result).toContain('src="data:image/png');
		expect(result).not.toContain('images/fallback.png');
	});

	test('preserves raster data URL candidates in srcset', async () => {
		const result = await resolveImagesInXml(
			`<assessmentItem><itemBody><img srcset="data:image/png;base64,AAAA 1x, images/large.png 2x"/></itemBody></assessmentItem>`,
			packageWithFiles({
				'items/images/large.png': binaryImage('items/images/large.png', 'image/png'),
			}),
			'items/item.xml'
		);

		expect(result).toContain('data:image/png;base64,AAAA 1x');
		expect(result).toContain('data:image/png;base64,aW1hZ2U= 2x');
	});
});

function packageWithFiles(files: Record<string, VirtualFile>) {
	return createVirtualPackage('test-package', new Map(Object.entries(files)), EMPTY_MANIFEST);
}

function textSvg(content: string): VirtualFile {
	return {
		path: 'unused.svg',
		type: 'text',
		content,
		size: content.length,
	};
}

function binaryImage(path: string, type: string): VirtualFile {
	return {
		path,
		type: 'binary',
		content: new Blob(['image'], { type }),
		size: 5,
	};
}
