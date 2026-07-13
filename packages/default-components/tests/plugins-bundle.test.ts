import { describe, expect, it } from 'bun:test';
import { parseHTML } from 'linkedom';

const EXPECTED_PLUGIN_TAGS = [
	'pie-qti-choice',
	'pie-qti-slider',
	'pie-qti-order',
	'pie-qti-match',
	'pie-qti-associate',
	'pie-qti-gap-match',
	'pie-qti-hotspot',
	'pie-qti-hottext',
	'pie-qti-media',
	'pie-qti-custom',
	'pie-qti-portable-custom',
	'pie-qti-end-attempt',
	'pie-qti-position-object',
	'pie-qti-graphic-gap-match',
	'pie-qti-graphic-order',
	'pie-qti-graphic-associate',
	'pie-qti-select-point',
	'pie-qti-extended-text',
	'pie-qti-upload',
	'pie-qti-drawing',
	'pie-qti-catalog-popup',
] as const;

describe('compiled plugin bundle', () => {
	it('imports the published plugins entry and registers default custom elements', async () => {
		const { CustomEvent, HTMLElement, Node, customElements, document, window } = parseHTML(
			'<!doctype html><html><body></body></html>'
		);
		const previousGlobals = {
			CustomEvent: globalThis.CustomEvent,
			HTMLElement: globalThis.HTMLElement,
			Node: globalThis.Node,
			customElements: globalThis.customElements,
			document: globalThis.document,
			window: globalThis.window,
		};

		try {
			Object.assign(globalThis, {
				CustomEvent,
				HTMLElement,
				Node,
				customElements,
				document,
				window,
			});

			await import('../dist/plugins.js');

			for (const tagName of EXPECTED_PLUGIN_TAGS) {
				expect(customElements.get(tagName)).toBeDefined();
			}
		} finally {
			Object.assign(globalThis, previousGlobals);
		}
	});
});
