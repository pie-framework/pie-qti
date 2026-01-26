/**
 * Standard interface and event types for QTI interaction web components
 *
 * All QTI interaction web components must implement the QTIInteractionElement
 * interface and emit QTIChangeEvent when the user response changes.
 */

import type { InteractionData } from '../types/interactions.js';

/**
 * Standard interface that all QTI interaction web components must implement
 */
export interface QTIInteractionElement extends HTMLElement {
	/** The processed interaction data from the QTI XML */
	interaction: InteractionData;

	/** The current response value (type depends on interaction type) */
	response: any;

	/** Whether the interaction is in read-only/disabled mode */
	disabled: boolean;

	/** Optional function to apply math typesetting (e.g., KaTeX, MathJax) */
	typeset?: (element: HTMLElement) => void;
}

/**
 * Detail payload for the qti-change event
 */
export interface QTIChangeEventDetail {
	/** The response identifier for this interaction */
	responseId: string;

	/** The new response value */
	value: any;

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
export class QTIChangeEvent extends CustomEvent<QTIChangeEventDetail> {
	constructor(detail: QTIChangeEventDetail) {
		super('qti-change', {
			detail,
			bubbles: true, // Bubble up through DOM tree
			composed: true, // Cross shadow DOM boundaries
			cancelable: false, // Cannot be prevented
		});
	}
}

/**
 * Event emitted when a component is ready (initialized and rendered)
 */
export class QTIReadyEvent extends CustomEvent<void> {
	constructor() {
		super('qti-ready', {
			bubbles: true,
			composed: true,
			cancelable: false,
		});
	}
}

/**
 * Event emitted when an error occurs in a component
 */
export interface QTIErrorEventDetail {
	/** The error that occurred */
	error: Error;

	/** Context about where the error occurred */
	context: string;
}

export class QTIErrorEvent extends CustomEvent<QTIErrorEventDetail> {
	constructor(detail: QTIErrorEventDetail) {
		super('qti-error', {
			detail,
			bubbles: true,
			composed: true,
			cancelable: false,
		});
	}
}

/**
 * Special event for AssociateInteraction selection state
 * (used for tracking which item is selected for pairing)
 */
export interface QTISelectionChangeEventDetail {
	/** The identifier of the selected item, or null if deselected */
	selected: string | null;
}

export class QTISelectionChangeEvent extends CustomEvent<QTISelectionChangeEventDetail> {
	constructor(detail: QTISelectionChangeEventDetail) {
		super('qti-selection-change', {
			detail,
			bubbles: true,
			composed: true,
			cancelable: false,
		});
	}
}
