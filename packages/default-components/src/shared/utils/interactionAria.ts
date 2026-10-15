import type { InteractionAccessibility } from '@pie-qti/item-player';

/** The id of the hidden element `InteractionDescription` renders in an interaction's shadow root. */
export const INTERACTION_DESCRIPTION_ID = 'qti-interaction-description';

/**
 * Attributes that give an interaction's root its authored accessible name and description:
 * a labelled `group`, or nothing when the interaction carries no authored `aria-*`. The
 * description is the text `InteractionDescription` renders beside them.
 */
export function interactionAria(
	interaction: { accessibility?: InteractionAccessibility } | null | undefined,
): Record<string, string> {
	const accessibility = interaction?.accessibility;
	if (!accessibility?.label && !accessibility?.description) return {};
	return {
		role: 'group',
		...(accessibility.label ? { 'aria-label': accessibility.label } : {}),
		...(accessibility.description ? { 'aria-describedby': INTERACTION_DESCRIPTION_ID } : {}),
	};
}
