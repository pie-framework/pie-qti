/**
 * The one visually hidden rule for the shell chrome: the announcer's and the
 * timer's `.sr-only` regions hide through a single document-level injection,
 * not per-component copies (they had drifted: physical versus logical
 * properties, `clip` versus `clip-path`). jsdom resolves document stylesheets
 * into getComputedStyle, so the computed hidden state itself is asserted.
 */

import { afterEach, describe, expect, test } from 'vitest';
// Importing each component runs its module script, which asks for the rule;
// jsdom hosts the document the rule lands in.
import '../../src/components/AccessibilityAnnouncer.svelte';
import '../../src/components/AssessmentTimer.svelte';
import AccessibilityAnnouncer from '../../src/components/AccessibilityAnnouncer.svelte';
import { SR_ONLY_RULE, ensureSrOnlyStyles } from '../../src/components/srOnly.js';
import { mountInto, settle, type Mounted } from './helpers';

const injectedStyles = () => document.querySelectorAll('style[data-assessment-sr-only-source]');

const mounted: Mounted[] = [];
afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

/** The canonical declarations, identical to the rule default-components inject. */
const DECLARATIONS = [
	'position: absolute',
	'width: 1px',
	'height: 1px',
	'padding: 0',
	'margin: -1px',
	'overflow: hidden',
	'clip: rect(0, 0, 0, 0)',
	'white-space: nowrap',
	'border-width: 0',
];

describe('the shared sr-only rule', () => {
	test('lands once per document, no matter how many components ask for it', () => {
		ensureSrOnlyStyles();
		expect(injectedStyles().length).toBe(1);
	});

	test('carries the canonical visually hidden declarations for the shared class', () => {
		const rule = injectedStyles()[0]?.textContent ?? '';
		expect(rule).toBe(SR_ONLY_RULE);
		expect(rule.startsWith('.sr-only {')).toBe(true);
		for (const declaration of DECLARATIONS) {
			expect(rule).toContain(declaration);
		}
	});

	test('the announcer regions are computed-hidden yet screen-reader reachable', async () => {
		const m = mountInto(AccessibilityAnnouncer, { lang: 'en', dir: 'ltr' });
		mounted.push(m);
		await settle();

		const regions = m.host.querySelectorAll<HTMLElement>('[data-announcer]');
		expect(regions).toHaveLength(2);
		for (const region of regions) {
			const cs = getComputedStyle(region);
			expect(cs.position).toBe('absolute');
			expect(cs.width).toBe('1px');
			expect(cs.height).toBe('1px');
			expect(cs.overflow).toBe('hidden');
			// jsdom normalizes the clip rect to pixels.
			expect(cs.clip).toBe('rect(0px, 0px, 0px, 0px)');
			// Reachable, not display:none and not visibility:hidden.
			expect(cs.display).not.toBe('none');
			expect(cs.visibility).not.toBe('hidden');
			// The ARIA wiring that makes the regions live is untouched by the styling.
			expect(region.getAttribute('aria-live')).toMatch(/polite|assertive/);
		}
	});
});
