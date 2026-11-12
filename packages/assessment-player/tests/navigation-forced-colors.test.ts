import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * Windows High Contrast and other forced-colors modes replace author colours and drop the
 * SVG fill. The pressed flag-for-review toggle opts out (`forced-color-adjust: none`) to
 * paint itself in the system selection pair — so it must set the pair's background too:
 * left to the token base colour, HighlightText would render on white in a light
 * high-contrast theme (WCAG 1.4.11, 1.4.1).
 */
function forcedColorsBlock(css: string): string {
	const start = css.indexOf('@media (forced-colors: active)');
	if (start < 0) throw new Error('no forced-colors block');
	const open = css.indexOf('{', start);
	let depth = 0;
	for (let index = open; index < css.length; index++) {
		if (css[index] === '{') depth++;
		else if (css[index] === '}' && --depth === 0) return css.slice(open + 1, index);
	}
	throw new Error('unbalanced forced-colors block');
}

function rule(block: string, selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(block);
	if (!match) throw new Error(`rule not found: ${selector}`);
	return match[1]!;
}

describe('forced colors keep the pressed flag visible', () => {
	test('the pressed flag paints the full system selection pair', () => {
		const source = readFileSync(new URL('../src/components/NavigationBar.svelte', import.meta.url), 'utf8');
		const blocks = source
			.split('@media (forced-colors: active)')
			.slice(1)
			.map((rest) => forcedColorsBlock(`@media (forced-colors: active)${rest}`));
		const pressed = blocks
			.map((block) => {
				try {
					return rule(block, ".nav-button.flag-button[aria-pressed='true']");
				} catch {
					return null;
				}
			})
			.find((found) => found !== null);
		expect(pressed).toBeTruthy();
		expect(pressed).toContain('forced-color-adjust: none;');
		expect(pressed).toContain('border-color: Highlight;');
		expect(pressed).toContain('background-color: Highlight;');
		expect(pressed).toContain('color: HighlightText;');
	});
});
