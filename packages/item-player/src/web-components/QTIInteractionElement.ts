/**
 * Standard interface and event types for QTI interaction web components
 *
 * All QTI interaction web components must implement the QTIInteractionElement
 * interface and emit QTIChangeEvent when the user response changes.
 */

import type { BaseInteractionData, InteractionValueMap } from '../interactions/shared/types.js';

export type InteractionResponseValue<TData extends BaseInteractionData = BaseInteractionData> =
	TData extends { type: infer TType }
		? TType extends keyof InteractionValueMap
			? InteractionValueMap[TType]
			: unknown
		: unknown;

/**
 * Standard interface that all QTI interaction web components must implement
 */
export interface QTIInteractionElement<
	TData extends BaseInteractionData = BaseInteractionData,
> extends HTMLElement {
	/** The processed interaction data from the QTI XML */
	interaction: TData;

	/** The current response value (type depends on interaction type) */
	response: InteractionResponseValue<TData> | null;

	/** Whether the interaction is in read-only/disabled mode */
	disabled: boolean;

	/** Optional function to apply math typesetting (e.g., KaTeX, MathJax) */
	typeset?: (element: HTMLElement) => void;
}

/**
 * Detail payload for the qti-change event
 */
export interface QTIChangeEventDetail<TValue = InteractionResponseValue | null> {
	/** The response identifier for this interaction */
	responseId: string;

	/** The new response value */
	value: TValue;

	/** Timestamp when the change occurred */
	timestamp: number;
}

/**
 * Custom event emitted when an interaction's response changes
 *
 * This event bubbles and can cross shadow DOM boundaries, making it
 * easy to listen for changes at the container level.
 *
 * @example
 * ```typescript
 * element.addEventListener('qti-change', (event: QTIChangeEvent) => {
 *   console.log('Response changed:', event.detail.responseId, event.detail.value);
 * });
 * ```
 */
export class QTIChangeEvent<TValue = InteractionResponseValue | null> extends CustomEvent<QTIChangeEventDetail<TValue>> {
	constructor(detail: QTIChangeEventDetail<TValue>) {
		super('qti-change', {
			detail,
			bubbles: true, // Bubble up through DOM tree
			composed: true, // Cross shadow DOM boundaries
			cancelable: false, // Cannot be prevented
		});
	}
}
