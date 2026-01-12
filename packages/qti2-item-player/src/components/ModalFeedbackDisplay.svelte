<script lang="ts">
	import type { ModalFeedback } from '../types';
	// @ts-expect-error - Svelte-check can't resolve workspace packages, but runtime works correctly
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
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
	<!-- DaisyUI Modal -->
	<dialog class="modal modal-open" onclick={handleBackdropClick}>
		<div class="modal-box max-w-3xl">
			<!-- Close button -->
			<button
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				onclick={handleClose}
				aria-label={i18n?.t('feedback.closeFeedback') ?? 'feedback.closeFeedback'}
			>
				✕
			</button>

			<!-- Feedback content -->
			{#each feedback as item, index}
				<div class="mb-4 {index < feedback.length - 1 ? 'border-b pb-4' : ''}">
					{#if item.title}
						<h3 class="font-bold text-lg mb-2">{item.title}</h3>
					{/if}

					<!-- Render HTML content with MathJax support -->
					{#if typeset}
						<div
							class="prose max-w-none"
							use:typesetAction={{ typeset }}
						>
							{@html item.content}
						</div>
					{:else}
						<div class="prose max-w-none">
							{@html item.content}
						</div>
					{/if}
				</div>
			{/each}

			<!-- Action buttons -->
			<div class="modal-action">
				<button class="btn btn-primary" onclick={handleClose}>
					{i18n?.t('common.continue') ?? 'common.continue'}
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	/* Ensure modal is accessible */
	dialog {
		background-color: rgba(0, 0, 0, 0.5);
	}

	/* Ensure feedback content is readable */
	.modal-box {
		max-height: 80vh;
		overflow-y: auto;
	}
</style>
