export type QtiThemeVariables = Record<`--pie-qti-${string}`, string>;

export type DaisyThemeTokens = {
	base100?: string;
	base200?: string;
	base300?: string;
	baseContent?: string;
	primary?: string;
	primaryContent?: string;
	secondary?: string;
	secondaryContent?: string;
	accent?: string;
	accentContent?: string;
	neutral?: string;
	neutralContent?: string;
	info?: string;
	infoContent?: string;
	success?: string;
	successContent?: string;
	warning?: string;
	warningContent?: string;
	error?: string;
	errorContent?: string;
	/** DaisyUI `--radius-box` (cards, alerts, modals). */
	radiusBox?: string;
	/** DaisyUI `--radius-field` (buttons, inputs, selects). */
	radiusField?: string;
};

/**
 * Answers a CSS `@supports` condition, as `CSS.supports(conditionText)` does.
 * The bridge's focus and text-on-fill colours need colour features that not
 * every engine has, so the mapping picks the same tier the stylesheet's
 * `@supports` blocks pick.
 */
export type CssSupportsCondition = (conditionText: string) => boolean;

export interface DaisyBridgeOptions {
	/** Defaults to the browser's `CSS.supports`; without one, the plain DaisyUI values are used. */
	supports?: CssSupportsCondition;
}

/** The `@supports` conditions of bridge.css, verbatim. */
const COLOR_MIX_SUPPORT = '(color: color-mix(in oklab, red 45%, blue))';
const RELATIVE_COLOR_SUPPORT =
	'(color: color(from red srgb-linear clamp(0, (0.5 - r) * 1000000, 1) calc(g * min(1, 0.5 / max(0.0001, b))) calc(b + max(0, 0.5 - min(r, 1)) * (1 - b)) / 1))';
const RELATIVE_COLOR_LIGHT_DARK_SUPPORT = `${RELATIVE_COLOR_SUPPORT} and (color: light-dark(red, blue))`;

/**
 * Message/state text and control-boundary tokens. These are intentionally not
 * derived from DaisyUI's fill colours, which fail 4.5:1 as text; they keep the
 * `@pie-qti/theme` defaults and pick the light or dark value from the
 * `color-scheme` every DaisyUI theme declares. Kept identical to bridge.css.
 */
const DAISY_ACCESSIBLE_TEXT_VARIABLES = {
	'--pie-qti-error-text': 'light-dark(#b91c1c, #f87171)',
	'--pie-qti-warning-text': 'light-dark(#92400e, #fbbf24)',
	'--pie-qti-success-text': 'light-dark(#15803d, #4ade80)',
	'--pie-qti-info-text': 'light-dark(#1d4ed8, #60a5fa)',
	'--pie-qti-border-strong': 'light-dark(#767676, #9ca3af)',
} as const satisfies QtiThemeVariables;

function browserSupports(conditionText: string): boolean {
	return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(conditionText);
}

/** Relative luminance of a relative colour's origin, clipped to sRGB, over srgb-linear channels. */
const CLIPPED_LUMINANCE = '(0.2126 * clamp(0, r, 1) + 0.7152 * clamp(0, g, 1) + 0.0722 * clamp(0, b, 1))';
/** Upper bound of the displayed luminance (negative channels ignored). */
const LUMINANCE_UPPER_BOUND = '0.2126 * max(r, 0) + 0.7152 * max(g, 0) + 0.0722 * max(b, 0)';
/** Lower bound of the displayed luminance (channels above 1 ignored). */
const LUMINANCE_LOWER_BOUND = '(0.2126 * min(r, 1) + 0.7152 * min(g, 1) + 0.0722 * min(b, 1))';

/**
 * Black or white, whichever contrasts more with the fill: one of them reaches
 * >= 4.58:1 on any colour, and they are equal at relative luminance 0.17913.
 */
function contrastingContent(fill: string): string {
	const channel = `clamp(0, (0.17913 - ${CLIPPED_LUMINANCE}) * 1000000, 1)`;
	return `color(from ${fill} srgb-linear ${channel} ${channel} ${channel} / 1)`;
}

/**
 * The primary, darkened in light themes to luminance <= 0.175 and lightened in
 * dark themes to luminance >= 0.25 (in linear light, only when needed): >= 3:1
 * on surfaces of luminance >= 0.625 (light) or <= 0.05 (dark).
 */
function clampedFocus(primary: string): string {
	const darken = (channel: string) => `calc(${channel} * min(1, 0.175 / max(0.0001, ${LUMINANCE_UPPER_BOUND})))`;
	const lighten = (channel: string) =>
		`calc(${channel} + max(0, (0.25 - ${LUMINANCE_LOWER_BOUND}) / max(0.0001, 1 - ${LUMINANCE_LOWER_BOUND})) * (1 - ${channel}))`;
	return `light-dark(color(from ${primary} srgb-linear ${darken('r')} ${darken('g')} ${darken('b')} / 1), color(from ${primary} srgb-linear ${lighten('r')} ${lighten('g')} ${lighten('b')} / 1))`;
}

function focusColor(primary: string, baseContent: string | undefined, supports: CssSupportsCondition): string {
	if (supports(RELATIVE_COLOR_LIGHT_DARK_SUPPORT)) return clampedFocus(primary);
	if (baseContent && supports(COLOR_MIX_SUPPORT)) {
		return `color-mix(in oklab, ${primary} 45%, ${baseContent})`;
	}
	return primary;
}

function contentOnFill(
	fill: string | undefined,
	daisyContent: string | undefined,
	supports: CssSupportsCondition,
): string | undefined {
	return fill && supports(RELATIVE_COLOR_SUPPORT) ? contrastingContent(fill) : daisyContent;
}

function normalize(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function definedEntries(
	variables: Record<`--pie-qti-${string}`, string | undefined>,
): QtiThemeVariables {
	return Object.fromEntries(
		Object.entries(variables).filter((entry): entry is [`--pie-qti-${string}`, string] =>
			Boolean(entry[1]),
		),
	) as QtiThemeVariables;
}

/**
 * The variables bridge.css sets, for the tokens given; missing tokens map to
 * the DaisyUI `var(--color-*)` they stand for.
 */
export function mapDaisyThemeToQtiVariables(
	tokens: DaisyThemeTokens,
	options: DaisyBridgeOptions = {},
): QtiThemeVariables {
	const supports = options.supports ?? browserSupports;
	const primary = tokens.primary ?? 'var(--color-primary)';
	const secondary = tokens.secondary ?? 'var(--color-secondary)';
	const accent = tokens.accent ?? 'var(--color-accent)';
	const neutral = tokens.neutral ?? 'var(--color-neutral)';
	const info = tokens.info ?? 'var(--color-info)';
	const success = tokens.success ?? 'var(--color-success)';
	const warning = tokens.warning ?? 'var(--color-warning)';
	const error = tokens.error ?? 'var(--color-error)';
	const baseContent = tokens.baseContent ?? 'var(--color-base-content)';
	const content = (fill: string, daisyContent: string) =>
		contentOnFill(fill, daisyContent, supports) as string;
	return definedEntries({
		'--pie-qti-primary': primary,
		'--pie-qti-primary-content': content(primary, tokens.primaryContent ?? 'var(--color-primary-content)'),
		'--pie-qti-secondary': secondary,
		'--pie-qti-secondary-content': content(secondary, tokens.secondaryContent ?? 'var(--color-secondary-content)'),
		'--pie-qti-accent': accent,
		'--pie-qti-accent-content': content(accent, tokens.accentContent ?? 'var(--color-accent-content)'),
		'--pie-qti-neutral': neutral,
		'--pie-qti-neutral-content': content(neutral, tokens.neutralContent ?? 'var(--color-neutral-content)'),
		'--pie-qti-base-100': tokens.base100 ?? 'var(--color-base-100)',
		'--pie-qti-base-200': tokens.base200 ?? 'var(--color-base-200)',
		'--pie-qti-base-300': tokens.base300 ?? 'var(--color-base-300)',
		'--pie-qti-base-content': baseContent,
		'--pie-qti-info': info,
		'--pie-qti-info-content': content(info, tokens.infoContent ?? 'var(--color-info-content)'),
		'--pie-qti-success': success,
		'--pie-qti-success-content': content(success, tokens.successContent ?? 'var(--color-success-content)'),
		'--pie-qti-warning': warning,
		'--pie-qti-warning-content': content(warning, tokens.warningContent ?? 'var(--color-warning-content)'),
		'--pie-qti-error': error,
		'--pie-qti-error-content': content(error, tokens.errorContent ?? 'var(--color-error-content)'),
		'--pie-qti-focus': focusColor(primary, baseContent, supports),
		...DAISY_ACCESSIBLE_TEXT_VARIABLES,
		'--pie-qti-radius': tokens.radiusBox ?? 'var(--radius-box, 0.5rem)',
		'--pie-qti-radius-sm': tokens.radiusField ?? 'var(--radius-field, 0.25rem)',
	});
}

export function readDaisyThemeTokensFromElement(element: HTMLElement): DaisyThemeTokens | null {
	const computed = getComputedStyle(element);
	const tokens: DaisyThemeTokens = {
		base100: normalize(computed.getPropertyValue('--color-base-100')),
		base200: normalize(computed.getPropertyValue('--color-base-200')),
		base300: normalize(computed.getPropertyValue('--color-base-300')),
		baseContent: normalize(computed.getPropertyValue('--color-base-content')),
		primary: normalize(computed.getPropertyValue('--color-primary')),
		primaryContent: normalize(computed.getPropertyValue('--color-primary-content')),
		secondary: normalize(computed.getPropertyValue('--color-secondary')),
		secondaryContent: normalize(computed.getPropertyValue('--color-secondary-content')),
		accent: normalize(computed.getPropertyValue('--color-accent')),
		accentContent: normalize(computed.getPropertyValue('--color-accent-content')),
		neutral: normalize(computed.getPropertyValue('--color-neutral')),
		neutralContent: normalize(computed.getPropertyValue('--color-neutral-content')),
		info: normalize(computed.getPropertyValue('--color-info')),
		infoContent: normalize(computed.getPropertyValue('--color-info-content')),
		success: normalize(computed.getPropertyValue('--color-success')),
		successContent: normalize(computed.getPropertyValue('--color-success-content')),
		warning: normalize(computed.getPropertyValue('--color-warning')),
		warningContent: normalize(computed.getPropertyValue('--color-warning-content')),
		error: normalize(computed.getPropertyValue('--color-error')),
		errorContent: normalize(computed.getPropertyValue('--color-error-content')),
		radiusBox: normalize(computed.getPropertyValue('--radius-box')),
		radiusField: normalize(computed.getPropertyValue('--radius-field')),
	};

	return tokens.base100 || tokens.primary || tokens.baseContent ? tokens : null;
}

/** Like {@link mapDaisyThemeToQtiVariables}, but only for the tokens given. */
export function mapResolvedDaisyThemeToQtiVariables(
	tokens: DaisyThemeTokens,
	options: DaisyBridgeOptions = {},
): QtiThemeVariables {
	const supports = options.supports ?? browserSupports;
	return definedEntries({
		'--pie-qti-primary': tokens.primary,
		'--pie-qti-primary-content': contentOnFill(tokens.primary, tokens.primaryContent, supports),
		'--pie-qti-secondary': tokens.secondary,
		'--pie-qti-secondary-content': contentOnFill(tokens.secondary, tokens.secondaryContent, supports),
		'--pie-qti-accent': tokens.accent,
		'--pie-qti-accent-content': contentOnFill(tokens.accent, tokens.accentContent, supports),
		'--pie-qti-neutral': tokens.neutral,
		'--pie-qti-neutral-content': contentOnFill(tokens.neutral, tokens.neutralContent, supports),
		'--pie-qti-base-100': tokens.base100,
		'--pie-qti-base-200': tokens.base200,
		'--pie-qti-base-300': tokens.base300,
		'--pie-qti-base-content': tokens.baseContent,
		'--pie-qti-info': tokens.info,
		'--pie-qti-info-content': contentOnFill(tokens.info, tokens.infoContent, supports),
		'--pie-qti-success': tokens.success,
		'--pie-qti-success-content': contentOnFill(tokens.success, tokens.successContent, supports),
		'--pie-qti-warning': tokens.warning,
		'--pie-qti-warning-content': contentOnFill(tokens.warning, tokens.warningContent, supports),
		'--pie-qti-error': tokens.error,
		'--pie-qti-error-content': contentOnFill(tokens.error, tokens.errorContent, supports),
		'--pie-qti-focus': tokens.primary && focusColor(tokens.primary, tokens.baseContent, supports),
		'--pie-qti-radius': tokens.radiusBox,
		'--pie-qti-radius-sm': tokens.radiusField,
	});
}

export function applyDaisyThemeToElement(
	element: HTMLElement,
	tokens: DaisyThemeTokens,
	options: DaisyBridgeOptions = {},
): void {
	for (const [key, value] of Object.entries(mapDaisyThemeToQtiVariables(tokens, options)) as Array<
		[string, string]
	>) {
		element.style.setProperty(key, value);
	}
}
