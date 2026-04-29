import type { Player } from '../core/Player.js';
import { applyGlossaryTriggers } from './applyGlossaryTriggers.js';

export interface GlossaryActionParams {
	player: Player;
}

/**
 * Svelte action that reactively applies glossary trigger buttons to
 * [data-catalog-idref] elements in the rendered item body.
 *
 * Applied to the .qti-item-body container. When the player changes (new item
 * loaded), Svelte calls update() after {@html} has replaced the DOM content,
 * so the walk always runs on fresh markup.
 */
export function glossaryAction(node: HTMLElement, params: GlossaryActionParams) {
	applyGlossaryTriggers(node, params.player);

	return {
		update(newParams: GlossaryActionParams) {
			// {@html} replacement already wiped any previously injected wrappers.
			applyGlossaryTriggers(node, newParams.player);
		},
		destroy() {
			// Node is being removed from DOM — no cleanup needed.
		},
	};
}
