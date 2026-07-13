import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

describe('@pie-qti/player-elements main entry', () => {
	test('imports without browser globals or registration side effects', () => {
		const entryUrl = new URL('../src/index.ts', import.meta.url).href;
		const script = `
			delete globalThis.window;
			delete globalThis.document;
			delete globalThis.HTMLElement;
			delete globalThis.customElements;
			const module = await import(${JSON.stringify(entryUrl)});
			if (globalThis.customElements !== undefined) throw new Error('registered custom elements');
			if (typeof module.parseAssessmentTestXml !== 'function') throw new Error('missing pure API');
			if (typeof module.QtiItemPlayerElement !== 'function') throw new Error('missing item element class');
		`;
		const result = spawnSync(process.execPath, ['--eval', script], { encoding: 'utf8' });

		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	});

	test('does not define the item tag when a custom-elements registry exists', () => {
		const entryUrl = new URL('../src/index.ts', import.meta.url).href;
		const script = `
			globalThis.HTMLElement = class HTMLElement {};
			const definitions = [];
			globalThis.customElements = {
				define: (tagName) => definitions.push(tagName),
				get: () => undefined,
			};
			await import(${JSON.stringify(entryUrl)});
			if (definitions.length > 0) throw new Error('main entry registered: ' + definitions.join(','));
		`;
		const result = spawnSync(process.execPath, ['--eval', script], { encoding: 'utf8' });

		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	});

	test('browser constructor entry does not register player or toolkit globals', () => {
		const entryUrl = new URL('../dist/elements.js', import.meta.url).href;
		const script = `
			const { parseHTML } = await import('linkedom');
			const dom = parseHTML('<!doctype html><html><body></body></html>');
			for (const key of ['window', 'document', 'HTMLElement', 'CustomEvent', 'Event', 'customElements', 'DOMParser', 'Document', 'Element', 'Node', 'Text', 'Comment', 'ShadowRoot', 'DocumentFragment', 'navigator']) {
				globalThis[key] = key === 'window' ? dom.window : key === 'document' ? dom.document : dom.window[key];
			}
			globalThis.CSSStyleSheet = class CSSStyleSheet {};
			await import(${JSON.stringify(entryUrl)});
			const leaked = [
				'pie-qti-item-player',
				'pie-qti-assessment-player',
				'pie-qti-section-player-splitpane',
				'pie-qti-section-player-vertical',
				'pie-qti-choice',
				'nds-icon-button',
			].filter((tagName) => customElements.get(tagName));
			if (leaked.length > 0) throw new Error('elements entry registered: ' + leaked.join(','));
		`;
		const result = spawnSync(process.execPath, ['--eval', script], {
			cwd: new URL('..', import.meta.url),
			encoding: 'utf8',
		});

		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	});
});
