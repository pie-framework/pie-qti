/// <reference lib="dom" />

/**
 * MathLive Editor Extension for TipTap
 *
 * Integrates MathLive (visual math editor) with TipTap's Mathematics extension.
 * Opens a modal dialog (WAI-ARIA APG pattern: `role="dialog"`, `aria-modal`,
 * named by its title, focus moved in and trapped, Escape cancels, focus
 * returned to the opener) with a labelled MathLive mathfield for LaTeX input.
 *
 * Note: MathLive CSS is loaded dynamically to avoid build issues with package exports.
 */

import type { MathfieldElement } from 'mathlive';
// Import MathLive CSS from the local package
import 'mathlive/static.css';
import { createModalDialog, getFocusableElements } from './modalDialog.js';

// Dynamically import MathLive to register the custom element
let mathLiveLoaded: Promise<void> | null = null;

async function ensureMathLiveLoaded(): Promise<void> {
	if (!mathLiveLoaded && typeof window !== 'undefined') {
		mathLiveLoaded = (async () => {
			// Import MathLive to register the <math-field> custom element
			// CSS is already imported at the top of this file
			await import('mathlive');
		})();
	}
	return mathLiveLoaded || Promise.resolve();
}

/**
 * The translation surface the editor uses; an `I18nProvider` satisfies it, and
 * so does the earlier `{ t(key) }` shape.
 */
export interface MathLiveEditorI18n {
	t: (key: string, fallback?: string, values?: Record<string, unknown>) => string | undefined;
}

export interface MathLiveEditorOptions {
	/** Called when user confirms the LaTeX input */
	onConfirm: (latex: string) => void;
	/** Called when user cancels */
	onCancel: () => void;
	/** Initial LaTeX value */
	initialLatex?: string;
	/** Whether this is inline or block math */
	isBlock?: boolean;
	/**
	 * Whether the dialog inserts new math or edits existing math: it sets the
	 * title and the confirm button. Defaults to `edit` when `initialLatex` is set.
	 */
	mode?: 'insert' | 'edit';
	/**
	 * The control that opened the dialog, where focus returns when it closes.
	 * Defaults to the element focused when the dialog was requested.
	 */
	returnFocusTo?: HTMLElement | null;
	/** Optional i18n provider for translations */
	i18n?: MathLiveEditorI18n;
}

/** The candidate-visible strings, from `interactions.mathInput` (and `common.cancel`). */
function createTranslator(i18n: MathLiveEditorI18n | undefined) {
	return (key: string, fallback: string): string => {
		const translated = i18n?.t(key, fallback);
		return translated && translated !== key ? translated : fallback;
	};
}

let dialogCount = 0;

/** Dialog styles that must hold without the host's DaisyUI/Tailwind classes. */
const DIALOG_STYLES = `
	/* Keep MathLive's virtual keyboard above the modal. Its container spans the
	   whole viewport and must keep MathLive's own pointer-events: none (only the
	   keyboard panel takes clicks), or it would block the dialog's buttons. */
	.ML__keyboard {
		z-index: 10001 !important;
	}
	/* Hide the built-in keyboard toggle button in the mathfield - try multiple selectors */
	.ML__virtual-keyboard-toggle,
	.ML__keyboard-toggle,
	math-field::part(virtual-keyboard-toggle) {
		display: none !important;
		visibility: hidden !important;
		opacity: 0 !important;
		pointer-events: none !important;
	}
	.pie-qti-math-dialog {
		box-sizing: border-box;
		inline-size: min(42rem, calc(100vw - 2rem));
		/* Of the backdrop's content box, which excludes an open virtual keyboard. */
		max-block-size: calc(100% - 2rem);
		overflow: auto;
		padding: 1.5rem;
		border-radius: 0.75rem;
		background: var(--pie-qti-base-100, #ffffff);
		color: var(--pie-qti-base-content, #1f2937);
		position: relative;
		z-index: 10000;
	}
	.pie-qti-math-dialog-title {
		margin-block: 0 0.5rem;
		font-size: 1.125rem;
		font-weight: 700;
	}
	.pie-qti-math-dialog-instructions {
		margin-block: 0 1rem;
	}
	.pie-qti-math-dialog-field-label {
		display: block;
		margin-block-end: 0.5rem;
		font-weight: 600;
	}
	.pie-qti-math-dialog math-field {
		display: block;
		box-sizing: border-box;
		inline-size: 100%;
		min-block-size: 100px;
		padding: 0.75rem;
		font-size: 1.125rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
	}
	.pie-qti-math-dialog math-field:focus-within {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.pie-qti-math-dialog-source-label {
		margin-block: 1rem 0.25rem;
		font-weight: 600;
	}
	.pie-qti-math-dialog-source {
		display: block;
		margin-block-end: 1rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		word-break: break-all;
	}
	.pie-qti-math-dialog-source[data-empty='true'] {
		font-style: italic;
	}
	.pie-qti-math-dialog-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.pie-qti-math-dialog-actions > div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.pie-qti-math-dialog button {
		box-sizing: border-box;
		min-block-size: 2.75rem;
		min-inline-size: 2.75rem;
		padding-block: 0.5rem;
		padding-inline: 1rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: var(--pie-qti-base-100, #ffffff);
		color: var(--pie-qti-base-content, #1f2937);
		font: inherit;
		cursor: pointer;
	}
	.pie-qti-math-dialog button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.pie-qti-math-dialog button[aria-pressed='true'] {
		font-weight: 700;
		border-width: 2px;
	}
`;

interface VirtualKeyboardHandle {
	visible?: boolean;
	boundingRect?: DOMRect;
	hide?: (options?: { animate?: boolean }) => void;
	addEventListener?: (type: string, listener: () => void) => void;
	removeEventListener?: (type: string, listener: () => void) => void;
}

function sharedVirtualKeyboard(): VirtualKeyboardHandle | undefined {
	return (globalThis as { mathVirtualKeyboard?: VirtualKeyboardHandle }).mathVirtualKeyboard;
}

/**
 * Hosts dispatch this on `document` when transient UI must close: the assessment shell does on
 * a proctor pause (`detail.reason: 'pause'`), so no dialog stays open, or traps focus, under the
 * pause overlay. The dialog closes through its cancel path, as if the candidate pressed Cancel.
 */
const CLOSE_TRANSIENT_UI_EVENT = 'pie-qti-close-transient-ui';

/**
 * Opens a modal dialog with MathLive editor for LaTeX input.
 * Resolves to a function that closes the dialog without calling either callback.
 */
export async function openMathLiveEditor(options: MathLiveEditorOptions): Promise<() => void> {
	const { onConfirm, onCancel, initialLatex = '', isBlock = false } = options;
	const mode = options.mode ?? (initialLatex ? 'edit' : 'insert');
	const t = createTranslator(options.i18n);
	// Capture the opener before loading MathLive, while it still holds focus.
	const opener = options.returnFocusTo ?? (document.activeElement as HTMLElement | null);

	// Ensure MathLive is loaded and registered before creating the mathfield. A request to
	// close transient UI while it loads cancels the dialog before it ever opens.
	let closedWhileLoading = false;
	const cancelWhileLoading = () => {
		closedWhileLoading = true;
	};
	document.addEventListener(CLOSE_TRANSIENT_UI_EVENT, cancelWhileLoading);
	try {
		await ensureMathLiveLoaded();
	} finally {
		document.removeEventListener(CLOSE_TRANSIENT_UI_EVENT, cancelWhileLoading);
	}
	if (closedWhileLoading) {
		onCancel();
		return () => {};
	}

	const id = `pie-qti-math-dialog-${++dialogCount}`;

	// Backdrop - keeps DaisyUI modal classes for hosts that theme them
	const overlay = document.createElement('div');
	overlay.className = 'modal modal-open pie-qti-math-dialog-backdrop';
	overlay.style.cssText = `
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	`;

	// The dialog itself: a named, described modal
	const dialog = document.createElement('div');
	dialog.className = 'modal-box max-w-2xl pie-qti-math-dialog';
	dialog.setAttribute('role', 'dialog');
	dialog.setAttribute('aria-modal', 'true');
	dialog.setAttribute('aria-labelledby', `${id}-title`);
	dialog.setAttribute('aria-describedby', `${id}-instructions`);
	// The dialog lives in the document body, outside the editor's shadow root:
	// carry the opener's writing direction across.
	if (opener?.isConnected && getComputedStyle(opener).direction === 'rtl') dialog.dir = 'rtl';

	const title = document.createElement('h2');
	title.id = `${id}-title`;
	title.className = 'pie-qti-math-dialog-title';
	title.textContent =
		mode === 'edit'
			? isBlock
				? t('interactions.mathInput.editBlockTitle', 'Edit block math')
				: t('interactions.mathInput.editInlineTitle', 'Edit inline math')
			: isBlock
				? t('interactions.mathInput.insertBlockTitle', 'Insert block math')
				: t('interactions.mathInput.insertInlineTitle', 'Insert inline math');

	const instructions = document.createElement('p');
	instructions.id = `${id}-instructions`;
	instructions.className = 'pie-qti-math-dialog-instructions';
	instructions.textContent = t(
		'interactions.mathInput.instructions',
		'Type the expression, or open the math keyboard. Press Escape to cancel.',
	);

	// The mathfield's label: associated both ways MathLive resolves a name
	const fieldLabel = document.createElement('label');
	fieldLabel.id = `${id}-field-label`;
	fieldLabel.htmlFor = `${id}-field`;
	fieldLabel.className = 'pie-qti-math-dialog-field-label';
	fieldLabel.textContent = t('interactions.mathInput.fieldLabel', 'Math expression');

	const mathfield = document.createElement('math-field') as MathfieldElement;
	mathfield.id = `${id}-field`;
	mathfield.setAttribute('aria-labelledby', fieldLabel.id);
	mathfield.value = initialLatex;

	// Set MathLive options for better UX via attributes
	// Use 'manual' mode so keyboard only shows when explicitly requested
	mathfield.setAttribute('virtual-keyboard-mode', 'manual');
	mathfield.setAttribute('smart-mode', 'on');
	// Explicitly enable virtual keyboard
	mathfield.setAttribute('use-shared-virtual-keyboard', 'true');
	// Hide the built-in virtual keyboard toggle
	mathfield.setAttribute('virtual-keyboard-toggle-glyph', '');

	// Inject CSS: virtual keyboard layering and the dialog's own fallback styles
	const style = document.createElement('style');
	style.textContent = DIALOG_STYLES;
	document.head.appendChild(style);

	// LaTeX source preview: a visual aid; the mathfield itself is what assistive technology reads
	const sourceLabel = document.createElement('p');
	sourceLabel.className = 'pie-qti-math-dialog-source-label';
	sourceLabel.textContent = t('interactions.mathInput.latexSourceLabel', 'LaTeX source');

	const latexPreview = document.createElement('code');
	latexPreview.className = 'pie-qti-math-dialog-source';
	const latexEmpty = t('interactions.mathInput.latexEmpty', 'LaTeX will appear here');
	const showLatex = (latex: string) => {
		latexPreview.textContent = latex || latexEmpty;
		latexPreview.dataset.empty = latex ? 'false' : 'true';
	};
	showLatex(initialLatex);

	// Update preview when mathfield changes
	mathfield.addEventListener('input', () => showLatex(mathfield.value));

	// Actions: keyboard toggle on one side, cancel/confirm on the other
	const actions = document.createElement('div');
	actions.className = 'modal-action pie-qti-math-dialog-actions';

	const leftActions = document.createElement('div');
	const rightActions = document.createElement('div');

	const keyboardButton = document.createElement('button');
	keyboardButton.type = 'button';
	keyboardButton.className = 'btn btn-sm btn-outline';
	keyboardButton.textContent = t('interactions.mathInput.toggleKeyboard', 'Math keyboard');
	const syncKeyboardState = () => {
		const keyboard = sharedVirtualKeyboard();
		keyboardButton.setAttribute('aria-pressed', keyboard?.visible ? 'true' : 'false');
		// The virtual keyboard docks over the bottom of the page, above this dialog:
		// reserve its height so the dialog (and the focused control) stays visible.
		const height = keyboard?.visible ? (keyboard.boundingRect?.height ?? 0) : 0;
		overlay.style.paddingBlockEnd = height > 0 ? `${Math.ceil(height)}px` : '';
	};
	syncKeyboardState();
	keyboardButton.addEventListener('click', () => {
		if (mathfield.executeCommand) {
			mathfield.executeCommand('toggleVirtualKeyboard');
		}
		syncKeyboardState();
	});
	sharedVirtualKeyboard()?.addEventListener?.('virtual-keyboard-toggle', syncKeyboardState);
	sharedVirtualKeyboard()?.addEventListener?.('geometrychange', syncKeyboardState);

	const cancelButton = document.createElement('button');
	cancelButton.type = 'button';
	cancelButton.className = 'btn btn-ghost';
	cancelButton.textContent = t('common.cancel', 'Cancel');

	const confirmButton = document.createElement('button');
	confirmButton.type = 'button';
	confirmButton.className = 'btn btn-primary';
	confirmButton.textContent =
		mode === 'edit'
			? t('interactions.mathInput.update', 'Update')
			: t('interactions.mathInput.insert', 'Insert');

	leftActions.appendChild(keyboardButton);
	rightActions.appendChild(cancelButton);
	rightActions.appendChild(confirmButton);
	actions.appendChild(leftActions);
	actions.appendChild(rightActions);

	dialog.appendChild(title);
	dialog.appendChild(instructions);
	dialog.appendChild(fieldLabel);
	dialog.appendChild(mathfield);
	dialog.appendChild(sourceLabel);
	dialog.appendChild(latexPreview);
	dialog.appendChild(actions);
	overlay.appendChild(dialog);

	const previousOverflow = document.body.style.overflow;
	let closed = false;
	let focusTimer: ReturnType<typeof setTimeout> | undefined;

	// Add to DOM, then make it modal
	document.body.appendChild(overlay);
	// Prevent body scroll when modal is open
	document.body.style.overflow = 'hidden';

	const modal = createModalDialog(dialog, {
		initialFocus: mathfield,
		returnFocusTo: opener,
		onEscape: () => close(false),
	});

	// MathLive reports when an arrow/Tab key has nowhere to go inside the field
	// (`move-out`): wrap focus to the dialog's controls instead of staying stuck.
	// The dialog's own Tab handler only covers keys MathLive did not claim, so
	// this is what makes forward wrapping work from the field.
	const handleMoveOut = (event: Event) => {
		if (closed) return;
		const direction = (event as CustomEvent<{ direction?: string }>).detail?.direction;
		const focusable = getFocusableElements(dialog);
		if (focusable.length === 0) return;
		if (direction === 'backward') focusable[focusable.length - 1]!.focus();
		else if (direction === 'forward') focusable[0]!.focus();
	};
	mathfield.addEventListener('move-out', handleMoveOut);

	// MathLive claims Tab/Shift+Tab for placeholder navigation and prevents default
	// even at the field's boundary — including empty fields, where it dispatches no
	// `move-out` — so the dialog's Tab trap never sees those keys and backward
	// navigation is dead. Interaction model for this dialog: Tab keeps MathLive's
	// placeholder navigation (forward wrapping via `move-out`); Shift+Tab always
	// leaves the field backward. Reverse placeholder traversal stays on the arrow
	// keys, which MathLive exits correctly via `move-out`.
	const handleFieldShiftTabCapture = (event: KeyboardEvent) => {
		if (closed || event.key !== 'Tab' || !event.shiftKey) return;
		if (!event.composedPath().includes(mathfield)) return;
		event.preventDefault();
		event.stopPropagation();
		const focusable = getFocusableElements(dialog);
		if (focusable.length === 0) return;
		focusable[focusable.length - 1]!.focus();
	};
	document.addEventListener('keydown', handleFieldShiftTabCapture, true);

	function teardown() {
		closed = true;
		if (focusTimer !== undefined) clearTimeout(focusTimer);
		mathfield.removeEventListener('move-out', handleMoveOut);
		document.removeEventListener('keydown', handleFieldShiftTabCapture, true);
		document.removeEventListener(CLOSE_TRANSIENT_UI_EVENT, handleCloseTransientUi);
		cancelButton.removeEventListener('click', handleCancel);
		confirmButton.removeEventListener('click', handleConfirm);
		overlay.removeEventListener('click', handleOverlayClick);
		sharedVirtualKeyboard()?.removeEventListener?.('virtual-keyboard-toggle', syncKeyboardState);
		sharedVirtualKeyboard()?.removeEventListener?.('geometrychange', syncKeyboardState);

		// Hide the shared virtual keyboard through its own API: the mathfield's
		// `hideVirtualKeyboard` command would refocus the field and schedule an
		// update that runs after the field is gone.
		const keyboard = sharedVirtualKeyboard();
		if (keyboard?.visible) keyboard.hide?.();

		// Remove DOM elements
		overlay.remove();
		style.remove();

		// Restore body scroll
		document.body.style.overflow = previousOverflow;

		// Return focus to the control that opened the dialog
		modal.release();
	}

	function close(confirmed: boolean) {
		if (closed) return;
		const latex = mathfield.value;
		teardown();
		if (confirmed) onConfirm(latex);
		else onCancel();
	}

	const handleCancel = () => close(false);
	const handleConfirm = () => close(true);
	// A host closing transient UI (a proctor pause) cancels: the focus trap is released and
	// focus returns to the opener, so the host's own overlay can take it.
	const handleCloseTransientUi = () => close(false);

	const handleOverlayClick = (e: MouseEvent) => {
		// Only a click on the backdrop itself closes; never one on the dialog or the
		// virtual keyboard, which MathLive attaches outside it.
		if (e.target === overlay && !document.querySelector('.ML__keyboard')) {
			close(false);
		}
	};

	cancelButton.addEventListener('click', handleCancel);
	confirmButton.addEventListener('click', handleConfirm);
	overlay.addEventListener('click', handleOverlayClick);
	document.addEventListener(CLOSE_TRANSIENT_UI_EVENT, handleCloseTransientUi);

	// Focus the mathfield (but don't auto-show keyboard)
	modal.focusInitial();
	focusTimer = setTimeout(() => {
		if (closed) return;
		// MathLive moves focus into the field after a short delay of its own; if the
		// field still has no focus by now, it never will (e.g. MathLive failed to
		// load), so focus goes to the next control in the dialog instead.
		modal.ensureFocusInside();
		// Try to programmatically disable the built-in toggle via options
		try {
			(mathfield as unknown as { setOptions?: (options: Record<string, unknown>) => void }).setOptions?.({
				virtualKeyboardToggleGlyph: '',
			});
		} catch {
			// Silently ignore if this API doesn't exist
		}
	}, 100);

	// Closing from outside calls neither callback.
	return () => {
		if (!closed) teardown();
	};
}
