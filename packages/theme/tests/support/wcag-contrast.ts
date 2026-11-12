/**
 * Test support: parse the CSS colour notations used by the PIE QTI token
 * stylesheets, convert them to sRGB, and compute WCAG 2.x contrast ratios.
 *
 * Supported colour notations: `#rgb`, `#rrggbb`, `black`, `white`,
 * `oklch(L C H)` (L as a percentage or 0-1 number), `light-dark(<light>,
 * <dark>)` when a colour scheme is supplied, `color-mix(in oklab, ...)`, and
 * relative colour syntax over srgb-linear: `color(from <colour> srgb-linear
 * <channel> <channel> <channel> [/ <alpha>])`, where each channel is a number,
 * a channel keyword (`r`, `g`, `b`, `alpha`) or a `calc()`, `min()`, `max()`
 * or `clamp()` expression of them. Translucent colours are rejected: a
 * contrast guarantee for an alpha colour depends on what it is composited over.
 *
 * Colours are carried as unclipped linear-light sRGB, as CSS does for
 * color-mix() and relative colour syntax, and are clipped to the sRGB gamut and
 * quantised to 8 bits only when measured, as they are displayed.
 *
 * Not shipped; used by the theme and theme-daisyui contrast tests.
 */

export type Rgb = readonly [number, number, number];
/** Linear-light sRGB channels; values outside 0..1 are out of the sRGB gamut. */
export type LinearRgb = readonly [number, number, number];
export type ColorScheme = 'light' | 'dark';
export type CssVariables = Record<string, string>;

const OKLCH_PATTERN =
	/^oklch\(\s*([+-]?[\d.]+)(%?)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

const NAMED_COLORS: Record<string, LinearRgb> = {
	black: [0, 0, 0],
	white: [1, 1, 1],
};

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

/**
 * The colour as displayed: out-of-gamut channels are clipped, matching how
 * sRGB displays and automated checkers (axe-core) treat them, and each channel
 * is quantised to 8 bits, as the colour is rasterised on screen.
 */
export function toDisplayedSrgb(linear: LinearRgb): Rgb {
	return linear.map((channel) => Math.round(encodeSrgb(channel) * 255) / 255) as unknown as Rgb;
}

type Oklab = readonly [number, number, number];

function oklabToLinear([lightness, a, b]: Oklab): LinearRgb {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

function linearToOklab([r, g, b]: LinearRgb): Oklab {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function hexToLinear(hex: string): LinearRgb {
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
	return [0, 2, 4].map((offset) =>
		decodeSrgb(Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255),
	) as unknown as LinearRgb;
}

function rejectTranslucent(alpha: number, value: string): void {
	if (alpha < 1) {
		throw new Error(`Translucent colours have no fixed contrast: ${value}`);
	}
}

/** Split function arguments on top-level commas, respecting nested parentheses. */
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

/** Split on top-level whitespace, respecting nested parentheses. */
function splitTopLevelWhitespace(value: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = '';
	for (const char of value) {
		if (char === '(') depth += 1;
		if (char === ')') depth -= 1;
		if (/\s/.test(char) && depth === 0) {
			if (current) parts.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	if (current) parts.push(current);
	return parts;
}

/** `name(inner)` → inner, when the whole value is a single call of that function. */
function functionArguments(value: string, name: string): string | undefined {
	const prefix = `${name}(`;
	if (!value.toLowerCase().startsWith(prefix) || !value.endsWith(')')) return undefined;
	const inner = value.slice(prefix.length, -1);
	let depth = 0;
	for (const char of inner) {
		if (char === '(') depth += 1;
		if (char === ')') depth -= 1;
		if (depth < 0) return undefined;
	}
	return depth === 0 ? inner : undefined;
}

/**
 * Select the branch of a `light-dark()` value for a colour scheme. Values
 * without `light-dark()` are returned unchanged.
 */
export function selectColorSchemeBranch(value: string, scheme: ColorScheme): string {
	const trimmed = value.trim();
	const inner = functionArguments(trimmed, 'light-dark');
	if (inner === undefined) return trimmed;
	const args = splitTopLevelArguments(inner);
	if (args.length !== 2) {
		throw new Error(`light-dark() expects two arguments: ${value}`);
	}
	return scheme === 'dark' ? args[1] : args[0];
}

/** `color-mix(in oklab, <colour> <percentage>?, <colour> <percentage>?)`. */
function parseColorMix(inner: string, value: string, scheme: ColorScheme): LinearRgb {
	const [method, ...colors] = splitTopLevelArguments(inner);
	if (method.replace(/\s+/g, ' ').toLowerCase() !== 'in oklab' || colors.length !== 2) {
		throw new Error(`Only two-colour color-mix(in oklab, ...) is supported: ${value}`);
	}
	const parts = colors.map((argument) => {
		const tokens = splitTopLevelWhitespace(argument);
		const percentage = tokens.find((token) => /^[\d.]+%$/.test(token));
		const color = tokens.filter((token) => token !== percentage).join(' ');
		return {
			oklab: linearToOklab(parseLinearSrgb(color, scheme)),
			weight: percentage === undefined ? undefined : Number.parseFloat(percentage) / 100,
		};
	});
	let [first, second] = parts.map((part) => part.weight);
	if (first === undefined && second === undefined) [first, second] = [0.5, 0.5];
	else if (first === undefined) first = 1 - (second as number);
	else if (second === undefined) second = 1 - first;
	const total = (first as number) + (second as number);
	// A total below 100% leaves the mix translucent.
	rejectTranslucent(total, value);
	const [a, b] = [(first as number) / total, (second as number) / total];
	return oklabToLinear([0, 1, 2].map((i) => parts[0].oklab[i] * a + parts[1].oklab[i] * b) as unknown as Oklab);
}

/** `color(from <colour> srgb-linear <channel> <channel> <channel> [/ <alpha>])`. */
function parseRelativeSrgbLinear(inner: string, value: string, scheme: ColorScheme): LinearRgb {
	const tokens = splitTopLevelWhitespace(inner);
	if (tokens[0]?.toLowerCase() !== 'from' || tokens[2]?.toLowerCase() !== 'srgb-linear') {
		throw new Error(`Only relative color(from <colour> srgb-linear ...) is supported: ${value}`);
	}
	const [r, g, b] = parseLinearSrgb(tokens[1], scheme);
	const keywords = { r, g, b, alpha: 1 };
	const slash = tokens.indexOf('/');
	const channels = slash === -1 ? tokens.slice(3) : tokens.slice(3, slash);
	if (channels.length !== 3 || (slash !== -1 && slash !== tokens.length - 2)) {
		throw new Error(`Expected three channels and an optional alpha: ${value}`);
	}
	if (slash !== -1) {
		rejectTranslucent(evaluateCssMath(tokens[slash + 1], keywords), value);
	}
	return channels.map((channel) => evaluateCssMath(channel, keywords)) as unknown as LinearRgb;
}

/** Parse a colour to unclipped linear-light sRGB. */
export function parseLinearSrgb(value: string, scheme: ColorScheme = 'light'): LinearRgb {
	const color = selectColorSchemeBranch(value, scheme);
	if (color !== value.trim()) return parseLinearSrgb(color, scheme);

	if (color.startsWith('#')) {
		return hexToLinear(color);
	}

	const named = NAMED_COLORS[color.toLowerCase()];
	if (named) return named;

	const oklch = OKLCH_PATTERN.exec(color);
	if (oklch) {
		const [, rawLightness, percent, rawChroma, rawHue, rawAlpha] = oklch;
		if (rawAlpha !== undefined) {
			rejectTranslucent(
				rawAlpha.endsWith('%') ? Number.parseFloat(rawAlpha) / 100 : Number.parseFloat(rawAlpha),
				value,
			);
		}
		const lightness = Number.parseFloat(rawLightness) / (percent ? 100 : 1);
		const chroma = Number.parseFloat(rawChroma);
		const hue = (Number.parseFloat(rawHue) * Math.PI) / 180;
		return oklabToLinear([lightness, chroma * Math.cos(hue), chroma * Math.sin(hue)]);
	}

	const mix = functionArguments(color, 'color-mix');
	if (mix !== undefined) return parseColorMix(mix, value, scheme);

	const relative = functionArguments(color, 'color');
	if (relative !== undefined) return parseRelativeSrgbLinear(relative, value, scheme);

	throw new Error(`Unsupported colour notation: ${value}`);
}

/** Parse a colour as it is displayed: clipped to sRGB and quantised to 8 bits. */
export function parseCssColor(value: string, scheme: ColorScheme = 'light'): Rgb {
	return toDisplayedSrgb(parseLinearSrgb(value, scheme));
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

/*
 * CSS math: numbers, channel keywords, + - * /, parentheses, calc(), min(),
 * max() and clamp(), enough to evaluate relative colour channels.
 */

type MathToken = { kind: 'number'; value: number } | { kind: 'ident'; value: string } | { kind: 'punct'; value: string };

function tokenizeMath(expression: string): MathToken[] {
	const tokens: MathToken[] = [];
	const pattern = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z][a-z-]*)|([()+\-*/,]))/iy;
	let index = 0;
	while (index < expression.length) {
		if (/^\s*$/.test(expression.slice(index))) break;
		pattern.lastIndex = index;
		const match = pattern.exec(expression);
		if (!match) throw new Error(`Unsupported CSS math at "${expression.slice(index)}" in ${expression}`);
		if (match[1] !== undefined) tokens.push({ kind: 'number', value: Number.parseFloat(match[1]) });
		else if (match[2] !== undefined) tokens.push({ kind: 'ident', value: match[2].toLowerCase() });
		else tokens.push({ kind: 'punct', value: match[3] });
		index = pattern.lastIndex;
	}
	return tokens;
}

/** Evaluate a CSS math expression with the given keyword values. */
export function evaluateCssMath(expression: string, keywords: Record<string, number> = {}): number {
	const tokens = tokenizeMath(expression);
	let position = 0;
	const peek = () => tokens[position];
	const expectPunct = (value: string) => {
		const token = tokens[position];
		if (token?.kind !== 'punct' || token.value !== value) {
			throw new Error(`Expected "${value}" in ${expression}`);
		}
		position += 1;
	};
	const isPunct = (value: string) => {
		const token = peek();
		return token?.kind === 'punct' && token.value === value;
	};

	const sum = (): number => {
		let value = product();
		while (isPunct('+') || isPunct('-')) {
			const operator = (tokens[position++] as { value: string }).value;
			const right = product();
			value = operator === '+' ? value + right : value - right;
		}
		return value;
	};
	const product = (): number => {
		let value = unary();
		while (isPunct('*') || isPunct('/')) {
			const operator = (tokens[position++] as { value: string }).value;
			const right = unary();
			value = operator === '*' ? value * right : value / right;
		}
		return value;
	};
	const unary = (): number => {
		if (isPunct('-')) {
			position += 1;
			return -unary();
		}
		return primary();
	};
	const argumentList = (): number[] => {
		expectPunct('(');
		const values = [sum()];
		while (isPunct(',')) {
			position += 1;
			values.push(sum());
		}
		expectPunct(')');
		return values;
	};
	const primary = (): number => {
		const token = tokens[position++];
		if (!token) throw new Error(`Unexpected end of ${expression}`);
		if (token.kind === 'number') return token.value;
		if (token.kind === 'punct') {
			if (token.value !== '(') throw new Error(`Unexpected "${token.value}" in ${expression}`);
			const value = sum();
			expectPunct(')');
			return value;
		}
		if (isPunct('(')) {
			const args = argumentList();
			switch (token.value) {
				case 'calc':
					if (args.length === 1) return args[0];
					break;
				case 'min':
					return Math.min(...args);
				case 'max':
					return Math.max(...args);
				case 'clamp':
					if (args.length === 3) return Math.max(args[0], Math.min(args[1], args[2]));
					break;
			}
			throw new Error(`Unsupported CSS math function ${token.value}() in ${expression}`);
		}
		if (token.value in keywords) return keywords[token.value];
		throw new Error(`Unknown keyword "${token.value}" in ${expression}`);
	};

	const value = sum();
	if (position !== tokens.length) throw new Error(`Unexpected trailing input in ${expression}`);
	return value;
}

export interface CssRuleBlock {
	selectors: string[];
	declarations: CssVariables;
	/**
	 * The `@supports` condition the block is nested in, with whitespace
	 * collapsed (nested conditions joined with `and`); null at the top level.
	 */
	supports: string | null;
}

function matchingBrace(source: string, open: number): number {
	let depth = 0;
	for (let index = open; index < source.length; index += 1) {
		if (source[index] === '{') depth += 1;
		if (source[index] === '}') {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	throw new Error('Unbalanced braces in stylesheet');
}

function parseRules(source: string, supports: string | null, blocks: CssRuleBlock[]): void {
	let index = 0;
	for (;;) {
		const open = source.indexOf('{', index);
		if (open === -1) {
			if (source.slice(index).trim()) throw new Error(`Unparsed CSS: ${source.slice(index).trim()}`);
			return;
		}
		const prelude = source.slice(index, open).trim();
		const close = matchingBrace(source, open);
		const body = source.slice(open + 1, close);
		if (prelude.startsWith('@supports')) {
			const condition = prelude.slice('@supports'.length).replace(/\s+/g, ' ').trim();
			parseRules(body, supports ? `${supports} and ${condition}` : condition, blocks);
		} else if (prelude.startsWith('@')) {
			throw new Error(`Unsupported at-rule: ${prelude}`);
		} else {
			const declarations: CssVariables = {};
			for (const declaration of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
				declarations[declaration[1]] = declaration[2].trim();
			}
			blocks.push({
				selectors: prelude
					.split(',')
					.map((selector) => selector.trim())
					.filter(Boolean),
				declarations,
				supports,
			});
		}
		index = close + 1;
	}
}

/**
 * Parse the custom-property rule blocks of a stylesheet, including those
 * nested in `@supports`. Comments are stripped; only `--*` declarations are
 * collected.
 */
export function parseCustomPropertyBlocks(css: string): CssRuleBlock[] {
	const blocks: CssRuleBlock[] = [];
	parseRules(css.replace(/\/\*[\s\S]*?\*\//g, ''), null, blocks);
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
	for (let guard = 0; guard < 64; guard += 1) {
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
