import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/shared/styles/qti-pnp.css', import.meta.url), 'utf8');

/** Every scheme `PnpProfile.display.colorScheme` names, less `default`, which removes the attribute. */
const SCHEMES = [
	'defaultreverse',
	'blackwhite',
	'whiteblack',
	'blackrose',
	'roseblack',
	'yellowblue',
	'blueyellow',
	'mgraydgray',
	'dgraymgray',
	'blackcyan',
	'cyanblack',
	'blackcream',
	'creamblack',
	'whitenav',
	'medgray',
];

function schemeColors(scheme: string): { fg: string; bg: string } | undefined {
	const match = new RegExp(
		`\\[data-qti-colorscheme='${scheme}'\\]\\s*\\{\\s*--qti-scheme-fg:\\s*(#[0-9a-f]{6});\\s*--qti-scheme-bg:\\s*(#[0-9a-f]{6});`,
	).exec(css);
	return match ? { fg: match[1], bg: match[2] } : undefined;
}

/** WCAG 2.2 relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

/** Message/state text, control boundary and focus: the tokens a PNP colour accommodation must keep visible. */
const STATE_TOKENS = [
	'--pie-qti-error-text',
	'--pie-qti-warning-text',
	'--pie-qti-success-text',
	'--pie-qti-info-text',
	'--pie-qti-border-strong',
	'--pie-qti-focus',
];

/** The --pie-qti-* light defaults a themed host provides above the player root (hex for the contrast maths). */
const LIGHT_THEME: Record<string, string> = {
	'--pie-qti-base-100': '#ffffff',
	'--pie-qti-base-200': '#fafafa',
	'--pie-qti-base-content': '#1c1c1c',
	'--pie-qti-error-text': '#b91c1c',
	'--pie-qti-warning-text': '#92400e',
	'--pie-qti-success-text': '#15803d',
	'--pie-qti-info-text': '#1d4ed8',
	'--pie-qti-border-strong': '#767676',
	'--pie-qti-focus': '#4338ca',
};

/** Rules of the (flat) stylesheet: selector list and custom-property declarations, in source order. */
const RULES = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
	selectors: match[1].split(',').map((selector) => selector.trim()),
	declarations: [...match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()] as const),
}));

/** Whether a bare attribute selector (`[a]`, `[a='v']`, `[a~='v']`) matches the attributes. */
function matchesAttributes(selector: string, attributes: Record<string, string>): boolean {
	const match = /^\[([\w-]+)(?:(~?=)'([^']*)')?\]$/.exec(selector);
	if (!match) return false;
	const [, name, operator, value] = match;
	const actual = attributes[name];
	if (actual === undefined) return false;
	if (!operator) return true;
	return operator === '=' ? actual === value : actual.split(/\s+/).includes(value);
}

/**
 * The custom properties the player root computes: its matching rules in source order (all of
 * one specificity), then its inline style, with var() resolved against the root's own values
 * and the inherited ones, as CSS does.
 */
function computeRoot(
	attributes: Record<string, string>,
	inlineStyle: Record<string, string>,
	inherited: Record<string, string>,
): Record<string, string | undefined> {
	const declared: Record<string, string> = {};
	for (const rule of RULES) {
		if (!rule.selectors.some((selector) => matchesAttributes(selector, attributes))) continue;
		for (const [name, value] of rule.declarations) declared[name] = value;
	}
	Object.assign(declared, inlineStyle);

	const resolve = (name: string, depth = 0): string | undefined => {
		if (depth > 16) throw new Error(`var() cycle at ${name}`);
		if (!(name in declared)) return inherited[name];
		return substitute(declared[name], (reference) => resolve(reference, depth + 1));
	};
	const names = new Set([...Object.keys(declared), ...Object.keys(inherited)]);
	return Object.fromEntries([...names].map((name) => [name, resolve(name)]));
}

/** Substitute var(--x[, fallback]) references; undefined when one resolves to nothing. */
function substitute(value: string, lookup: (name: string) => string | undefined): string | undefined {
	const start = value.indexOf('var(');
	if (start === -1) return value;
	let depth = 0;
	let end = start + 3;
	for (; end < value.length; end += 1) {
		if (value[end] === '(') depth += 1;
		if (value[end] === ')' && --depth === 0) break;
	}
	const inner = value.slice(start + 4, end);
	const comma = inner.indexOf(',');
	const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
	const replacement = lookup(name) ?? (comma === -1 ? undefined : substitute(inner.slice(comma + 1).trim(), lookup));
	if (replacement === undefined) return undefined;
	return substitute(value.slice(0, start) + replacement + value.slice(end + 1), lookup);
}

describe('PNP colour schemes', () => {
	test.each(SCHEMES)('%s meets WCAG 1.4.3 contrast', (scheme) => {
		const colors = schemeColors(scheme);
		expect(colors, scheme).toBeDefined();
		expect(contrast(colors!.fg, colors!.bg)).toBeGreaterThanOrEqual(4.5);
	});

	test('recolours the theme tokens interactions draw with', () => {
		expect(css).toContain('--color-base-content: var(--qti-scheme-fg);');
		expect(css).toContain('--pie-qti-base-100: var(--qti-scheme-bg);');
	});

	test.each([
		'--pie-qti-error-text',
		'--pie-qti-warning-text',
		'--pie-qti-success-text',
		'--pie-qti-info-text',
		'--pie-qti-border-strong',
		'--pie-qti-focus',
	])('draws %s in the scheme foreground', (token) => {
		expect(css).toContain(`${token}: var(--qti-scheme-fg);`);
	});

	test.each(SCHEMES)('%s keeps state text, boundaries and focus at the scheme contrast on every surface', (scheme) => {
		const { fg, bg } = schemeColors(scheme)!;
		const root = computeRoot({ 'data-qti-colorscheme': scheme }, {}, LIGHT_THEME);
		for (const token of STATE_TOKENS) expect(root[token], token).toBe(fg);
		expect([root['--pie-qti-base-100'], root['--pie-qti-base-200']]).toEqual([bg, bg]);
	});

	test('inverted polarity with the profile colours draws state text, boundaries and focus in its foreground', () => {
		const root = computeRoot(
			{ 'data-qti-invert-polarity': 'colors' },
			{ '--qti-invert-foreground': '#ffff00', '--qti-invert-background': '#000080' },
			LIGHT_THEME,
		);
		for (const token of STATE_TOKENS) expect(root[token], token).toBe('#ffff00');
		expect([root['--pie-qti-base-100'], root['--pie-qti-base-200']]).toEqual(['#000080', '#000080']);
	});
});

describe('PNP custom text and background colours', () => {
	const fontAndBackground = (fg: string, bg: string, inherited = LIGHT_THEME) =>
		computeRoot(
			{ 'data-qti-text-appearance': 'font-color background-color' },
			{ '--qti-font-color': fg, '--qti-background-color': bg },
			inherited,
		);

	test.each([
		['#ffff00', '#000080'],
		['#000000', '#fffacd'],
		['#ffffff', '#333333'],
	])('%s text on %s: state text, boundaries and focus draw in the candidate text colour', (fg, bg) => {
		const root = fontAndBackground(fg, bg);
		for (const token of STATE_TOKENS) expect(root[token], token).toBe(fg);
		for (const surface of ['--pie-qti-base-100', '--pie-qti-base-200']) {
			expect(root[surface], surface).toBe(bg);
			for (const token of STATE_TOKENS) expect(contrast(root[token]!, root[surface]!)).toBeGreaterThanOrEqual(4.5);
		}
	});

	test('a background alone draws state text, boundaries and focus in the theme text colour', () => {
		// Light blue, a common reading-comfort background: the theme's success text drops to 3.3:1 on it.
		const bg = '#add8e6';
		expect(contrast(LIGHT_THEME['--pie-qti-success-text'], bg)).toBeLessThan(4.5);

		const root = computeRoot({ 'data-qti-text-appearance': 'background-color' }, { '--qti-background-color': bg }, LIGHT_THEME);
		for (const token of STATE_TOKENS) expect(root[token], token).toBe(LIGHT_THEME['--pie-qti-base-content']);
		expect([root['--pie-qti-base-100'], root['--pie-qti-base-200']]).toEqual([bg, bg]);
		for (const token of STATE_TOKENS) expect(contrast(root[token]!, bg)).toBeGreaterThanOrEqual(4.5);
	});

	test('without a host theme, a background alone falls back to the components’ body-text colour', () => {
		const root = computeRoot({ 'data-qti-text-appearance': 'background-color' }, { '--qti-background-color': '#fffacd' }, {});
		for (const token of STATE_TOKENS) expect(root[token], token).toBe('oklch(21% 0 0)');
	});

	test('a text colour alone draws state text, boundaries and focus in it', () => {
		const root = computeRoot({ 'data-qti-text-appearance': 'font-color' }, { '--qti-font-color': '#00264d' }, LIGHT_THEME);
		for (const token of STATE_TOKENS) expect(root[token], token).toBe('#00264d');
	});

	test('the candidate text colour wins over a colour scheme', () => {
		const root = computeRoot(
			{ 'data-qti-colorscheme': 'yellowblue', 'data-qti-text-appearance': 'font-color' },
			{ '--qti-font-color': '#ffffff' },
			LIGHT_THEME,
		);
		for (const token of STATE_TOKENS) expect(root[token], token).toBe('#ffffff');
	});
});

describe('PNP display needs', () => {
	test('inverts the player and inverts media back', () => {
		expect(css).toContain("[data-qti-invert-polarity='invert'] {\n\tfilter: invert(1) hue-rotate(180deg);");
		expect(css).toContain("[data-qti-invert-polarity='invert'] :where(img, picture, video, canvas, object)");
	});

	test('does not invert under forced colours, which already paint the candidate palette', () => {
		const forced = /@media \(forced-colors: active\) \{([\s\S]*?)\n\}/.exec(css);
		expect(forced, '@media (forced-colors: active) block').not.toBeNull();
		const body = forced![1];
		expect(body).toContain("[data-qti-invert-polarity='invert'],");
		expect(body).toContain("[data-qti-invert-polarity='invert'] :where(img, picture, video, canvas, object)");
		expect(body).toMatch(/filter:\s*none;/);
		// Same specificity as the inversion rules: the override wins by coming after them.
		const lastInversion = css.lastIndexOf('filter: invert(1) hue-rotate(180deg);');
		expect(forced!.index).toBeGreaterThan(lastInversion);
	});

	test('stacks layout columns for single-column layout', () => {
		expect(css).toContain("[data-qti-layout='single-column'] .qti-layout-row > *");
	});

	test.each(['font-size', 'font-family', 'font-color', 'background-color', 'line-height', 'letter-spacing', 'word-spacing'])(
		'applies text appearance %s from its custom property',
		(token) => {
			expect(css).toContain(`[data-qti-text-appearance~='${token}']`);
			expect(css).toContain(`var(--qti-${token})`);
		},
	);

	test.each([
		['--pie-qti-font-size-base', '--qti-font-size'],
		['--pie-qti-font-family', '--qti-font-family'],
		['--pie-qti-line-height', '--qti-line-height'],
	])('feeds text appearance into the %s typography token', (token, source) => {
		expect(css).toContain(`${token}: var(${source});`);
	});
});
