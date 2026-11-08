import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

/**
 * Windows High Contrast and other forced-colors modes replace author colours and drop
 * box-shadows, so a state drawn only with a tint or a ring disappears (WCAG 1.4.11, 1.4.1).
 * These checks lock the forced-colors rules that keep the picked-up sortable item and the
 * pressed rich-text toggles visible: system colours only, and the focus outline untouched.
 */
function source(file: string): string {
	return readFileSync(new URL(`../../src/shared/components/${file}`, import.meta.url), 'utf8');
}

/** The body of the source's `@media (forced-colors: active)` block, braces balanced. */
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
	return match[1];
}

const SYSTEM_COLOR = /\b(?:Canvas|CanvasText|Highlight|HighlightText|ButtonFace|ButtonText|ButtonBorder|GrayText|LinkText|Mark|MarkText)\b/;

describe('forced colors keep interaction states visible', () => {
	test('the picked-up sortable item keeps a heavier Highlight border, without shifting', () => {
		const grabbed = rule(forcedColorsBlock(source('SortableList.svelte')), ".qti-sortable-item[data-grabbed='true']");
		expect(grabbed).toContain('border: 3px solid Highlight;');
		// 1px authored border + 0.75rem padding: the extra 2px of border come out of the padding.
		expect(grabbed).toContain('padding: calc(0.75rem - 2px);');
	});

	test('a pressed rich-text toolbar toggle takes the system selection colours', () => {
		const pressed = rule(
			forcedColorsBlock(source('RichTextEditor.svelte')),
			".rte-button[aria-pressed='true']:not(:disabled)",
		);
		expect(pressed).toContain('border-color: Highlight;');
		expect(pressed).toContain('background-color: Highlight;');
		expect(pressed).toContain('color: HighlightText;');
	});

	test.each(['SortableList.svelte', 'RichTextEditor.svelte'])(
		'%s forced-colors rules use system colours only and leave focus outlines alone',
		(file) => {
			const block = forcedColorsBlock(source(file));
			expect(block).not.toMatch(/outline|box-shadow|forced-color-adjust/);
			const colours = [...block.matchAll(/(?:^|[\s;{])(border(?:-[a-z-]+)?|background(?:-color)?|color):\s*([^;]+);/g)];
			expect(colours.length).toBeGreaterThan(0);
			for (const [, property, value] of colours) {
				expect(`${property}: ${value}`).toMatch(SYSTEM_COLOR);
			}
			expect(source(file)).toMatch(/:focus-visible\s*\{\s*outline: 2px solid var\(--pie-qti-focus, #4338ca\);/);
		},
	);
});
