import type { InlineChoiceInteractionData } from '../inline-choice/types.js';
import type { TextEntryInteractionData } from '../text-entry/types.js';
import type { InteractionData } from '../shared/types.js';
import {
	isStandardInlineInteractionTagName,
	isStandardInlineInteractionType,
} from '../modules.js';

export type InlineInteractionData = TextEntryInteractionData | InlineChoiceInteractionData;

export type InlineRenderSegment =
	| { type: 'html'; content: string }
	| { type: 'textEntry'; interaction: TextEntryInteractionData }
	| { type: 'inlineChoice'; interaction: InlineChoiceInteractionData };

export function isInlineInteractionType(type: string): type is InlineInteractionData['type'] {
	return isStandardInlineInteractionType(type);
}

export function isInlineInteractionTagName(tagName: string): boolean {
	return isStandardInlineInteractionTagName(tagName);
}

export function createInlinePlaceholderHtml(html: string, interactions: InteractionData[]): string {
	return html
		.replace(
			/<textEntryInteraction[^>]*responseIdentifier="([^"]+)"[^>]*?(?:\/>|><\/textEntryInteraction>)/gi,
			(match, responseId: string) =>
				hasInlineInteraction(interactions, responseId, 'textEntryInteraction')
					? placeholder('textEntry', responseId)
					: match
		)
		.replace(
			/<qti-text-entry-interaction[^>]*response-identifier="([^"]+)"[^>]*?(?:\/>|><\/qti-text-entry-interaction>)/gi,
			(match, responseId: string) =>
				hasInlineInteraction(interactions, responseId, 'textEntryInteraction')
					? placeholder('textEntry', responseId)
					: match
		)
		.replace(
			/<inlineChoiceInteraction[^>]*responseIdentifier="([^"]+)"[^>]*>[\s\S]*?<\/inlineChoiceInteraction>/gi,
			(match, responseId: string) =>
				hasInlineInteraction(interactions, responseId, 'inlineChoiceInteraction')
					? placeholder('inlineChoice', responseId)
					: match
		)
		.replace(
			/<qti-inline-choice-interaction[^>]*response-identifier="([^"]+)"[^>]*>[\s\S]*?<\/qti-inline-choice-interaction>/gi,
			(match, responseId: string) =>
				hasInlineInteraction(interactions, responseId, 'inlineChoiceInteraction')
					? placeholder('inlineChoice', responseId)
					: match
		);
}

export function createInlineRenderPlan(html: string, interactions: InteractionData[]): InlineRenderSegment[] {
	const placeholderHtml = createInlinePlaceholderHtml(html, interactions);
	const result: InlineRenderSegment[] = [];
	const combinedPattern = /\[TEXTENTRY:([^\]]+)\]|\[INLINECHOICE:([^\]]+)\]/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = combinedPattern.exec(placeholderHtml)) !== null) {
		if (match.index > lastIndex) {
			result.push({ type: 'html', content: placeholderHtml.substring(lastIndex, match.index) });
		}

		if (match[0].startsWith('[TEXTENTRY:')) {
			const interaction = findInlineInteraction(interactions, match[1], 'textEntryInteraction');
			if (interaction) result.push({ type: 'textEntry', interaction });
		} else {
			const interaction = findInlineInteraction(interactions, match[2], 'inlineChoiceInteraction');
			if (interaction) result.push({ type: 'inlineChoice', interaction });
		}

		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < placeholderHtml.length) {
		result.push({ type: 'html', content: placeholderHtml.substring(lastIndex) });
	}

	return result.length > 0 ? result : [{ type: 'html', content: placeholderHtml }];
}

function placeholder(kind: 'textEntry' | 'inlineChoice', responseId: string): string {
	return kind === 'textEntry' ? `[TEXTENTRY:${responseId}]` : `[INLINECHOICE:${responseId}]`;
}

function hasInlineInteraction(
	interactions: InteractionData[],
	responseId: string,
	type: InlineInteractionData['type']
): boolean {
	return Boolean(findInlineInteraction(interactions, responseId, type));
}

function findInlineInteraction<T extends InlineInteractionData['type']>(
	interactions: InteractionData[],
	responseId: string,
	type: T
): Extract<InlineInteractionData, { type: T }> | null {
	return (interactions.find((interaction) => interaction.responseId === responseId && interaction.type === type) ??
		null) as Extract<InlineInteractionData, { type: T }> | null;
}
