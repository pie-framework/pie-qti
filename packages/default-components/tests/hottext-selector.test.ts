import { describe, expect, test } from 'bun:test';
import { parseHTML } from 'linkedom';
import { HOTTEXT_SELECTOR } from '../src/plugins/hottext/hottextSelector';

// Hottext extraction keeps the source spelling in `contentHtml`.
const content = (tag: string) =>
	`<p>Find <${tag} identifier="H1">one</${tag}> and <${tag} identifier="H2">two</${tag}>.</p>`;

describe('hottext selector', () => {
	test.each([
		['QTI 2.2', 'hottext'],
		['QTI 3.0', 'qti-hottext'],
	])('%s content exposes every hottext span', (_version, tag) => {
		const { document } = parseHTML(`<div>${content(tag)}</div>`);
		const ids = Array.from(document.querySelectorAll(HOTTEXT_SELECTOR)).map((el) => el.getAttribute('identifier'));
		expect(ids).toEqual(['H1', 'H2']);
	});
});
