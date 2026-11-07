import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Test-only colour maths shared with the @pie-qti/theme contrast test.
import {
	type ColorScheme,
	type CssVariables,
	computeCustomProperties,
	contrastRatio,
	parseCssColor,
	parseCustomPropertyBlocks,
	toHex,
} from '../../theme/tests/support/wcag-contrast';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeCss = readFileSync(resolve(__dirname, '../src/bridge.css'), 'utf8');

const WCAG_TEXT = 4.5;
const WCAG_NON_TEXT = 3;

/**
 * DaisyUI 5 built-in `light` and `dark` theme values (daisyui@5.7.50
 * themes.css), the themes the demo app ships by default. Only the variables
 * the bridge reads are listed. Update these when DaisyUI changes its palettes.
 */
const DAISY_THEMES: Record<ColorScheme, CssVariables> = {
	light: {
		'--color-base-100': 'oklch(100% 0 0)',
		'--color-base-200': 'oklch(98% 0 0)',
		'--color-base-300': 'oklch(95% 0 0)',
		'--color-base-content': 'oklch(21% 0.006 285.885)',
		'--color-primary': 'oklch(45% 0.24 277.023)',
		'--color-primary-content': 'oklch(93% 0.034 272.788)',
		'--color-secondary': 'oklch(65% 0.241 354.308)',
		'--color-secondary-content': 'oklch(94% 0.028 342.258)',
		'--color-accent': 'oklch(77% 0.152 181.912)',
		'--color-accent-content': 'oklch(38% 0.063 188.416)',
		'--color-neutral': 'oklch(14% 0.005 285.823)',
		'--color-neutral-content': 'oklch(92% 0.004 286.32)',
		'--color-info': 'oklch(74% 0.16 232.661)',
		'--color-info-content': 'oklch(29% 0.066 243.157)',
		'--color-success': 'oklch(76% 0.177 163.223)',
		'--color-success-content': 'oklch(37% 0.077 168.94)',
		'--color-warning': 'oklch(82% 0.189 84.429)',
		'--color-warning-content': 'oklch(41% 0.112 45.904)',
		'--color-error': 'oklch(71% 0.194 13.428)',
		'--color-error-content': 'oklch(27% 0.105 12.094)',
		'--radius-box': '0.5rem',
		'--radius-field': '0.25rem',
	},
	dark: {
		'--color-base-100': 'oklch(25.33% 0.016 252.42)',
		'--color-base-200': 'oklch(23.26% 0.014 253.1)',
		'--color-base-300': 'oklch(21.15% 0.012 254.09)',
		'--color-base-content': 'oklch(97.807% 0.029 256.847)',
		'--color-primary': 'oklch(58% 0.233 277.117)',
		'--color-primary-content': 'oklch(96% 0.018 272.314)',
		'--color-secondary': 'oklch(65% 0.241 354.308)',
		'--color-secondary-content': 'oklch(94% 0.028 342.258)',
		'--color-accent': 'oklch(77% 0.152 181.912)',
		'--color-accent-content': 'oklch(38% 0.063 188.416)',
		'--color-neutral': 'oklch(14% 0.005 285.823)',
		'--color-neutral-content': 'oklch(92% 0.004 286.32)',
		'--color-info': 'oklch(74% 0.16 232.661)',
		'--color-info-content': 'oklch(29% 0.066 243.157)',
		'--color-success': 'oklch(76% 0.177 163.223)',
		'--color-success-content': 'oklch(37% 0.077 168.94)',
		'--color-warning': 'oklch(82% 0.189 84.429)',
		'--color-warning-content': 'oklch(41% 0.112 45.904)',
		'--color-error': 'oklch(71% 0.194 13.428)',
		'--color-error-content': 'oklch(27% 0.105 12.094)',
		'--radius-box': '0.5rem',
		'--radius-field': '0.25rem',
	},
};

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

function bridgeBlock() {
	const block = parseCustomPropertyBlocks(bridgeCss).find((candidate) => candidate.selectors.includes('[data-theme]'));
	if (!block) throw new Error('bridge.css must declare a :root, [data-theme] block');
	return block;
}

/** The --pie-qti-* values a DaisyUI-themed element computes through the bridge. */
function bridgeVariables(daisyTheme: CssVariables): CssVariables {
	return computeCustomProperties(bridgeBlock().declarations, daisyTheme);
}

function ratio(variables: CssVariables, scheme: ColorScheme, foreground: string, background: string) {
	const fg = parseCssColor(variables[foreground], scheme);
	const bg = parseCssColor(variables[background], scheme);
	return {
		value: contrastRatio(fg, bg),
		label: `${foreground} ${toHex(fg)} on ${background} ${toHex(bg)} (${scheme})`,
	};
}

describe('DaisyUI bridge contrast guarantees', () => {
	for (const scheme of ['light', 'dark'] as const) {
		describe(`DaisyUI ${scheme} theme`, () => {
			const variables = bridgeVariables(DAISY_THEMES[scheme]);

			for (const token of TEXT_TOKENS) {
				for (const surface of BASE_SURFACES) {
					test(`${token} on ${surface} >= ${WCAG_TEXT}:1`, () => {
						const { value, label } = ratio(variables, scheme, token, surface);
						expect(value, label).toBeGreaterThanOrEqual(WCAG_TEXT);
					});
				}
			}

			for (const surface of BASE_SURFACES) {
				test(`--pie-qti-border-strong on ${surface} >= ${WCAG_NON_TEXT}:1`, () => {
					const { value, label } = ratio(variables, scheme, '--pie-qti-border-strong', surface);
					expect(value, label).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
				});

				test(`--pie-qti-focus on ${surface} >= ${WCAG_NON_TEXT}:1 (stock and PIE-branded primary)`, () => {
					for (const primary of [DAISY_THEMES[scheme]['--color-primary'], DEMO_BRAND_PRIMARY[scheme]]) {
						const branded = bridgeVariables({ ...DAISY_THEMES[scheme], '--color-primary': primary });
						const { value, label } = ratio(branded, scheme, '--pie-qti-focus', surface);
						expect(value, label).toBeGreaterThanOrEqual(WCAG_NON_TEXT);
					}
				});
			}
		});
	}

	test('never maps message/state text tokens to DaisyUI colours', () => {
		const declarations = bridgeBlock().declarations;
		for (const token of [...STATE_TEXT_TOKENS, '--pie-qti-border-strong']) {
			expect(declarations[token], token).toBeDefined();
			expect(declarations[token], token).not.toContain('var(--color-');
		}
	});

	test('maps DaisyUI radius tokens with the @pie-qti/theme defaults as fallbacks', () => {
		const declarations = bridgeBlock().declarations;
		expect(declarations['--pie-qti-radius']).toBe('var(--radius-box, 0.5rem)');
		expect(declarations['--pie-qti-radius-sm']).toBe('var(--radius-field, 0.25rem)');
		expect(computeCustomProperties({ '--x': declarations['--pie-qti-radius'] })['--x']).toBe('0.5rem');
	});
});
