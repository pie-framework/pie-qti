/**
 * The one rule family for the shell dialogs' action buttons
 * (`.submit-dialog-action`).
 *
 * The submit confirmation, the resume prompt and the leave-part warning render
 * their actions into `AssessmentDialog`'s actions area through snippets, so the
 * buttons stay in those dialogs' templates while one family here styles them
 * all: a light-DOM injection, once per document, after the idiom of
 * default-components' `shared/styles/srOnly.ts`. Every declaration lives here —
 * a dialog needing a variant adds its hook below, never as a private copy of
 * the declarations.
 *
 * The class also stays the theme hook: hosts and the component tests target
 * `submit-dialog-action`, never an injected rule's internals.
 */

/** The shared class any dialog action button carries. */
export const SUBMIT_DIALOG_ACTION_CLASS = 'submit-dialog-action';

/** The rule text, injected verbatim into the document. */
export const SUBMIT_DIALOG_ACTION_RULE = `.${SUBMIT_DIALOG_ACTION_CLASS} {
	box-sizing: border-box;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
	min-block-size: var(--pie-qti-control-min-size, 2.75rem);
	padding-block: var(--pie-qti-space-2, 0.5rem);
	padding-inline: var(--pie-qti-space-4, 1rem);
	border: 1px solid var(--pie-qti-border-strong, #767676);
	border-radius: var(--pie-qti-radius, 0.5rem);
	background: var(--pie-qti-base-100, oklch(100% 0 0));
	color: var(--pie-qti-base-content, oklch(21% 0 0));
	font: inherit;
	font-weight: 600;
	line-height: 1.25;
	text-align: center;
	cursor: pointer;
}

.${SUBMIT_DIALOG_ACTION_CLASS}:hover:not([aria-disabled='true']) {
	background: var(--pie-qti-base-200, oklch(98% 0 0));
}

.${SUBMIT_DIALOG_ACTION_CLASS}:focus-visible {
	outline: 2px solid var(--pie-qti-focus, #4338ca);
	outline-offset: 2px;
}

.${SUBMIT_DIALOG_ACTION_CLASS}[aria-disabled='true'] {
	cursor: not-allowed;
	opacity: 0.6;
}

.${SUBMIT_DIALOG_ACTION_CLASS}.primary {
	border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
	background: var(--pie-qti-primary, oklch(45% 0.24 277));
	color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
}

.${SUBMIT_DIALOG_ACTION_CLASS}.primary:hover:not([aria-disabled='true']) {
	background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
}

.${SUBMIT_DIALOG_ACTION_CLASS}.danger {
	border-color: var(--pie-qti-error-text, #b91c1c);
	background: var(--pie-qti-error-text, #b91c1c);
	color: oklch(98% 0.01 277);
}

.${SUBMIT_DIALOG_ACTION_CLASS}.danger:hover:not([aria-disabled='true']) {
	background: color-mix(in oklab, var(--pie-qti-error-text, #b91c1c) 85%, black);
}`;

const STYLE_ATTRIBUTE = 'data-submit-dialog-action-source';
const STYLE_SOURCE = 'pie-qti';

/**
 * Inject the rule into the document once. Safe to call repeatedly (the dialogs
 * call it from their module scripts): later calls are no-ops when the rule is
 * already present.
 */
export function ensureSubmitDialogActionStyles(): void {
	if (typeof document === 'undefined') return;
	if (document.querySelector(`style[${STYLE_ATTRIBUTE}="${STYLE_SOURCE}"]`)) return;
	const style = document.createElement('style');
	style.setAttribute(STYLE_ATTRIBUTE, STYLE_SOURCE);
	style.textContent = SUBMIT_DIALOG_ACTION_RULE;
	document.head.appendChild(style);
}
