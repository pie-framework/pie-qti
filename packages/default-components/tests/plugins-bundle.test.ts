import { describe, expect, it } from 'bun:test';
import { parseHTML } from 'linkedom';

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

			expect(customElements.get('pie-qti-choice')).toBeDefined();
			expect(customElements.get('pie-qti-gap-match')).toBeDefined();
			expect(customElements.get('pie-qti-hottext')).toBeDefined();
		} finally {
			Object.assign(globalThis, previousGlobals);
		}
	});
});
