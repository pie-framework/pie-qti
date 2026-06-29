import type { PnpProfile } from './types.js';

const ATTR = 'data-qti-colorscheme';
const MAGNIFICATION_ATTR = 'data-qti-magnification';

/**
 * Apply a PNP profile to the player root element.
 *
 * Currently handles color scheme (data-qti-colorscheme attribute).
 * Magnification is intentionally deferred — host stylesheets / browser zoom are sufficient for now.
 */
export function applyPnpToRoot(rootEl: HTMLElement, pnp: PnpProfile | undefined): void {
	const scheme = pnp?.display?.colorScheme;

	if (!scheme || scheme === 'default') {
		rootEl.removeAttribute(ATTR);
	} else {
		rootEl.setAttribute(ATTR, scheme);
	}

	const magnification = pnp?.display?.magnification;
	if (magnification !== undefined && Number.isFinite(magnification) && magnification > 0) {
		rootEl.setAttribute(MAGNIFICATION_ATTR, String(magnification));
		rootEl.style?.setProperty?.('--qti-magnification', String(magnification));
	} else {
		rootEl.removeAttribute(MAGNIFICATION_ATTR);
		rootEl.style?.removeProperty?.('--qti-magnification');
	}
}
