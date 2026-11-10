<script lang="ts">
	/**
	 * Item feedback from a check-answer (or a submit-on-move with single-attempt
	 * feedback): the item's modal feedback, sanitized with the host's URL policy
	 * and shown with the shell's dialog semantics (focus in, Escape/Continue to
	 * close).
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig } from '@pie-qti/item-player';
	import { sanitizeHtml } from '@pie-qti/item-player/security';
	import type { ItemFeedbackEntry } from '../types/index.js';
	import AssessmentDialog from './AssessmentDialog.svelte';

	interface Props {
		/** Whether the dialog is shown. Bindable: Continue and Escape set it false. */
		open?: boolean;
		/** The captured feedback entries of the last item-level submission. */
		entries: ItemFeedbackEntry[];
		/** The host's URL policy for the feedback markup. */
		security?: PlayerSecurityConfig;
		/** The host's math typesetting, run over the mounted feedback body. */
		typeset?: (root: HTMLElement) => void | Promise<void>;
		i18n: I18nProvider;
		/** After the dialog closed, however it closed. */
		onClose: () => void;
	}

	let { open = $bindable(false), entries, security, typeset, i18n, onClose }: Props = $props();

	/** Svelte action: run the host's math typesetting over a mounted content node. */
	function typesetNode(node: HTMLElement) {
		if (!typeset) return;
		void Promise.resolve(typeset(node)).catch(() => {});
	}
</script>

<AssessmentDialog
	bind:open
	title={i18n.t('assessment.feedback.title', 'Feedback')}
	confirmLabel={i18n.t('common.continue', 'Continue')}
	showCancel={false}
	{i18n}
	{onClose}
>
	{#snippet children()}
		<div class="feedback-dialog-body pie-qti-content" data-testid="assessment-item-feedback" use:typesetNode>
			{#each entries as entry, index (`${entry.identifier}:${index}`)}
				<div class="feedback-dialog-entry">
					{#if entry.title}
						<p class="feedback-dialog-entry-title">{entry.title}</p>
					{/if}
					{@html sanitizeHtml(entry.content, { security })}
				</div>
			{/each}
		</div>
	{/snippet}
</AssessmentDialog>

<style>
	.feedback-dialog-body {
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-3, 0.75rem);
		overflow-wrap: anywhere;
	}

	.feedback-dialog-entry + .feedback-dialog-entry {
		padding-block-start: var(--pie-qti-space-3, 0.75rem);
		border-block-start: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
	}

	.feedback-dialog-entry-title {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		font-weight: 700;
	}

	.feedback-dialog-entry :global(> :first-child) {
		margin-block-start: 0;
	}

	.feedback-dialog-entry :global(> :last-child) {
		margin-block-end: 0;
	}
</style>
