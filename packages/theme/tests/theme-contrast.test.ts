import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	type CssVariables,
	computeCustomProperties,
	contrastRatio,
	parseCssColor,
	parseCustomPropertyBlocks,
	toHex,
} from './support/wcag-contrast';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(__dirname, '../src/tokens.css'), 'utf8');

const WCAG_TEXT = 4.5;
const WCAG_NON_TEXT = 3;

const BASE_SURFACES = ['--pie-qti-base-100', '--pie-qti-base-200'] as const;

/** Text drawn directly on base surfaces. */
const TEXT_ON_BASE = [
	'--pie-qti-base-content',
	'--pie-qti-error-text',
	'--pie-qti-warning-text',
	'--pie-qti-success-text',
	'--pie-qti-info-text',
] as const;

/** Non-text cues drawn on base surfaces (WCAG 1.4.11 / 2.4.13). */
const NON_TEXT_ON_BASE = ['--pie-qti-border-strong', '--pie-qti-focus'] as const;

/** Every fill that has a matching `*-content` colour for text on that fill. */
const FILLS = ['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error'] as const;

function themeVariables(): Record<'light' | 'dark', CssVariables> {
	const blocks = parseCustomPropertyBlocks(tokensCss);
	const lightBlock = blocks.find((block) => block.selectors.includes(":root"));
	const darkBlock = blocks.find((block) => block.selectors.includes("[data-qti-theme='dark']"));
	if (!lightBlock || !darkBlock) {
		throw new Error('tokens.css must declare :root (light) and [data-qti-theme=\'dark\'] blocks');
	}
	expect(lightBlock.selectors).toContain("[data-qti-theme='light']");

	const light = computeCustomProperties(lightBlock.declarations);
	// A dark container inherits the computed :root values it does not redeclare.
	const dark = computeCustomProperties(darkBlock.declarations, light);
	return { light, dark };
}

function ratio(variables: CssVariables, foreground: string, background: string): number {
	const fg = variables[foreground];
	const bg = variables[background];
	if (!fg || !bg) {
		throw new Error(`Missing token: ${!fg ? foreground : background}`);
	}
	return contrastRatio(parseCssColor(fg), parseCssColor(bg));
}

function describePair(variables: CssVariables, foreground: string, background: string): string {
	return `${foreground} ${toHex(parseCssColor(variables[foreground]))} on ${background} ${toHex(
		parseCssColor(variables[background]),
	)}`;
}

describe('WCAG contrast helper', () => {
	test('matches reference contrast values', () => {
		expect(contrastRatio(parseCssColor('#000000'), parseCssColor('#ffffff'))).toBeCloseTo(21, 5);
		expect(contrastRatio(parseCssColor('#767676'), parseCssColor('#fff'))).toBeCloseTo(4.54, 2);
		expect(toHex(parseCssColor('oklch(100% 0 0)'))).toBe('#ffffff');
		expect(toHex(parseCssColor('oklch(0% 0 0)'))).toBe('#000000');
		// oklch(62.8% 0.2577 29.23) is the CSS Color 4 reference for sRGB red.
		expect(toHex(parseCssColor('oklch(62.8% 0.2577 29.23)'))).toBe('#ff0000');
		expect(toHex(parseCssColor('oklch(0.452 0.313 264.05)'))).toBe('#0000ff');
	});

	test('selects light-dark() branches and rejects translucent colours', () => {
		expect(toHex(parseCssColor('light-dark(#ffffff, #000000)', 'light'))).toBe('#ffffff');
		expect(toHex(parseCssColor('light-dark(#ffffff, #000000)', 'dark'))).toBe('#000000');
		expect(() => parseCssColor('oklch(50% 0.1 120 / 0.5)')).toThrow();
		expect(() => parseCssColor('#00000080')).toThrow();
	});
});

describe('tokens.css contrast guarantees', () => {
	const themes = themeVariables();

	for (const [theme, variables] of Object.entries(themes)) {
		describe(`${theme} theme`, () => {
			for (const token of TEXT_ON_BASE) {
				for (const surface of BASE_SURFACES) {
					test(`${token} on ${surface} >= ${WCAG_TEXT}:1`, () => {
						const value = ratio(variables, token, surface);
						expect(value, describePair(variables, token, surface)).toBeGreaterThanOrEqual(WCAG_TEXT);
					});
				}
			}

			for (const token of NON_TEXT_ON_BASE) {
				for (const surface of BASE_SURFACES) {
					test(`${token} on ${surface} >= ${WCAG_NON_TEXT}:1`, () => {
						const value = ratio(variables, token, surface);
						expect(value, describePair(variables, token, surface)).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
					});
				}
			}

			for (const fill of FILLS) {
				const content = `--pie-qti-${fill}-content`;
				const background = `--pie-qti-${fill}`;
				test(`${content} on ${background} >= ${WCAG_TEXT}:1`, () => {
					const value = ratio(variables, content, background);
					expect(value, describePair(variables, content, background)).toBeGreaterThanOrEqual(WCAG_TEXT);
				});
			}
		});
	}

	test('dark theme redeclares every token that resolves var() against the theme palette', () => {
		// Custom properties substitute var() where they are declared, so a dark
		// block that does not redeclare --pie-qti-focus would inherit the light
		// primary colour.
		expect(themes.dark['--pie-qti-focus']).toBe(themes.dark['--pie-qti-primary']);
		expect(themes.light['--pie-qti-focus']).toBe(themes.light['--pie-qti-primary']);
	});
});

describe('tokens.css component fallback contract', () => {
	const { light, dark } = themeVariables();

	test('light message/state text and border tokens equal the component fallbacks', () => {
		expect(light['--pie-qti-error-text']).toBe('#b91c1c');
		expect(light['--pie-qti-warning-text']).toBe('#92400e');
		expect(light['--pie-qti-success-text']).toBe('#15803d');
		expect(light['--pie-qti-info-text']).toBe('#1d4ed8');
		expect(light['--pie-qti-border-strong']).toBe('#767676');
	});

	test('the documented component fallbacks themselves meet the guarantees on light surfaces', () => {
		const fallbacks = {
			'--pie-qti-error-text': '#b91c1c',
			'--pie-qti-warning-text': '#92400e',
			'--pie-qti-success-text': '#15803d',
			'--pie-qti-info-text': '#1d4ed8',
		};
		for (const surface of BASE_SURFACES) {
			for (const [token, fallback] of Object.entries(fallbacks)) {
				expect(
					contrastRatio(parseCssColor(fallback), parseCssColor(light[surface])),
					`${token} fallback ${fallback} on ${surface}`,
				).toBeGreaterThanOrEqual(WCAG_TEXT);
			}
			expect(contrastRatio(parseCssColor('#767676'), parseCssColor(light[surface]))).toBeGreaterThanOrEqual(
				WCAG_NON_TEXT,
			);
			expect(contrastRatio(parseCssColor('#4338ca'), parseCssColor(light[surface]))).toBeGreaterThanOrEqual(
				WCAG_NON_TEXT,
			);
		}
	});

	test('dark theme overrides every message/state text and border token', () => {
		for (const token of [
			'--pie-qti-error-text',
			'--pie-qti-warning-text',
			'--pie-qti-success-text',
			'--pie-qti-info-text',
			'--pie-qti-border-strong',
		]) {
			expect(dark[token], token).toBeDefined();
			expect(dark[token], token).not.toBe(light[token]);
		}
	});

	test('typography, spacing, and shape tokens use the documented defaults', () => {
		expect({
			fontFamily: light['--pie-qti-font-family'],
			fontSizeBase: light['--pie-qti-font-size-base'],
			lineHeight: light['--pie-qti-line-height'],
			radius: light['--pie-qti-radius'],
			radiusSm: light['--pie-qti-radius-sm'],
			space1: light['--pie-qti-space-1'],
			space2: light['--pie-qti-space-2'],
			space3: light['--pie-qti-space-3'],
			space4: light['--pie-qti-space-4'],
			space5: light['--pie-qti-space-5'],
			space6: light['--pie-qti-space-6'],
			controlMinSize: light['--pie-qti-control-min-size'],
		}).toEqual({
			fontFamily: 'inherit',
			fontSizeBase: '1rem',
			lineHeight: '1.5',
			radius: '0.5rem',
			radiusSm: '0.25rem',
			space1: '0.25rem',
			space2: '0.5rem',
			space3: '0.75rem',
			space4: '1rem',
			space5: '1.5rem',
			space6: '2rem',
			controlMinSize: '2.75rem',
		});
	});
});
