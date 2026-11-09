import { extendedTextResponseToStrings } from '../extended-text/response.js';
import type { TextEntryInteractionData } from '../shared/types.js';

/**
 * The response a textEntryInteraction's `stringIdentifier` names (QTI ASI §5.122.3,
 * `string-identifier` in QTI 3.0), or undefined when none is authored or it repeats the
 * interaction's own response: the companion cannot be the response it captures text for.
 */
export function textEntryStringIdentifier(
	interaction: Pick<TextEntryInteractionData, 'responseId' | 'stringIdentifier'>,
): string | undefined {
	const { stringIdentifier } = interaction;
	return stringIdentifier && stringIdentifier !== interaction.responseId ? stringIdentifier : undefined;
}

/**
 * The value of the companion response `stringIdentifier` names: the text the candidate entered,
 * before a numeric response reads it — "3.50" where the float response is 3.5, "101" where a
 * base-2 integer response is 5 — or NULL when the field is empty. A value that already is a
 * number (written by a host, not typed) is spelled in the interaction's base, as
 * extendedTextInteraction shows one.
 */
export function createTextEntryStringResponse(
	value: unknown,
	interaction: Pick<TextEntryInteractionData, 'base'>,
): string | null {
	const [text = ''] = extendedTextResponseToStrings(value, {
		cardinality: 'single',
		base: interaction.base ?? 10,
	});
	return text.trim().length > 0 ? text : null;
}
