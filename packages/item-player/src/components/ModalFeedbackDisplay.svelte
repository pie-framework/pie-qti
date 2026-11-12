<script lang="ts">
	import type { ModalFeedback } from '../types';
	import { contentLanguageAttributes, translate, type I18nProvider } from '@pie-qti/i18n';
	import { typesetAction } from './actions/typesetAction';
	import {
		closeModalDialog,
		deepActiveElement,
		focusContainer,
		openModalDialog,
		restoreFocus,
	} from './utils/focus';

	interface Props {
		feedback: ModalFeedback[];
		onClose?: () => void;
		typeset?: (element: HTMLElement) => void;
		i18n?: I18nProvider;
		/** The item's declared language, which the authored title and content are in. */
		contentLanguage?: string;
	}

	let { feedback = [], onClose, typeset, i18n, contentLanguage }: Props = $props();
	const contentAttributes = $derived(contentLanguageAttributes(contentLanguage));

	// Show modal if there's feedback
	const hasActiveFeedback = $derived(feedback.length > 0);
	const uid = $props.id();
	const modalTitleId = `${uid}-title`;
	const titleIndex = $derived(feedback.findIndex((item) => item.title));

	let dialogEl: HTMLDialogElement | null = $state(null);
	let pointerDownOnBackdrop = false;

	// A real modal: showModal() makes the rest of the page inert, focus moves into the dialog,
	// and when the dialog goes focus returns to where it was before it opened.
	$effect(() => {
		const dialog = dialogEl;
		if (!dialog) return;
		const returnTo = deepActiveElement(dialog.ownerDocument);
		const fallback = dialog.parentElement;
		openModalDialog(dialog);
		// Focus the title (or, without one, the content) so a screen reader starts reading the
		// feedback from its top; it is focusable only while it holds focus.
		focusContainer(dialog.querySelector<HTMLElement>('[data-initial-focus]'));
		return () => {
			if (dialog.isConnected) closeModalDialog(dialog);
			// The control that opened the dialog may be gone or disabled by now (a submit button
			// once the attempt has ended); focus then goes to the player rather than the page.
			if (!restoreFocus(returnTo)) focusContainer(fallback);
		};
	});

	function handleClose() {
		onClose?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		// Handled here for the non-modal fallback too; cancelling stops the native close request.
		event.preventDefault();
		handleClose();
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		handleClose();
	}

	function handlePointerDown(event: PointerEvent) {
		pointerDownOnBackdrop = event.target === event.currentTarget;
	}

	function handleBackdropClick(event: MouseEvent) {
		// Close only for a click that started and ended outside the box, not a text selection
		// dragged out of it.
		const onBackdrop = pointerDownOnBackdrop && event.target === event.currentTarget;
		pointerDownOnBackdrop = false;
		if (onBackdrop) handleClose();
	}
</script>

{#if hasActiveFeedback}
	<dialog
		bind:this={dialogEl}
		class="qti-feedback-modal"
		aria-labelledby={titleIndex >= 0 ? modalTitleId : undefined}
		aria-label={titleIndex >= 0 ? undefined : translate(i18n, 'feedback.title', 'Feedback')}
		oncancel={handleCancel}
		onclose={handleClose}
		onkeydown={handleKeydown}
		onpointerdown={handlePointerDown}
		onclick={handleBackdropClick}
	>
		<div class="qti-feedback-modal-box">
			<!-- Close button -->
			<button
				class="qti-feedback-close-button"
				type="button"
				onclick={handleClose}
				aria-label={translate(i18n, 'feedback.closeFeedback', 'Dismiss feedback')}
			>
				<span aria-hidden="true">✕</span>
			</button>

			<!-- Feedback content -->
			{#each feedback as item, index}
				<div
					class:qti-feedback-item={true}
					class:qti-feedback-item-bordered={index < feedback.length - 1}
					lang={contentAttributes?.lang}
					dir={contentAttributes?.dir}
				>
					{#if item.title}
						<h3
							id={index === titleIndex ? modalTitleId : undefined}
							class="qti-feedback-title"
							data-initial-focus={index === titleIndex ? '' : undefined}
						>
							{item.title}
						</h3>
					{/if}

					<!-- Render HTML content with MathJax support -->
					<div
						class="qti-feedback-content"
						data-initial-focus={titleIndex < 0 && index === 0 ? '' : undefined}
						use:typesetAction={{ typeset }}
					>
						{@html item.content}
					</div>
				</div>
			{/each}

			<!-- Action buttons -->
			<div class="qti-feedback-actions">
				<button class="qti-feedback-primary-button" type="button" onclick={handleClose}>
					{translate(i18n, 'common.continue', 'Continue')}
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.qti-feedback-modal {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background-color: rgba(0, 0, 0, 0.5);
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	/* The dialog itself is the full-viewport scrim; its native backdrop stays transparent. */
	.qti-feedback-modal::backdrop {
		background: transparent;
	}

	.qti-feedback-modal[open] {
		display: grid;
		place-items: center;
	}

	.qti-feedback-modal-box {
		position: relative;
		box-sizing: border-box;
		width: min(48rem, calc(100vw - 2rem));
		max-height: 80vh;
		overflow-y: auto;
		padding: 1.5rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 1rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		box-shadow: 0 20px 45px rgba(0, 0, 0, 0.2);
	}

	.qti-feedback-close-button,
	.qti-feedback-primary-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		cursor: pointer;
	}

	.qti-feedback-close-button {
		position: absolute;
		top: 0.5rem;
		inset-inline-end: 0.5rem;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		border-radius: 9999px;
		background: transparent;
		border-color: transparent;
	}

	.qti-feedback-close-button:hover {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		border-color: var(--pie-qti-border-strong, #767676);
	}

	.qti-feedback-primary-button {
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border-radius: 0.75rem;
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 12%, transparent);
	}

	.qti-feedback-close-button:focus-visible,
	.qti-feedback-primary-button:focus-visible,
	.qti-feedback-title:focus-visible,
	.qti-feedback-content:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.qti-feedback-item {
		margin-bottom: 1rem;
	}

	.qti-feedback-item-bordered {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
	}

	.qti-feedback-title {
		margin: 0 0 0.5rem;
		/* Keep the title clear of the close button. */
		padding-inline-end: 2.5rem;
		font-size: 1.125rem;
		font-weight: 700;
	}

	.qti-feedback-content {
		max-width: none;
	}

	.qti-feedback-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 1rem;
	}
</style>
