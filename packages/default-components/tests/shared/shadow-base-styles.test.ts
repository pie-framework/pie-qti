import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * ShadowBaseStyles is injected into every interaction's shadow root, so its
 * colours are the baseline every interaction renders with. These checks lock
 * the theme token contract: text uses the *-text tokens, control boundaries
 * use --pie-qti-border-strong, and focus is an opaque --pie-qti-focus ring.
 */
const source = readFileSync(
	new URL('../../src/shared/components/ShadowBaseStyles.svelte', import.meta.url),
	'utf8',
);

function rule(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(source);
	if (!match) throw new Error(`rule not found: ${selector}`);
	return match[1];
}

describe('ShadowBaseStyles theme token contract', () => {
	test('draws a shared, opaque focus ring from --pie-qti-focus', () => {
		const focus = rule(':global(:where(:focus-visible))');
		expect(focus).toContain('outline: 2px solid var(--pie-qti-focus, #4338ca);');
		expect(focus).toContain('outline-offset: 2px;');
		expect(rule(':global(.btn:focus-visible)')).toContain('outline: 2px solid var(--pie-qti-focus, #4338ca);');
	});

	test('never draws outlines with translucent colours', () => {
		for (const outline of source.matchAll(/outline:[^;]*;/g)) {
			expect(outline[0]).not.toMatch(/color-mix|transparent|rgba|\/\s*0?\.\d/);
		}
	});

	test.each([
		[':global(.text-success)', '--pie-qti-success-text, #15803d'],
		[':global(.text-error)', '--pie-qti-error-text, #b91c1c'],
		[':global(.text-warning)', '--pie-qti-warning-text, #92400e'],
		[':global(.text-info)', '--pie-qti-info-text, #1d4ed8'],
	])('%s uses the accessible text token', (selector, token) => {
		expect(rule(selector)).toContain(`color: var(${token});`);
	});

	test('never uses a state fill colour as a text colour', () => {
		expect(source).not.toMatch(/(?<![-\w])color:\s*var\(--pie-qti-(info|success|warning|error)\s*[,)]/);
	});

	test.each([':global(.select),\n\t:global(.textarea)', ':global(.file-input)', ':global(.file-input-bordered)'])(
		'%s boundary uses --pie-qti-border-strong',
		(selector) => {
			const declarations = rule(selector);
			expect(declarations).toContain('var(--pie-qti-border-strong, #767676)');
			expect(declarations).not.toContain('--pie-qti-base-300');
		},
	);

	test.each([':global(.border-success)', ':global(.qti-correct-highlight)', ':global(.qti-correct-indicator)'])(
		'%s correctness stroke uses the success text token',
		(selector) => {
			expect(rule(selector)).toContain('var(--pie-qti-success-text, #15803d)');
		},
	);
});
