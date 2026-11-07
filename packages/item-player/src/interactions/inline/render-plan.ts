import type { InlineChoiceInteractionData, TextEntryInteractionData } from '../shared/types.js';
import { isStandardInlineInteractionType } from '../modules.js';

export type InlineInteractionData = TextEntryInteractionData | InlineChoiceInteractionData;

/**
 * Whether an interaction renders in sentence flow. Inline interactions are rendered by the item
 * player itself, mounted into the slot that marks their authored position in the item body.
 */
export function isInlineInteractionType(type: string): type is InlineInteractionData['type'] {
	return isStandardInlineInteractionType(type);
}
