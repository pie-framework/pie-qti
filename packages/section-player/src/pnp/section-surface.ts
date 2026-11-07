import { applyPnpToSurface, clearPnpSurface, type PnpProfile } from '@pie-qti/item-player';

/**
 * Svelte action that makes an element the section's PNP surface: the profile's
 * display needs — colour scheme, inverted polarity, single-column layout, text
 * appearance, magnification metadata — apply to everything the section renders
 * inside it (passages, rubrics, tool bars, layout chrome and the items), and the
 * item bodies inside leave them to it. Nothing outside the element changes, so a
 * colour scheme never repaints the host page.
 */
export function pnpSurface(node: HTMLElement, pnp: PnpProfile | undefined) {
	applyPnpToSurface(node, pnp);
	return {
		update(next: PnpProfile | undefined) {
			applyPnpToSurface(node, next);
		},
		destroy() {
			clearPnpSurface(node);
		},
	};
}
