/**
 * Event emission helpers for QTI components
 */

/**
 * Creates a standardized QTI change event
 * @param responseId - The response identifier
 * @param value - The response value
 * @returns A CustomEvent that can be dispatched
 */
export function createQtiChangeEvent(responseId: string | undefined, value: any): CustomEvent {
	return new CustomEvent('qti-change', {
		detail: {
			responseId,
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
	value: any
): void {
	const event = createQtiChangeEvent(responseId, value);
	element.dispatchEvent(event);
}
