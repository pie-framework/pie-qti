import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Every stock DaisyUI theme, as the installed daisyui package defines it.
import daisyThemes from 'daisyui/theme/object';
// Test-only colour maths shared with the @pie-qti/theme contrast test.
import {
	type ColorScheme,
	type CssVariables,
	computeCustomProperties,
	contrastRatio,
	parseCssColor,
	parseCustomPropertyBlocks,
	relativeLuminance,
	toHex,
} from '../../theme/tests/support/wcag-contrast';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeCss = readFileSync(resolve(__dirname, '../src/bridge.css'), 'utf8');

const WCAG_TEXT = 4.5;
const WCAG_NON_TEXT = 3;

/** The documented luminance bounds of the surfaces the preferred focus tier is guaranteed on. */
const LIGHT_SURFACE_MIN_LUMINANCE = 0.625;
const DARK_SURFACE_MAX_LUMINANCE = 0.05;

type DaisyTheme = { scheme: ColorScheme; variables: CssVariables };

const STOCK_THEMES: Record<string, DaisyTheme> = Object.fromEntries(
	Object.entries(daisyThemes as unknown as Record<string, Record<string, string>>).map(([name, theme]) => {
		const { 'color-scheme': scheme, ...variables } = theme;
		if (scheme !== 'light' && scheme !== 'dark') throw new Error(`${name}: unexpected color-scheme ${scheme}`);
		return [name, { scheme, variables }];
	}),
);

/** PIE-branded primaries declared for the demo's light/dark themes. */
const DEMO_BRAND_PRIMARY: Record<ColorScheme, string> = {
	light: '#ee4923',
	dark: '#ff5733',
};

const BASE_SURFACES = ['--pie-qti-base-100', '--pie-qti-base-200'] as const;
const TEXT_TOKENS = [
	'--pie-qti-base-content',
	'--pie-qti-error-text',
	'--pie-qti-warning-text',
	'--pie-qti-success-text',
	'--pie-qti-info-text',
] as const;
const STATE_TEXT_TOKENS = TEXT_TOKENS.filter((token) => token !== '--pie-qti-base-content');
const FILLS = ['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error'] as const;

const bridgeBlocks = parseCustomPropertyBlocks(bridgeCss).filter((block) => block.selectors.includes('[data-theme]'));
const conditions = [...new Set(bridgeBlocks.flatMap((block) => (block.supports ? [block.supports] : [])))];
const COLOR_MIX = conditions.filter((condition) => condition.includes('color-mix('));
const RELATIVE_COLOR = conditions.filter((condition) => condition.includes('(from '));

/** Engines by the bridge tiers they pass. */
const ENGINES = {
	/** Relative colour syntax and light-dark(): current Chrome, Edge, Firefox and Safari. */
	current: new Set(conditions),
	/** color-mix() only: for example Chrome 111-122, Firefox 113-127 and Safari 16.2-17. */
	colorMixOnly: new Set(COLOR_MIX),
	/** None of the tiers: the plain DaisyUI values. */
	baseline: new Set<string>(),
} as const;

/** The --pie-qti-* values a DaisyUI-themed element computes through the bridge in an engine. */
function bridgeVariables(daisyTheme: CssVariables, supported: ReadonlySet<string> = ENGINES.current): CssVariables {
	const applied = bridgeBlocks.filter((block) => block.supports === null || supported.has(block.supports));
	return computeCustomProperties(Object.assign({}, ...applied.map((block) => block.declarations)), daisyTheme);
}

function ratio(variables: CssVariables, scheme: ColorScheme, foreground: string, background: string) {
	const fg = parseCssColor(variables[foreground], scheme);
	const bg = parseCssColor(variables[background], scheme);
	return {
		value: contrastRatio(fg, bg),
		label: `${foreground} ${toHex(fg)} on ${background} ${toHex(bg)} (${scheme})`,
	};
}

function minimumOnSurfaces(variables: CssVariables, scheme: ColorScheme, token: string) {
	return BASE_SURFACES.map((surface) => ratio(variables, scheme, token, surface)).reduce((lowest, current) =>
		current.value < lowest.value ? current : lowest,
	);
}

describe('DaisyUI bridge tiers', () => {
	test('reads every stock DaisyUI theme from the installed package', () => {
		expect(Object.keys(STOCK_THEMES).length).toBeGreaterThanOrEqual(35);
		expect(STOCK_THEMES.light.scheme).toBe('light');
		expect(STOCK_THEMES.dark.scheme).toBe('dark');
	});

	test('has a color-mix() focus tier and relative-colour focus and text-on-fill tiers', () => {
		expect(COLOR_MIX).toHaveLength(1);
		expect(RELATIVE_COLOR).toHaveLength(2);
		const declaring = (token: string) =>
			bridgeBlocks.filter((block) => token in block.declarations).map((block) => block.supports);
		expect(declaring('--pie-qti-focus')).toEqual([null, ...COLOR_MIX, RELATIVE_COLOR.find((c) => c.includes('light-dark'))]);
		for (const fill of FILLS) {
			expect(declaring(`--pie-qti-${fill}-content`)).toEqual([null, RELATIVE_COLOR.find((c) => !c.includes('light-dark'))]);
		}
		for (const token of STATE_TEXT_TOKENS) {
			expect(declaring(token)).toEqual([null, RELATIVE_COLOR.find((c) => c.includes('light-dark'))]);
		}
	});

	test('without the tiers, the bridge passes DaisyUI colours through unchanged', () => {
		const { variables } = STOCK_THEMES.light;
		const baseline = bridgeVariables(variables, ENGINES.baseline);
		expect(baseline['--pie-qti-focus']).toBe(variables['--color-primary']);
		for (const fill of FILLS) {
			expect(baseline[`--pie-qti-${fill}-content`]).toBe(variables[`--color-${fill}-content`]);
		}
	});
});

describe('focus indicator in every stock DaisyUI theme', () => {
	for (const [name, { scheme, variables }] of Object.entries(STOCK_THEMES)) {
		for (const engine of ['current', 'colorMixOnly'] as const) {
			test(`${name}: --pie-qti-focus >= ${WCAG_NON_TEXT}:1 on base-100 and base-200 (${engine} engines)`, () => {
				const { value, label } = minimumOnSurfaces(bridgeVariables(variables, ENGINES[engine]), scheme, '--pie-qti-focus');
				expect(value, label).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
			});
		}

		test(`${name}: surfaces lie within the documented focus guarantee bounds`, () => {
			const bridged = bridgeVariables(variables);
			for (const surface of BASE_SURFACES) {
				const luminance = relativeLuminance(parseCssColor(bridged[surface], scheme));
				if (scheme === 'light') expect(luminance, surface).toBeGreaterThanOrEqual(LIGHT_SURFACE_MIN_LUMINANCE);
				else expect(luminance, surface).toBeLessThanOrEqual(DARK_SURFACE_MAX_LUMINANCE);
			}
		});
	}

	for (const scheme of ['light', 'dark'] as const) {
		test(`PIE-branded ${scheme} primary keeps a >= ${WCAG_NON_TEXT}:1 focus in every tier`, () => {
			const branded = { ...STOCK_THEMES[scheme].variables, '--color-primary': DEMO_BRAND_PRIMARY[scheme] };
			for (const engine of ['current', 'colorMixOnly'] as const) {
				const { value, label } = minimumOnSurfaces(bridgeVariables(branded, ENGINES[engine]), scheme, '--pie-qti-focus');
				expect(value, `${label} [${engine}]`).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
			}
		});
	}

	test('the preferred tier keeps a primary that already clears the bounds unchanged', () => {
		const unchanged = (variables: CssVariables, scheme: ColorScheme) => {
			const bridged = bridgeVariables(variables);
			return toHex(parseCssColor(bridged['--pie-qti-focus'], scheme)) === toHex(parseCssColor(bridged['--pie-qti-primary'], scheme));
		};
		expect(unchanged(STOCK_THEMES.light.variables, 'light')).toBe(true);
		expect(unchanged({ ...STOCK_THEMES.dark.variables, '--color-primary': DEMO_BRAND_PRIMARY.dark }, 'dark')).toBe(true);
		const kept = Object.values(STOCK_THEMES).filter(({ scheme, variables }) => unchanged(variables, scheme));
		// Measured with daisyui 5.7.50: 17 of 35 stock primaries are kept as they are.
		expect(kept.length).toBeGreaterThanOrEqual(15);
	});
});

describe('text on fills in every stock DaisyUI theme', () => {
	const black = parseCssColor('#000000');
	const white = parseCssColor('#ffffff');

	for (const [name, { scheme, variables }] of Object.entries(STOCK_THEMES)) {
		test(`${name}: every *-content >= ${WCAG_TEXT}:1 on its fill, black or white by the fill's luminance`, () => {
			const bridged = bridgeVariables(variables);
			for (const fill of FILLS) {
				const background = parseCssColor(bridged[`--pie-qti-${fill}`], scheme);
				const content = parseCssColor(bridged[`--pie-qti-${fill}-content`], scheme);
				const { value, label } = ratio(bridged, scheme, `--pie-qti-${fill}-content`, `--pie-qti-${fill}`);
				expect(value, label).toBeGreaterThanOrEqual(WCAG_TEXT);
				// Computed independently of the CSS: the better of black and white on the displayed fill.
				const [onBlack, onWhite] = [contrastRatio(black, background), contrastRatio(white, background)];
				expect([toHex(black), toHex(white)], label).toContain(toHex(content));
				expect(value, label).toBeCloseTo(Math.max(onBlack, onWhite), 1);
			}
		});
	}
});

describe('state text on surfaces in every stock DaisyUI theme', () => {
	/** The documented surface bounds the fixed state text values are adjusted against. */
	const LIGHT_SURFACE_MIN_LUMINANCE = 0.625;
	const DARK_SURFACE_MAX_LUMINANCE = 0.05;

	for (const [name, { scheme, variables }] of Object.entries(STOCK_THEMES)) {
		test(`${name}: every state text token >= ${WCAG_TEXT}:1 on base-100 and base-200 (current engines)`, () => {
			const bridged = bridgeVariables(variables);
			for (const token of STATE_TEXT_TOKENS) {
				const { value, label } = minimumOnSurfaces(bridged, scheme, token);
				expect(value, label).toBeGreaterThanOrEqual(WCAG_TEXT);
			}
		});
	}

	test('the surfaces lie within the documented state text guarantee bounds', () => {
		for (const { scheme, variables } of Object.values(STOCK_THEMES)) {
			const bridged = bridgeVariables(variables);
			for (const surface of BASE_SURFACES) {
				const luminance = relativeLuminance(parseCssColor(bridged[surface], scheme));
				if (scheme === 'light') expect(luminance, surface).toBeGreaterThanOrEqual(LIGHT_SURFACE_MIN_LUMINANCE);
				else expect(luminance, surface).toBeLessThanOrEqual(DARK_SURFACE_MAX_LUMINANCE);
			}
		}
	});

	test('a state text value that already clears the bound is kept in every theme', () => {
		// Measured with daisyui 5.7.50: the amber warning values pass as they are.
		for (const { variables } of Object.values(STOCK_THEMES)) {
			const bridged = bridgeVariables(variables);
			const light = toHex(parseCssColor(bridged['--pie-qti-warning-text'], 'light'));
			const dark = toHex(parseCssColor(bridged['--pie-qti-warning-text'], 'dark'));
			expect([light, dark]).toEqual(['#92400e', '#fbbf24']);
		}
	});

	test('without the relative-colour tier the fixed values pass on neutral surfaces only', () => {
		const fallback = bridgeVariables(STOCK_THEMES.light.variables, ENGINES.baseline);
		expect(fallback['--pie-qti-error-text']).toBe('light-dark(#b91c1c, #f87171)');
		// On the plain white light theme even the fallback clears 4.5:1.
		const neutral = bridgeVariables(STOCK_THEMES.light.variables, ENGINES.colorMixOnly);
		for (const token of STATE_TEXT_TOKENS) {
			const { value, label } = minimumOnSurfaces(neutral, 'light', token);
			expect(value, label).toBeGreaterThanOrEqual(WCAG_TEXT);
		}
	});
});

describe('DaisyUI light and dark themes: text and boundaries', () => {
	for (const scheme of ['light', 'dark'] as const) {
		const variables = bridgeVariables(STOCK_THEMES[scheme].variables);
		for (const token of TEXT_TOKENS) {
			for (const surface of BASE_SURFACES) {
				test(`${scheme}: ${token} on ${surface} >= ${WCAG_TEXT}:1`, () => {
					const { value, label } = ratio(variables, scheme, token, surface);
					expect(value, label).toBeGreaterThanOrEqual(WCAG_TEXT);
				});
			}
		}

		for (const surface of BASE_SURFACES) {
			test(`${scheme}: --pie-qti-border-strong on ${surface} >= ${WCAG_NON_TEXT}:1`, () => {
				const { value, label } = ratio(variables, scheme, '--pie-qti-border-strong', surface);
				expect(value, label).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
			});
		}
	}

	test('never maps message/state text tokens to DaisyUI colours', () => {
		for (const block of bridgeBlocks) {
			for (const token of [...STATE_TEXT_TOKENS, '--pie-qti-border-strong']) {
				if (block.supports === null) expect(block.declarations[token], token).toBeDefined();
				if (token in block.declarations) expect(block.declarations[token], token).not.toContain('var(--color-');
			}
		}
	});

	test('maps DaisyUI radius tokens with the @pie-qti/theme defaults as fallbacks', () => {
		const declarations = bridgeBlocks[0].declarations;
		expect(declarations['--pie-qti-radius']).toBe('var(--radius-box, 0.5rem)');
		expect(declarations['--pie-qti-radius-sm']).toBe('var(--radius-field, 0.25rem)');
		expect(computeCustomProperties({ '--x': declarations['--pie-qti-radius'] })['--x']).toBe('0.5rem');
	});
});
