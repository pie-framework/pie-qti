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

type TypedQtiChangeEventDetail<TValue> = Omit<QTIChangeEventDetail, 'value'> & {
	value: TValue;
};

export function createQtiChangeEvent<TValue = unknown>(
	responseId: string | undefined,
	value: TValue
): CustomEvent<TypedQtiChangeEventDetail<TValue>> {
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

export function emitInteractionChange<TValue>({
	target,
	responseId,
	value,
	onChange,
}: {
	target: HTMLElement | EventTarget | undefined;
	responseId: string | undefined;
	value: TValue;
	onChange?: (value: TValue) => void;
}): void {
	onChange?.(value);
	if (target) {
		emitQtiChange(target, responseId, value);
	}
}
