<script lang="ts">
	import type { ModalFeedback } from '../types';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { typesetAction } from './actions/typesetAction';

	interface Props {
		feedback: ModalFeedback[];
		onClose?: () => void;
		typeset?: (element: HTMLElement) => void;
		i18n?: I18nProvider;
	}

	let { feedback = [], onClose, typeset, i18n }: Props = $props();

	// Show modal if there's feedback
	const hasActiveFeedback = $derived(feedback.length > 0);
	const modalTitleId = 'item-player-modal-feedback-title';
	const firstTitle = $derived(feedback.find((item) => item.title)?.title);

	function handleClose() {
		onClose?.();
	}

	function handleBackdropClick(e: MouseEvent) {
		// Close when clicking the backdrop (outside the modal content)
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}
</script>

{#if hasActiveFeedback}
	<dialog
		open
		class="qti-feedback-modal"
		aria-modal="true"
		aria-labelledby={firstTitle ? modalTitleId : undefined}
		aria-label={firstTitle ? undefined : (i18n?.t('feedback.title') ?? 'Feedback')}
		onclick={handleBackdropClick}
	>
		<div class="qti-feedback-modal-box">
			<!-- Close button -->
			<button
				class="qti-feedback-close-button"
				type="button"
				onclick={handleClose}
				aria-label={i18n?.t('feedback.closeFeedback') ?? 'Close feedback'}
			>
				✕
			</button>

			<!-- Feedback content -->
			{#each feedback as item, index}
				<div class:qti-feedback-item={true} class:qti-feedback-item-bordered={index < feedback.length - 1}>
					{#if item.title}
						<h3 id={index === 0 ? modalTitleId : undefined} class="qti-feedback-title">{item.title}</h3>
					{/if}

					<!-- Render HTML content with MathJax support -->
					{#if typeset}
						<div
							class="qti-feedback-content"
							use:typesetAction={{ typeset }}
						>
							{@html item.content}
						</div>
					{:else}
						<div class="qti-feedback-content">
							{@html item.content}
						</div>
					{/if}
				</div>
			{/each}

			<!-- Action buttons -->
			<div class="qti-feedback-actions">
				<button class="qti-feedback-primary-button" type="button" onclick={handleClose}>
					{i18n?.t('common.continue') ?? 'Continue'}
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
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		cursor: pointer;
	}

	.qti-feedback-close-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 9999px;
		background: transparent;
		border-color: transparent;
	}

	.qti-feedback-close-button:hover {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		border-color: var(--pie-qti-base-300, oklch(95% 0 0));
	}

	.qti-feedback-primary-button {
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 12%, transparent);
	}

	.qti-feedback-close-button:focus-visible,
	.qti-feedback-primary-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, var(--pie-qti-primary, oklch(45% 0.24 277)));
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
