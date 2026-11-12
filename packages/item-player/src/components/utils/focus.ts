/** The focused element, looking through open shadow roots. */
export function deepActiveElement(root: Document | ShadowRoot): Element | null {
	let active = root.activeElement;
	while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
	return active;
}

/**
 * Focus `target` when it can still take focus, and report whether it did. A disabled, hidden or
 * removed element cannot, nor can the document body stand in for "where the user was".
 */
export function restoreFocus(target: Element | null | undefined): boolean {
	const element = target as HTMLElement | null | undefined;
	if (!element?.isConnected || typeof element.focus !== 'function') return false;
	if (element === element.ownerDocument.body || element === element.ownerDocument.documentElement) return false;
	element.focus({ preventScroll: true });
	return deepActiveElement(element.ownerDocument) === element;
}

/**
 * Move focus to a container that is not otherwise focusable, for as long as it holds focus: it is
 * made programmatically focusable and loses that again on blur, so it never joins the tab order.
 */
export function focusContainer(element: HTMLElement | null | undefined): void {
	if (!element?.isConnected) return;
	if (!element.hasAttribute('tabindex')) {
		element.setAttribute('tabindex', '-1');
		element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
	}
	element.focus({ preventScroll: true });
}

/**
 * Open `dialog` as a modal. `showModal()` places it in the top layer, makes the rest of the page
 * inert and turns Escape into a `cancel` event. Where it is not implemented (jsdom, very old
 * engines) the dialog opens in place instead; the caller still handles Escape and focus.
 */
export function openModalDialog(dialog: HTMLDialogElement): 'modal' | 'non-modal' {
	if (typeof dialog.showModal === 'function') {
		try {
			if (!dialog.open) dialog.showModal();
			return 'modal';
		} catch {
			// Not connected, or already open without being modal.
		}
	}
	dialog.setAttribute('open', '');
	return 'non-modal';
}

export function closeModalDialog(dialog: HTMLDialogElement): void {
	if (!dialog.open) return;
	if (typeof dialog.close === 'function') {
		try {
			dialog.close();
			return;
		} catch {
			// Fall through to removing the attribute.
		}
	}
	dialog.removeAttribute('open');
}
