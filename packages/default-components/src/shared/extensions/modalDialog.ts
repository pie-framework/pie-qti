/// <reference lib="dom" />

/**
 * Modal dialog behavior for overlays built from plain DOM (the MathLive editor).
 *
 * Implements the WAI-ARIA APG modal dialog pattern on an element that already
 * carries `role="dialog"`, `aria-modal="true"` and an accessible name: focus
 * moves in on open, Tab and Shift+Tab cycle within the dialog, Escape asks to
 * close, and focus returns to the element that opened it when it is released.
 */

import { isImeComposing } from '@pie-qti/i18n';

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[contenteditable="true"]',
	'math-field',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * UI that an editor inside the dialog renders outside it and that must stay
 * usable (MathLive's virtual keyboard and menus are attached to the document body).
 */
const DEFAULT_ALLOWED_OUTSIDE = '.ML__keyboard, .ui-menu-container, [class^="ML__"]';

export interface ModalDialogOptions {
	/** The element to focus first; defaults to the first focusable element in the dialog. */
	initialFocus?: HTMLElement | null;
	/** Where focus returns on release; defaults to the element focused when the dialog opened. */
	returnFocusTo?: HTMLElement | null;
	/** Escape was pressed (outside IME composition): the owner should close the dialog. */
	onEscape?: () => void;
	/** Elements outside the dialog that may hold focus while it is open (CSS selector). */
	allowFocusOutside?: string;
}

export interface ModalDialogHandle {
	/** Move focus into the dialog (the initial focus target, or the first focusable element). */
	focusInitial(): void;
	/**
	 * Make sure focus is inside the dialog: retry the initial target and, if it
	 * cannot take focus (an editor that never upgraded), focus the next
	 * focusable element, or the dialog itself.
	 */
	ensureFocusInside(): void;
	/** Stop trapping focus and return it to the opener. Safe to call more than once. */
	release(options?: { restoreFocus?: boolean }): void;
}

/** The focusable elements of `container`, in tab order (positive tabindex is not used here). */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(element) => !element.hasAttribute('inert') && !element.closest('[hidden], [inert]'),
	);
}

/** The deepest focused element, looking through open shadow roots. */
function activeElementOf(doc: Document): Element | null {
	let active: Element | null = doc.activeElement;
	while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
	return active;
}

/** Whether `node` is `dialog` or inside it, counting shadow hosts (a math-field's internals). */
function isInside(dialog: HTMLElement, node: EventTarget | null): boolean {
	let current = node instanceof Node ? node : null;
	while (current) {
		if (current === dialog) return true;
		const parent: Node | null = current.parentNode;
		current = parent instanceof ShadowRoot ? parent.host : parent;
	}
	return false;
}

/**
 * Make `dialog` behave as a modal dialog until the returned handle is released.
 * The dialog must already be attached to the document.
 */
export function createModalDialog(dialog: HTMLElement, options: ModalDialogOptions = {}): ModalDialogHandle {
	const doc = dialog.ownerDocument;
	const opener = options.returnFocusTo ?? (activeElementOf(doc) as HTMLElement | null);
	const allowedOutside = options.allowFocusOutside ?? DEFAULT_ALLOWED_OUTSIDE;
	let released = false;

	const focusDialog = () => {
		if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
		dialog.focus();
	};

	const focusInitial = () => {
		const target = options.initialFocus ?? getFocusableElements(dialog)[0];
		if (target) target.focus();
		else focusDialog();
	};

	const ensureFocusInside = () => {
		if (isInside(dialog, activeElementOf(doc))) return;
		focusInitial();
		if (isInside(dialog, activeElementOf(doc))) return;
		const fallback = getFocusableElements(dialog).find((element) => {
			if (element === options.initialFocus) return false;
			element.focus();
			return isInside(dialog, activeElementOf(doc));
		});
		if (!fallback) focusDialog();
	};

	/** A dialog removed from the document by its host stops trapping without being closed. */
	const detached = () => {
		if (dialog.isConnected) return false;
		handle.release({ restoreFocus: false });
		return true;
	};

	// Escape is caught on the way down, before an editor inside (MathLive maps
	// Escape to its LaTeX mode) can claim it: in a modal dialog, Escape closes.
	const handleEscape = (event: KeyboardEvent) => {
		if (detached() || event.key !== 'Escape' || isImeComposing(event)) return;
		event.preventDefault();
		event.stopPropagation();
		options.onEscape?.();
	};

	// Tab is handled on the way up, so an editor that uses Tab itself (to move
	// between placeholders) and prevents the default keeps it.
	const handleTab = (event: KeyboardEvent) => {
		if (detached() || event.key !== 'Tab' || event.defaultPrevented) return;
		const focusable = getFocusableElements(dialog);
		if (focusable.length === 0) {
			event.preventDefault();
			dialog.focus();
			return;
		}
		const first = focusable[0]!;
		const last = focusable[focusable.length - 1]!;
		const active = doc.activeElement;
		if (event.shiftKey && (active === first || !isInside(dialog, active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !isInside(dialog, active))) {
			event.preventDefault();
			first.focus();
		}
	};

	// Focus that escapes by other means (a click on the page behind) comes back.
	const handleFocusIn = (event: FocusEvent) => {
		if (detached()) return;
		const target = event.target;
		if (isInside(dialog, target)) return;
		if (target instanceof Element && target.closest(allowedOutside)) return;
		ensureFocusInside();
	};

	// Listening on the document covers focus that fell to the page body.
	doc.addEventListener('keydown', handleEscape, true);
	doc.addEventListener('keydown', handleTab);
	doc.addEventListener('focusin', handleFocusIn);

	const handle: ModalDialogHandle = {
		focusInitial,
		ensureFocusInside,
		release({ restoreFocus = true } = {}) {
			if (released) return;
			released = true;
			doc.removeEventListener('keydown', handleEscape, true);
			doc.removeEventListener('keydown', handleTab);
			doc.removeEventListener('focusin', handleFocusIn);
			if (restoreFocus && opener?.isConnected) opener.focus();
		},
	};
	return handle;
}
