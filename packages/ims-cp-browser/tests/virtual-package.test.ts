import { describe, expect, test } from 'bun:test';
import type { ResolvedManifest } from '../src/package-loader.js';
import { createVirtualPackage } from '../src/virtual-package.js';

const EMPTY_MANIFEST: ResolvedManifest = {
	identifier: 'test-package',
	manifestPath: 'imsmanifest.xml',
	resources: new Map(),
	items: [],
	passages: [],
	tests: [],
};

describe('VirtualPackage', () => {
	test('emits image SVG data URLs for text SVG files', () => {
		const pkg = createVirtualPackage(
			'test-package',
			new Map([
				[
					'stimuli/diagram.svg',
					{
						path: 'stimuli/diagram.svg',
						type: 'text',
						content: '<svg><title>Diagram</title></svg>',
						size: 34,
					},
				],
			]),
			EMPTY_MANIFEST
		);

		expect(pkg.getDataUrl('stimuli/diagram.svg')).toStartWith('data:image/svg+xml;charset=utf-8,');
	});
});
