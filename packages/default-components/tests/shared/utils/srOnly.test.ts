/**
 * One `.sr-only` source: every visually hidden element the components render —
 * the shared `sr-only` class and each interaction's own live-region or
 * sr-only hook — is hidden by the one rule this module declares, injected into
 * the document (light DOM) on import and into each shadow root by
 * ShadowBaseStyles. No component carries its own copy of the declarations.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { SR_ONLY_CLASS, SR_ONLY_RULE, ensureSrOnlyStyles } from '../../../src/shared/styles/srOnly.js';

describe('the visually hidden rule has one source', () => {
	test('the shared class hides with the canonical declarations', () => {
		expect(SR_ONLY_RULE).toContain(`.${SR_ONLY_CLASS},`);
		for (const declaration of [
			'position: absolute;',
			'width: 1px;',
			'height: 1px;',
			'padding: 0;',
			'margin: -1px;',
			'overflow: hidden;',
			'clip: rect(0, 0, 0, 0);',
			'white-space: nowrap;',
		]) {
			expect(SR_ONLY_RULE).toContain(declaration);
		}
	});

	test.each([
		'qti-order-confirmation-live',
		'qti-go-confirmation-live',
		'qti-go-sr-only',
		'qti-ga-sr-only',
		'qti-ga-live-region',
		'qti-hotspot-sr-only',
		'qti-hotspot-live-region',
		'qti-sp-sr-only',
		'qti-po-sr-only',
		'qti-associate-live-region',
		'qti-gm-live-region',
		'qti-subset-live',
		'qti-min-hint-live',
		'qti-upload-live-region',
	])('%s is hidden by the shared rule', (hook) => {
		expect(SR_ONLY_RULE).toContain(`.${hook}`);
	});

	test('no component carries its own copy of the hiding declarations', () => {
		const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
		const { join } = require('node:path') as typeof import('node:path');
		const roots = ['src/plugins', 'src/shared/components'];
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) walk(path);
				else if (path.endsWith('.svelte')) {
					const source = readFileSync(path, 'utf8');
					const style = source.slice(source.indexOf('<style>'));
					// A private copy hides a positioned 1×1 box; other rules may clip for
					// other reasons, so the signature is the 1px dimensions next to the clip.
					if (/width:\s*1px/.test(style) && /height:\s*1px/.test(style) && /clip:\s*rect\(0,\s*0,\s*0,\s*0\)/.test(style)) {
						offenders.push(path);
					}
				}
			}
		};
		for (const root of roots) walk(root);
		expect(offenders).toEqual([]);
	});

	test('importing the module injects the rule into the document once', () => {
		const { document } = parseHTML('<html><head></head><body></body></html>');
		(globalThis as Record<string, unknown>).document = document;
		try {
			ensureSrOnlyStyles();
			ensureSrOnlyStyles();
			const styles = Array.from(document.head.querySelectorAll('style')).filter(
				(style) => style.getAttribute('data-sr-only-source') === 'pie-qti',
			);
			expect(styles).toHaveLength(1);
			expect(styles[0]!.textContent).toContain(`.${SR_ONLY_CLASS},`);
		} finally {
			delete (globalThis as Record<string, unknown>).document;
		}
	});
});
