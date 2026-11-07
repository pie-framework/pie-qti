/**
 * Test support: parse the CSS colour notations used by the PIE QTI token
 * stylesheets, convert them to sRGB, and compute WCAG 2.x contrast ratios.
 *
 * Supported colour notations: `#rgb`, `#rrggbb`, `oklch(L C H)` (L as a
 * percentage or 0-1 number), and `light-dark(<light>, <dark>)` when a colour
 * scheme is supplied. Translucent colours are rejected: a contrast guarantee
 * for an alpha colour depends on what it is composited over.
 *
 * Not shipped; used by the theme and theme-daisyui contrast tests.
 */

export type Rgb = readonly [number, number, number];
export type ColorScheme = 'light' | 'dark';
export type CssVariables = Record<string, string>;

const OKLCH_PATTERN =
	/^oklch\(\s*([+-]?[\d.]+)(%?)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function encodeSrgb(linear: number): number {
	const v = clamp01(linear);
	return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

function decodeSrgb(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Quantise to 8 bits per channel, as the colour is rasterised on screen. */
function quantise(rgb: Rgb): Rgb {
	return rgb.map((channel) => Math.round(clamp01(channel) * 255) / 255) as unknown as Rgb;
}

function oklchToSrgb(lightness: number, chroma: number, hueDegrees: number): Rgb {
	const hue = (hueDegrees * Math.PI) / 180;
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);

	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

	// Out-of-gamut channels are clipped, matching how sRGB displays and
	// automated checkers (axe-core) treat them.
	return quantise([
		encodeSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		encodeSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		encodeSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	]);
}

function hexToSrgb(hex: string): Rgb {
	const digits = hex.slice(1);
	const expanded =
		digits.length === 3
			? digits
					.split('')
					.map((digit) => digit + digit)
					.join('')
			: digits;
	if (!/^[\da-f]{6}$/i.test(expanded)) {
		throw new Error(`Unsupported hex colour (alpha is not allowed): ${hex}`);
	}
	return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255) as unknown as Rgb;
}

/** Split `light-dark(a, b)` arguments, respecting nested parentheses. */
function splitTopLevelArguments(inner: string): string[] {
	const args: string[] = [];
	let depth = 0;
	let current = '';
	for (const char of inner) {
		if (char === '(') depth += 1;
		if (char === ')') depth -= 1;
		if (char === ',' && depth === 0) {
			args.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}
	args.push(current.trim());
	return args;
}

/**
 * Select the branch of a `light-dark()` value for a colour scheme. Values
 * without `light-dark()` are returned unchanged.
 */
export function selectColorSchemeBranch(value: string, scheme: ColorScheme): string {
	const trimmed = value.trim();
	const match = /^light-dark\((.*)\)$/is.exec(trimmed);
	if (!match) return trimmed;
	const args = splitTopLevelArguments(match[1]);
	if (args.length !== 2) {
		throw new Error(`light-dark() expects two arguments: ${value}`);
	}
	return scheme === 'dark' ? args[1] : args[0];
}

export function parseCssColor(value: string, scheme: ColorScheme = 'light'): Rgb {
	const color = selectColorSchemeBranch(value, scheme);
	if (color.startsWith('#')) {
		return hexToSrgb(color);
	}

	const oklch = OKLCH_PATTERN.exec(color);
	if (oklch) {
		const [, rawLightness, percent, rawChroma, rawHue, rawAlpha] = oklch;
		if (rawAlpha !== undefined) {
			const alpha = rawAlpha.endsWith('%') ? Number.parseFloat(rawAlpha) / 100 : Number.parseFloat(rawAlpha);
			if (alpha < 1) {
				throw new Error(`Translucent colours have no fixed contrast: ${value}`);
			}
		}
		const lightness = Number.parseFloat(rawLightness) / (percent ? 100 : 1);
		return oklchToSrgb(lightness, Number.parseFloat(rawChroma), Number.parseFloat(rawHue));
	}

	throw new Error(`Unsupported colour notation: ${value}`);
}

export function relativeLuminance(rgb: Rgb): number {
	const [r, g, b] = rgb.map(decodeSrgb);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
	const a = relativeLuminance(foreground);
	const b = relativeLuminance(background);
	const [lighter, darker] = a > b ? [a, b] : [b, a];
	return (lighter + 0.05) / (darker + 0.05);
}

export function toHex(rgb: Rgb): string {
	return `#${rgb
		.map((channel) =>
			Math.round(clamp01(channel) * 255)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`;
}

export interface CssRuleBlock {
	selectors: string[];
	declarations: CssVariables;
}

/**
 * Parse the flat (non-nested) custom-property rule blocks of a stylesheet.
 * Comments are stripped; only `--*` declarations are collected.
 */
export function parseCustomPropertyBlocks(css: string): CssRuleBlock[] {
	const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const blocks: CssRuleBlock[] = [];
	for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectors = match[1]
			.split(',')
			.map((selector) => selector.trim())
			.filter(Boolean);
		const declarations: CssVariables = {};
		for (const declaration of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
			declarations[declaration[1]] = declaration[2].trim();
		}
		blocks.push({ selectors, declarations });
	}
	return blocks;
}

/**
 * Compute the custom-property values an element sees, modelling CSS
 * semantics: properties declared on the element substitute `var()` against
 * the element's own computed values, everything else is inherited already
 * computed from the parent scope.
 */
export function computeCustomProperties(declared: CssVariables, inherited: CssVariables = {}): CssVariables {
	const computed: CssVariables = { ...inherited };
	const resolving = new Set<string>();

	const resolve = (name: string): string | undefined => {
		if (!(name in declared)) return computed[name];
		if (resolving.has(name)) {
			throw new Error(`Cyclic custom property reference: ${name}`);
		}
		resolving.add(name);
		const value = substituteVars(declared[name], resolve);
		resolving.delete(name);
		return value;
	};

	for (const name of Object.keys(declared)) {
		const value = resolve(name);
		if (value !== undefined) computed[name] = value;
	}
	return computed;
}

function substituteVars(value: string, lookup: (name: string) => string | undefined): string {
	const varPattern = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/;
	let output = value;
	for (let guard = 0; guard < 32; guard += 1) {
		const match = varPattern.exec(output);
		if (!match) return output;
		const replacement = lookup(match[1]) ?? match[2]?.trim();
		if (replacement === undefined) {
			throw new Error(`Unresolved custom property ${match[1]} in "${value}"`);
		}
		output = output.slice(0, match.index) + replacement + output.slice(match.index + match[0].length);
	}
	throw new Error(`Too many var() substitutions in "${value}"`);
}
