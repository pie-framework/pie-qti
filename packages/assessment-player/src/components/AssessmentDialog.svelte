<script lang="ts" module>
	export type AssessmentDialogCloseReason = 'confirm' | 'cancel';
</script>

<script lang="ts">
	/**
	 * Accessible modal dialog for the assessment shell: submit confirmation, time
	 * notices, resume prompts.
	 *
	 * - Native `<dialog>` + `showModal()`: the page behind is inert and the dialog
	 *   sits in the top layer. Where `showModal()` is missing (jsdom, very old
	 *   engines) it opens with the `open` attribute, traps Tab and handles Escape
	 *   itself.
	 * - Named by its title (`aria-labelledby`), described by `description`.
	 * - On open, focus moves to the title (default) or an action; on close it
	 *   returns to the element that had it when the dialog opened.
	 * - Escape cancels unless `dismissible` is false; actions are ≥ 44px targets
	 *   that stay focusable (`aria-disabled`) while `busy`.
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import { onDestroy, untrack, type Snippet } from 'svelte';

	interface Props {
		/** Whether the dialog is shown. Bindable: Escape, Cancel and Confirm set it to false. */
		open?: boolean;
		/** Visible title and accessible name. */
		title: string;
		/** Short text that becomes the accessible description. */
		description?: string;
		/** Confirm action label; defaults to `common.confirm`. */
		confirmLabel?: string;
		/** Cancel action label; defaults to `common.cancel`. */
		cancelLabel?: string;
		/** Render the cancel action. False for acknowledge-only notices. Default true. */
		showCancel?: boolean;
		/** `danger` styles the confirm action as destructive. */
		tone?: 'primary' | 'danger';
		/** Escape (the native cancel request) cancels the dialog. Default true. */
		dismissible?: boolean;
		/** Close as soon as Confirm is chosen. False keeps it open (set `open` yourself). Default true. */
		closeOnConfirm?: boolean;
		/** What receives focus on open. Default `title`. */
		initialFocus?: 'title' | 'cancel' | 'confirm';
		/** Where focus goes on close; defaults to the element focused when the dialog opened. */
		returnFocus?: HTMLElement | null;
		/** Marks the dialog busy and its actions unavailable, e.g. while a submission is in flight. */
		busy?: boolean;
		i18n?: I18nProvider;
		onConfirm?: () => void | Promise<void>;
		onCancel?: () => void;
		/** After the dialog closed, with how it closed. */
		onClose?: (reason: AssessmentDialogCloseReason) => void;
		/** Body content below the title and description. */
		children?: Snippet;
		/** Replaces the default actions; call `close(reason)` to close. */
		actions?: Snippet<[{ close: (reason: AssessmentDialogCloseReason) => void }]>;
	}

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		cancelLabel,
		showCancel = true,
		tone = 'primary',
		dismissible = true,
		closeOnConfirm = true,
		initialFocus = 'title',
		returnFocus = null,
		busy = false,
		i18n,
		onConfirm,
		onCancel,
		onClose,
		children,
		actions,
	}: Props = $props();

	const uid = $props.id();
	const titleId = `${uid}-title`;
	const descriptionId = `${uid}-description`;

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let titleEl = $state<HTMLElement | null>(null);
	let cancelButton = $state<HTMLButtonElement | null>(null);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	/** True when the dialog runs without `showModal()` and emulates modality itself. */
	let usesFallback = $state(false);
	let returnTarget: HTMLElement | null = null;
	/** A confirm handler is still running; further activations are ignored. */
	let confirming = false;

	const confirmText = $derived(confirmLabel ?? i18n?.t('common.confirm') ?? 'Confirm');
	const cancelText = $derived(cancelLabel ?? i18n?.t('common.cancel') ?? 'Cancel');

	/** The focused element, looking through open shadow roots so focus returns to the real trigger. */
	function deepActiveElement(doc: Document): HTMLElement | null {
		let active: Element | null = doc.activeElement;
		while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
		return active instanceof HTMLElement && active !== doc.body ? active : null;
	}

	function isShown(el: HTMLDialogElement): boolean {
		return el.hasAttribute('open');
	}

	function show(el: HTMLDialogElement) {
		if (isShown(el)) return;
		returnTarget = returnFocus ?? deepActiveElement(el.ownerDocument);
		usesFallback = typeof el.showModal !== 'function';
		if (!usesFallback) {
			try {
				el.showModal();
			} catch {
				// Not connected yet, or already open non-modally: emulate.
				usesFallback = true;
			}
		}
		if (usesFallback) el.setAttribute('open', '');
		focusInitial();
	}

	function hide(el: HTMLDialogElement) {
		if (!isShown(el)) return;
		if (!usesFallback && typeof el.close === 'function') el.close();
		else el.removeAttribute('open');
		restoreFocus();
	}

	function focusInitial() {
		const target =
			initialFocus === 'confirm'
				? confirmButton
				: initialFocus === 'cancel'
					? (cancelButton ?? confirmButton)
					: titleEl;
		(target ?? titleEl)?.focus();
	}

	function restoreFocus() {
		const target = returnTarget;
		returnTarget = null;
		if (target?.isConnected) target.focus();
	}

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (open) untrack(() => show(el));
		else untrack(() => hide(el));
	});

	onDestroy(() => {
		// Unmounted while open: focus returns to the trigger, not to the document body.
		if (dialogEl && isShown(dialogEl)) restoreFocus();
	});

	async function requestClose(reason: AssessmentDialogCloseReason) {
		if (!open || busy || confirming) return;
		if (reason === 'confirm') {
			confirming = true;
			try {
				await onConfirm?.();
			} catch (error) {
				// The caller owns the failure; the dialog stays open so the choice can be retried.
				console.error('Assessment dialog confirm handler failed:', error);
				return;
			} finally {
				confirming = false;
			}
			if (!closeOnConfirm) return;
		} else {
			onCancel?.();
		}
		open = false;
		onClose?.(reason);
	}

	/** Close the dialog programmatically. */
	export function close(reason: AssessmentDialogCloseReason = 'cancel') {
		void requestClose(reason);
	}

	function handleCancelEvent(event: Event) {
		// The native close request (Escape). Keep the state in sync instead of letting
		// the browser close the element behind Svelte's back.
		event.preventDefault();
		if (dismissible) void requestClose('cancel');
	}

	function handleCloseEvent() {
		// The browser closed the dialog itself (a repeated Escape may override
		// `preventDefault`): report it as a cancel and return focus.
		if (!open) return;
		restoreFocus();
		onCancel?.();
		open = false;
		onClose?.('cancel');
	}

	function focusableElements(el: HTMLElement): HTMLElement[] {
		return Array.from(
			el.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		).filter((node) => !node.closest('[hidden]'));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!usesFallback || !dialogEl) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			if (dismissible) void requestClose('cancel');
			return;
		}
		if (event.key !== 'Tab') return;
		// Without `showModal()` nothing makes the page inert: keep Tab inside.
		const focusable = focusableElements(dialogEl);
		if (focusable.length === 0) {
			event.preventDefault();
			return;
		}
		const first = focusable[0]!;
		const last = focusable[focusable.length - 1]!;
		const active = deepActiveElement(dialogEl.ownerDocument);
		const inside = active !== null && dialogEl.contains(active);
		if (event.shiftKey && (active === first || !inside)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !inside)) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="assessment-dialog pie-qti-chrome"
	class:fallback={usesFallback}
	aria-labelledby={titleId}
	aria-describedby={description ? descriptionId : undefined}
	aria-modal={usesFallback ? 'true' : undefined}
	aria-busy={busy ? 'true' : undefined}
	oncancel={handleCancelEvent}
	onclose={handleCloseEvent}
	onkeydown={handleKeydown}
>
	<h2 bind:this={titleEl} id={titleId} class="assessment-dialog-title" tabindex="-1">{title}</h2>
	{#if description}
		<p id={descriptionId} class="assessment-dialog-description">{description}</p>
	{/if}
	{#if children}
		<div class="assessment-dialog-body">
			{@render children()}
		</div>
	{/if}
	<div class="assessment-dialog-actions">
		{#if actions}
			{@render actions({ close: (reason) => void requestClose(reason) })}
		{:else}
			{#if showCancel}
				<button
					bind:this={cancelButton}
					type="button"
					class="assessment-dialog-button"
					data-testid="assessment-dialog-cancel"
					aria-disabled={busy ? 'true' : undefined}
					onclick={() => requestClose('cancel')}
				>
					{cancelText}
				</button>
			{/if}
			<button
				bind:this={confirmButton}
				type="button"
				class="assessment-dialog-button"
				class:primary={tone === 'primary'}
				class:danger={tone === 'danger'}
				data-testid="assessment-dialog-confirm"
				aria-disabled={busy ? 'true' : undefined}
				onclick={() => requestClose('confirm')}
			>
				{confirmText}
			</button>
		{/if}
	</div>
</dialog>

<style>
	.assessment-dialog {
		box-sizing: border-box;
		inline-size: min(32rem, calc(100% - 2 * var(--pie-qti-space-4, 1rem)));
		max-block-size: calc(100% - 2 * var(--pie-qti-space-4, 1rem));
		margin: auto;
		padding: var(--pie-qti-space-5, 1.5rem);
		overflow: auto;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		box-shadow: 0 1.25rem 2.75rem rgb(0 0 0 / 0.25);
		overscroll-behavior: contain;
	}

	.assessment-dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	/* Without showModal() there is no top layer: pin the dialog over the page. */
	.assessment-dialog.fallback {
		position: fixed;
		inset: 0;
		z-index: 2147483000;
		block-size: fit-content;
	}

	.assessment-dialog-title {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-size: 1.25em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.assessment-dialog-title:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.assessment-dialog-description {
		margin: 0 0 var(--pie-qti-space-4, 1rem);
	}

	.assessment-dialog-body {
		margin-block-end: var(--pie-qti-space-4, 1rem);
	}

	.assessment-dialog-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--pie-qti-space-3, 0.75rem);
	}

	.assessment-dialog-button {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 1 auto;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-5, 1.5rem);
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

	.assessment-dialog-button:hover:not([aria-disabled='true']) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.assessment-dialog-button.primary {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
	}

	.assessment-dialog-button.primary:hover:not([aria-disabled='true']) {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
	}

	.assessment-dialog-button.danger {
		border-color: var(--pie-qti-error-text, #b91c1c);
		color: var(--pie-qti-error-text, #b91c1c);
	}

	.assessment-dialog-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.assessment-dialog-button[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.6;
	}

	@media (max-width: 30rem) {
		.assessment-dialog {
			padding: var(--pie-qti-space-4, 1rem);
		}

		.assessment-dialog-button {
			flex: 1 1 auto;
		}
	}
</style>
