import { type HTMLElement as ParsedHtmlElement, NodeType, parse } from 'node-html-parser';
import { readResponseIdentifier } from '../extraction/responseIdentifier.js';
import type { BaseInteractionData } from '../interactions/shared/types.js';

/**
 * The attribute on the empty placeholder that marks where an interaction was authored in the
 * item body. A renderer mounts the interaction into the element carrying it.
 */
export const INTERACTION_SLOT_ATTRIBUTE = 'data-qti-interaction-slot';

/** How a slot lays out: `inline` stays in sentence flow, `block` takes its own line. */
export type InteractionSlotPlacement = 'block' | 'inline';

export interface PlacedInteractionSlots {
	/** The body HTML with each located interaction element replaced by its empty slot. */
	readonly html: string;
	/**
	 * The slot id per index into the interactions, numbered in document order. An interaction
	 * whose element is not in the body has no entry.
	 */
	readonly slots: ReadonlyMap<number, string>;
}

/** Element names of interactions in either QTI spelling: `choiceInteraction`, `qti-choice-interaction`. */
const INTERACTION_TAG = /(?:^[a-z]+interaction$|^qti-[a-z-]+-interaction$)/i;
const POSITION_OBJECT_STAGE = /^(?:positionobjectstage|qti-position-object-stage)$/i;
/** Cheap pre-check: markup without any of these needs no structural pass. */
const NEEDS_SLOT_PASS = /interaction|positionobjectstage|position-object-stage|data-qti-interaction-slot/i;

/**
 * Replace every interaction element in the item body with an empty slot element at the same
 * position, so the interaction renders where it was authored: between paragraphs, after the
 * text that introduces it, inside layout rows and columns, table cells and other containers.
 *
 * An element is matched to the interaction data by its response identifier, in document order.
 * A `positionObjectStage` is replaced as a unit by the slots of the interactions inside it,
 * because its renderer draws the stage background as well. Interaction elements that match no
 * interaction data are hidden rather than shown as raw markup, and authored slot attributes are
 * removed so content cannot redirect where an interaction mounts.
 */
export function placeInteractionSlots(
	html: string,
	interactions: readonly BaseInteractionData[],
	placementOf: (interaction: BaseInteractionData) => InteractionSlotPlacement,
): PlacedInteractionSlots {
	const slots = new Map<number, string>();
	if (!html || !NEEDS_SLOT_PASS.test(html)) return { html, slots };

	const pending = new Map<string, number[]>();
	interactions.forEach((interaction, index) => {
		const queue = pending.get(interaction.responseId);
		if (queue) queue.push(index);
		else pending.set(interaction.responseId, [index]);
	});

	const takeInteraction = (element: ParsedHtmlElement): number | undefined => {
		const responseId = responseIdentifierOf(element);
		return responseId ? pending.get(responseId)?.shift() : undefined;
	};

	const slotMarkup = (index: number): string => {
		const id = String(slots.size);
		slots.set(index, id);
		const placement = placementOf(interactions[index]);
		return `<span class="qti-interaction-slot qti-interaction-slot--${placement}" ${INTERACTION_SLOT_ATTRIBUTE}="${id}"></span>`;
	};

	const collectStageInteractions = (element: ParsedHtmlElement, found: number[]): void => {
		for (const child of elementChildren(element)) {
			const index = takeInteraction(child);
			if (index !== undefined) found.push(index);
			else collectStageInteractions(child, found);
		}
	};

	const visit = (parent: ParsedHtmlElement): void => {
		for (const child of elementChildren(parent)) {
			if (child.hasAttribute(INTERACTION_SLOT_ATTRIBUTE)) {
				child.removeAttribute(INTERACTION_SLOT_ATTRIBUTE);
			}
			const tagName = child.rawTagName ?? '';

			if (POSITION_OBJECT_STAGE.test(tagName)) {
				const found: number[] = [];
				collectStageInteractions(child, found);
				child.replaceWith(found.length > 0 ? found.map(slotMarkup).join('') : hiddenMarkup(child));
				continue;
			}

			const index = takeInteraction(child);
			if (index !== undefined) {
				child.replaceWith(slotMarkup(index));
				continue;
			}

			if (INTERACTION_TAG.test(tagName)) {
				child.replaceWith(hiddenMarkup(child));
				continue;
			}

			visit(child);
		}
	};

	const root = parse(html, { lowerCaseTagName: false, comment: false });
	visit(root as unknown as ParsedHtmlElement);
	return { html: root.toString(), slots };
}

/** Whether the final body markup still carries `slot`, after sanitation has run over it. */
export function hasInteractionSlot(html: string, slot: string): boolean {
	return html.includes(`${INTERACTION_SLOT_ATTRIBUTE}="${slot}"`);
}

function elementChildren(element: ParsedHtmlElement): ParsedHtmlElement[] {
	return (element.childNodes as unknown as ParsedHtmlElement[]).filter(
		(node) => node.nodeType === NodeType.ELEMENT_NODE,
	);
}

/** Slot hiding reads the binding on the HTML tree, without a mapper. */
function responseIdentifierOf(element: ParsedHtmlElement): string | undefined {
	return readResponseIdentifier(element);
}

/**
 * Interaction markup with no interaction data behind it is kept hidden in the body, never shown
 * as raw prompt and choice text.
 */
function hiddenMarkup(element: ParsedHtmlElement): string {
	return `<span class="qti-hidden-interaction">${element.toString()}</span>`;
}
