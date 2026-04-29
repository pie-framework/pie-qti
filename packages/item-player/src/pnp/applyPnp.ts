import type { PnpProfile } from './types.js';

const ATTR = 'data-qti-colorscheme';

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

	if (pnp?.display?.magnification !== undefined) {
		console.warn('[QTI Player] PnpProfile.display.magnification is not yet applied by the player. Use browser zoom or a host stylesheet instead.');
	}
}
