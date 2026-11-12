/**
 * The props every interaction plugin shares.
 *
 * One type, keyed by the interaction's QTI type: the delivered data comes from
 * `InteractionDataMap`, and what the plugin emits — its `onChange` argument and
 * the `qti-change` event's value — from `InteractionValueMap`, so a plugin's
 * emission type can never drift from the documented one. A plugin adds only
 * what is its own.
 *
 * Types only: which props a plugin (and its custom element) actually exposes is
 * decided by its `$props()` destructuring, which this does not change.
 */

import type { I18nProvider } from '@pie-qti/i18n';
import type { InteractionDataMap, InteractionValueMap } from '@pie-qti/item-player';

/** The QTI interaction types the default plugins render. */
export type InteractionKey = keyof InteractionDataMap & keyof InteractionValueMap;

/**
 * The shared props of an interaction plugin.
 *
 * @typeParam T - the interaction type, e.g. `'choiceInteraction'`
 * @typeParam TResponse - the response a host passes in; defaults to the emitted
 *   value or null. A plugin that also accepts other inbound shapes (a single
 *   string for a list, a record) names its own.
 * @typeParam TCorrect - the correct response a host passes in; defaults to
 *   `TResponse`.
 */
export interface InteractionProps<
	T extends InteractionKey,
	TResponse = InteractionValueMap[T] | null,
	TCorrect = TResponse,
> {
	/** The interaction's delivered data, or its JSON (custom element attribute usage). */
	interaction?: InteractionDataMap[T] | string;
	/** The candidate's response. */
	response?: TResponse;
	/** The correct response, shown in the scorer role. */
	correctResponse?: TCorrect;
	/** While true the interaction renders but takes no input. */
	disabled?: boolean;
	/** The viewing role: `candidate` (the default), or `scorer`, which sees the correct response. */
	role?: string;
	/** Localization provider for the plugin's own messages. */
	i18n?: I18nProvider;
	/** Called with each value the plugin emits: the `qti-change` event's value. */
	onChange?: (value: InteractionValueMap[T]) => void;
}

/**
 * The shared props of an interaction that has no correct response and no
 * scorer view (media, end attempt, upload, drawing, custom, portable custom).
 */
export type ResponseOnlyInteractionProps<
	T extends InteractionKey,
	TResponse = InteractionValueMap[T] | null,
> = Omit<InteractionProps<T, TResponse>, 'correctResponse' | 'role'>;

/** The math-typesetting hook of the interactions that render authored rich content. */
export interface TypesetProps {
	/** Typesets math in an element after its content renders. */
	typeset?: (element: HTMLElement) => void;
}
