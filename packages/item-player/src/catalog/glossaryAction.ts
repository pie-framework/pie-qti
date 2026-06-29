import { applyGlossaryTriggers, type GlossaryPlayer } from './applyGlossaryTriggers.js';

export interface GlossaryActionParams {
	player: GlossaryPlayer & {
		onPnpChange?: (listener: () => void) => () => void;
	};
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
	let cleanup = applyGlossaryTriggers(node, params.player);
	let unsubscribePnp = params.player.onPnpChange?.(() => {
		cleanup();
		cleanup = applyGlossaryTriggers(node, params.player);
	}) ?? (() => {});

	return {
		update(newParams: GlossaryActionParams) {
			cleanup();
			unsubscribePnp();
			cleanup = applyGlossaryTriggers(node, newParams.player);
			unsubscribePnp = newParams.player.onPnpChange?.(() => {
				cleanup();
				cleanup = applyGlossaryTriggers(node, newParams.player);
			}) ?? (() => {});
		},
		destroy() {
			unsubscribePnp();
			cleanup();
		},
	};
}
