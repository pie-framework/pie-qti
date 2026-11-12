import type { InteractionAccessibility } from '@pie-qti/item-player';

/**
 * Prefix of the id of the hidden element that carries an interaction's authored description.
 * The full id is unique to one interaction: use `interactionDescriptionId(interaction)`.
 */
export const INTERACTION_DESCRIPTION_ID = 'qti-interaction-description';

/** An interaction whose authored accessibility this module reads. */
export interface DescribedInteraction {
	accessibility?: InteractionAccessibility;
}

/**
 * One description id per interaction object. `interactionAria()` (the `aria-describedby` on the
 * interaction root) and `<InteractionDescription interaction={…}>` (the hidden element it
 * references) both ask for the id of the same parsed interaction object, so they stay in step,
 * while every other interaction on the page — the other interactions of a composite item, or a
 * second rendering of the same item — gets an id of its own, also when several interactions
 * share one DOM tree instead of one shadow root each.
 *
 * Keyed weakly by the object the extractors delivered (or the component parsed from its JSON
 * attribute), so an id lives exactly as long as that object. One object rendered twice in one
 * tree shares its id, which then names the same description text.
 */
const descriptionIds = new WeakMap<object, string>();
let descriptionSequence = 0;

/**
 * The id of the hidden element that holds the interaction's authored description, or `null`
 * when the interaction authors none. A custom component that renders its own description
 * element gives it this id, read from the same interaction object it passes to
 * `interactionAria()`.
 */
export function interactionDescriptionId(interaction: DescribedInteraction | null | undefined): string | null {
	if (!interaction?.accessibility?.description) return null;
	// WeakMap keys must be objects; malformed non-object host data keeps the plain prefix.
	if (typeof interaction !== 'object') return INTERACTION_DESCRIPTION_ID;
	let id = descriptionIds.get(interaction);
	if (!id) {
		descriptionSequence += 1;
		id = `${INTERACTION_DESCRIPTION_ID}-${descriptionSequence}`;
		descriptionIds.set(interaction, id);
	}
	return id;
}

/**
 * Attributes that give an interaction's root its authored accessible name and description:
 * a labelled `group`, or nothing when the interaction carries no authored `aria-*`. The
 * description is the text `InteractionDescription` renders beside them, under the id
 * `interactionDescriptionId()` gives this interaction.
 */
export function interactionAria(
	interaction: DescribedInteraction | null | undefined,
): Record<string, string> {
	const accessibility = interaction?.accessibility;
	if (!accessibility?.label && !accessibility?.description) return {};
	const descriptionId = interactionDescriptionId(interaction);
	return {
		role: 'group',
		...(accessibility.label ? { 'aria-label': accessibility.label } : {}),
		...(descriptionId ? { 'aria-describedby': descriptionId } : {}),
	};
}
