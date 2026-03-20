import type { QTIChangeEventDetail } from '@pie-qti/item-player/web-components';

/**
 * Event emission helpers for QTI components
 */

/**
 * Creates a standardized QTI change event
 * @param responseId - The response identifier
 * @param value - The response value
 * @returns A CustomEvent that can be dispatched
 */
function requireResponseId(responseId: string | undefined): string {
	if (!responseId || responseId.trim().length === 0) {
		throw new Error('qti-change event requires a non-empty responseId');
	}
	return responseId;
}

export function createQtiChangeEvent(responseId: string | undefined, value: unknown): CustomEvent<QTIChangeEventDetail> {
	return new CustomEvent('qti-change', {
		detail: {
			responseId: requireResponseId(responseId),
			value,
			timestamp: Date.now(),
		},
		bubbles: true,
		composed: true,
	});
}

/**
 * Emits a QTI change event from an element
 * @param element - The element to dispatch from (usually component root)
 * @param responseId - The response identifier
 * @param value - The response value
 */
export function emitQtiChange(
	element: HTMLElement | EventTarget,
	responseId: string | undefined,
	value: unknown
): void {
	const event = createQtiChangeEvent(responseId, value);
	element.dispatchEvent(event);
}
