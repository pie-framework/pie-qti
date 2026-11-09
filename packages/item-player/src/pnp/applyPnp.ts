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
 * Apply a PNP profile to the player root element as attributes and custom properties. The
 * default runtime stylesheet renders color scheme, inverted polarity, single-column layout and
 * text appearance; magnification is set for host stylesheets only.
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
	const polarityForeground = validColor(polarity?.foreground, 'display.invertPolarity.foreground');
	const polarityBackground = validColor(polarity?.background, 'display.invertPolarity.background');
	if (polarity) {
		rootEl.setAttribute(INVERT_POLARITY_ATTR, polarityForeground || polarityBackground ? 'colors' : 'invert');
	} else {
		rootEl.removeAttribute(INVERT_POLARITY_ATTR);
	}
	setProperty(rootEl, '--qti-invert-foreground', polarityForeground);
	setProperty(rootEl, '--qti-invert-background', polarityBackground);

	if (display?.singleColumn) rootEl.setAttribute(LAYOUT_ATTR, 'single-column');
	else rootEl.removeAttribute(LAYOUT_ATTR);

	const appearance = display?.textAppearance;
	const appearanceValue = (key: keyof PnpTextAppearance): string | number | undefined => {
		const value = appearance?.[key];
		if (COLOR_APPEARANCE_FIELDS.has(key)) {
			return validColor(typeof value === 'string' ? value : undefined, `display.textAppearance.${key}`);
		}
		return value;
	};
	const tokens: string[] = [];
	for (const [key, token, unit] of TEXT_APPEARANCE_PROPERTIES) {
		const value = appearanceValue(key);
		const css = value === undefined || value === '' ? undefined : `${value}${unit}`;
		if (css !== undefined) tokens.push(token);
		setProperty(rootEl, `--qti-${token}`, css);
	}
	if (tokens.length > 0) rootEl.setAttribute(TEXT_APPEARANCE_ATTR, tokens.join(' '));
	else rootEl.removeAttribute(TEXT_APPEARANCE_ATTR);
}

/**
 * Marks a PNP surface: an element that applies the candidate's display needs to
 * everything it renders, its item players included (a section player's layout).
 */
export const PNP_SURFACE_ATTRIBUTE = 'data-qti-pnp-surface';

/**
 * Apply a profile's display needs to a surface that renders more than one item's
 * content — passages, rubrics, tool bars and items. Everything inside takes them
 * from the surface: an item body inside one applies none of its own, so the surface
 * decides one colour scheme, text appearance and polarity for all of it (and an
 * inverting filter is never applied twice). Nothing outside the surface changes.
 */
export function applyPnpToSurface(surfaceEl: HTMLElement, pnp: PnpProfile | undefined): void {
	surfaceEl.setAttribute(PNP_SURFACE_ATTRIBUTE, '');
	applyPnpToRoot(surfaceEl, pnp);
}

/** Stop being a PNP surface: its display attributes go, and items inside apply their own again. */
export function clearPnpSurface(surfaceEl: HTMLElement): void {
	surfaceEl.removeAttribute(PNP_SURFACE_ATTRIBUTE);
	applyPnpToRoot(surfaceEl, undefined);
}

/** Whether an ancestor of `el`, looking through shadow roots, is a PNP surface. */
export function isWithinPnpSurface(el: Element): boolean {
	let node: Element | null | undefined = el.parentElement ?? shadowHostOf(el);
	while (node) {
		if (node.closest(`[${PNP_SURFACE_ATTRIBUTE}]`)) return true;
		node = shadowHostOf(node);
	}
	return false;
}

/** The host of the shadow root `node` sits in, if any. */
function shadowHostOf(node: Node): Element | null {
	const root = node.getRootNode?.() as { host?: Element } | undefined;
	return root?.host ?? null;
}

function setProperty(rootEl: HTMLElement, property: string, value: string | undefined): void {
	if (value === undefined) rootEl.style?.removeProperty?.(property);
	else rootEl.style?.setProperty?.(property, value);
}

/** The text-appearance fields whose value is a CSS colour. */
const COLOR_APPEARANCE_FIELDS = new Set<string>(['fontColor', 'backgroundColor']);

/**
 * A colour from the profile, or `undefined` when CSS cannot parse it. A host
 * delivers the JSON profile directly, so a typo reaches here unfiltered — and
 * an invalid colour wipes whatever the custom property styles (focus outlines,
 * control borders). `CSS.supports('color', …)` filters it; without a CSS engine
 * (SSR, tests) there is nothing to ask and every value applies.
 */
function validColor(value: string | undefined, field: string): string | undefined {
	if (value === undefined || value === '') return undefined;
	if (colorIsSupported(value)) return value;
	console.warn(`[@pie-qti/item-player] PNP ${field} "${value}" is not a colour CSS understands and is ignored.`);
	return undefined;
}

/** `CSS.supports('color', value)` where the environment exposes it; otherwise true. */
function colorIsSupported(value: string): boolean {
	if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return true;
	try {
		return CSS.supports('color', value);
	} catch {
		return false;
	}
}
