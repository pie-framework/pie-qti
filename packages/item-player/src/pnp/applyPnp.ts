import type { PnpProfile, PnpTextAppearance } from './types.js';

const ATTR = 'data-qti-colorscheme';
const MAGNIFICATION_ATTR = 'data-qti-magnification';
const INVERT_POLARITY_ATTR = 'data-qti-invert-polarity';
const LAYOUT_ATTR = 'data-qti-layout';
const TEXT_APPEARANCE_ATTR = 'data-qti-text-appearance';

/**
 * Each text-appearance field, its token in `data-qti-text-appearance`, the custom property
 * it sets (`--qti-<token>`) and its CSS unit.
 */
const TEXT_APPEARANCE_PROPERTIES: ReadonlyArray<[keyof PnpTextAppearance, string, string]> = [
	['fontSize', 'font-size', 'pt'],
	['fontFamily', 'font-family', ''],
	['fontColor', 'font-color', ''],
	['backgroundColor', 'background-color', ''],
	['lineHeight', 'line-height', ''],
	['letterSpacing', 'letter-spacing', 'em'],
	['wordSpacing', 'word-spacing', 'em'],
];

/**
 * Apply a PNP profile to the player root element as attributes and custom properties,
 * which the default runtime stylesheet renders: color scheme, magnification, inverted
 * polarity, single-column layout and text appearance.
 */
export function applyPnpToRoot(rootEl: HTMLElement, pnp: PnpProfile | undefined): void {
	const display = pnp?.display;
	const scheme = display?.colorScheme;

	if (!scheme || scheme === 'default') {
		rootEl.removeAttribute(ATTR);
	} else {
		rootEl.setAttribute(ATTR, scheme);
	}

	const magnification = display?.magnification;
	if (magnification !== undefined && Number.isFinite(magnification) && magnification > 0) {
		rootEl.setAttribute(MAGNIFICATION_ATTR, String(magnification));
		setProperty(rootEl, '--qti-magnification', String(magnification));
	} else {
		rootEl.removeAttribute(MAGNIFICATION_ATTR);
		setProperty(rootEl, '--qti-magnification', undefined);
	}

	const polarity = display?.invertPolarity;
	if (polarity) rootEl.setAttribute(INVERT_POLARITY_ATTR, polarity.foreground || polarity.background ? 'colors' : 'invert');
	else rootEl.removeAttribute(INVERT_POLARITY_ATTR);
	setProperty(rootEl, '--qti-invert-foreground', polarity?.foreground);
	setProperty(rootEl, '--qti-invert-background', polarity?.background);

	if (display?.singleColumn) rootEl.setAttribute(LAYOUT_ATTR, 'single-column');
	else rootEl.removeAttribute(LAYOUT_ATTR);

	const appearance = display?.textAppearance;
	const tokens: string[] = [];
	for (const [key, token, unit] of TEXT_APPEARANCE_PROPERTIES) {
		const value = appearance?.[key];
		const css = value === undefined || value === '' ? undefined : `${value}${unit}`;
		if (css !== undefined) tokens.push(token);
		setProperty(rootEl, `--qti-${token}`, css);
	}
	if (tokens.length > 0) rootEl.setAttribute(TEXT_APPEARANCE_ATTR, tokens.join(' '));
	else rootEl.removeAttribute(TEXT_APPEARANCE_ATTR);
}

function setProperty(rootEl: HTMLElement, property: string, value: string | undefined): void {
	if (value === undefined) rootEl.style?.removeProperty?.(property);
	else rootEl.style?.setProperty?.(property, value);
}
