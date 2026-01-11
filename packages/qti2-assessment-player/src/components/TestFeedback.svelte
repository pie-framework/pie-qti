<script lang="ts">
	/**
	 * TestFeedback Component
	 *
	 * Displays assessment-level feedback based on outcome conditions.
	 * Shows feedback when QTI outcome conditions are met.
	 */
	import type { I18nProvider } from '@pie-qti/qti2-i18n';

	interface FeedbackItem {
		identifier: string;
		content: string;
		access: string;
	}

	interface Props {
		/** Array of visible feedback items to display */
		feedback?: FeedbackItem[];
		/** Callback when feedback is dismissed (if dismissable) */
		onDismiss?: (identifier: string) => void;
		/** Allow dismissing individual feedback items */
		dismissable?: boolean;
		/** CSS class for custom styling */
		class?: string;
		i18n?: I18nProvider;
	}

	let {
		feedback = [],
		onDismiss,
		dismissable = false,
		class: className = '',
		i18n
	}: Props = $props();

	// Track dismissed items
	let dismissedItems = $state<Set<string>>(new Set());

	// Filter out dismissed items
	const visibleFeedback = $derived(
		feedback.filter((fb) => !dismissedItems.has(fb.identifier))
	);

	function handleDismiss(identifier: string) {
		dismissedItems.add(identifier);
		onDismiss?.(identifier);
	}
</script>

{#if visibleFeedback.length > 0}
	<div class="test-feedback {className}" role="region" aria-label="Test feedback">
		{#each visibleFeedback as item (item.identifier)}
			<div class="feedback-item" data-identifier={item.identifier}>
				<div class="feedback-content">
					{@html item.content}
				</div>
				{#if dismissable}
					<button
						class="feedback-dismiss"
						onclick={() => handleDismiss(item.identifier)}
						aria-label={i18n?.t('feedback.closeFeedback', 'Dismiss feedback')}
					>
						×
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.test-feedback {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 1rem 0;
	}

	.feedback-item {
		position: relative;
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: var(--feedback-bg, #f0f9ff);
		border: 1px solid var(--feedback-border, #0ea5e9);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.feedback-content {
		color: var(--feedback-text, #0c4a6e);
		line-height: 1.6;
	}

	.feedback-content :global(p) {
		margin: 0 0 0.5rem 0;
	}

	.feedback-content :global(p:last-child) {
		margin-bottom: 0;
	}

	.feedback-content :global(strong) {
		font-weight: 600;
	}

	.feedback-content :global(em) {
		font-style: italic;
	}

	.feedback-content :global(ul),
	.feedback-content :global(ol) {
		margin: 0.5rem 0;
		padding-left: 1.5rem;
	}

	.feedback-content :global(li) {
		margin: 0.25rem 0;
	}

	.feedback-dismiss {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--feedback-dismiss-color, #64748b);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.2s;
	}

	.feedback-dismiss:hover {
		background-color: var(--feedback-dismiss-hover-bg, rgba(0, 0, 0, 0.05));
		color: var(--feedback-dismiss-hover-color, #1e293b);
	}

	.feedback-dismiss:focus {
		outline: 2px solid var(--feedback-dismiss-focus, #0ea5e9);
		outline-offset: 2px;
	}
</style>
