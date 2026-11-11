/**
 * The `katex-ignore-editor` exclusion class must never outlive a typeset pass:
 * auto-render is wrapped in try/finally, so even a render that throws leaves
 * the editable regions includable by the next pass.
 */

import { describe, expect, mock, test } from 'bun:test';
import { parseHTML } from 'linkedom';
import { typesetMathInElement } from '../src/index.js';

const EDITOR_IGNORE_CLASS = 'katex-ignore-editor';

function makeRoot(html: string): HTMLElement {
	const { document, HTMLElement, Node } = parseHTML(
		`<!doctype html><html><body><div id="root">${html}</div></body></html>`,
	);
	Object.defineProperty(document, 'compatMode', { value: 'CSS1Compat', configurable: true });
	(globalThis as any).document = document;
	(globalThis as any).HTMLElement = HTMLElement;
	(globalThis as any).Node = Node;

	const root = document.getElementById('root');
	if (!root) {
		throw new Error('test root not found');
	}
	return root as unknown as HTMLElement;
}

describe('editor exclusion class bookkeeping', () => {
	test('a throwing render leaves the class absent and the next pass re-includes editors', async () => {
		const renderCalls: { hadIgnoreClass: boolean }[] = [];
		let calls = 0;
		// The stateful render mock throws on the first call (a KaTeX render can
		// throw on unexpected DOM shapes despite `throwOnError: false`) and
		// records, on the second call, whether the editable region carried the
		// exclusion class at render time — i.e. whether the pass re-included it.
		mock.module('katex/contrib/auto-render', () => ({
			default: function renderMathInElement(root: HTMLElement) {
				calls++;
				const editable = root.querySelector<HTMLElement>('[contenteditable="true"]');
				renderCalls.push({ hadIgnoreClass: editable?.classList.contains(EDITOR_IGNORE_CLASS) ?? false });
				if (calls === 1) throw new Error('render exploded');
			},
		}));

		const root = makeRoot('<p>\\(x^2\\)</p><div contenteditable="true">editor</div>');
		const editable = root.querySelector('[contenteditable="true"]') as HTMLElement;

		const first = await typesetMathInElement(root).then(
			() => 'resolved',
			(error: unknown) => `rejected: ${(error as Error).message}`
		);
		expect(first).toBe('rejected: render exploded');
		// The finally block ran: the exclusion class did not stick to the editor.
		expect(editable.classList.contains(EDITOR_IGNORE_CLASS)).toBe(false);

		// A subsequent pass re-includes the editor (class present during the
		// render) and clears it again afterwards.
		await typesetMathInElement(root);
		expect(renderCalls[1]).toEqual({ hadIgnoreClass: true });
		expect(editable.classList.contains(EDITOR_IGNORE_CLASS)).toBe(false);
	});
});
