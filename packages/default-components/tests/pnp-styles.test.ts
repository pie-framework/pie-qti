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
});

describe('PNP display needs', () => {
	test('inverts the player and inverts media back', () => {
		expect(css).toContain("[data-qti-invert-polarity='invert'] {\n\tfilter: invert(1) hue-rotate(180deg);");
		expect(css).toContain("[data-qti-invert-polarity='invert'] :where(img, picture, video, canvas, object)");
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
});
