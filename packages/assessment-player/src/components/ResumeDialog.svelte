<script lang="ts">
	/**
	 * Resume prompt: the backend restored a snapshot with prior activity. The
	 * candidate continues where they left off, or — after confirming, because it
	 * cannot be undone (WCAG 3.3.4) — deletes the saved draft and starts over.
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import AssessmentDialog from './AssessmentDialog.svelte';

	interface Props {
		/** Whether the dialog is shown. Bindable: the actions and Escape set it false. */
		open?: boolean;
		/** The restored draft's save line ("You have answers saved from…"). */
		description: string;
		/** Whether "Start over" is offered at all (the shell's `allowStartOver` prop). */
		allowStartOver: boolean;
		i18n: I18nProvider;
		/** The candidate keeps their saved draft and continues. */
		onResume: () => void;
		/** "Start over" chosen; the shell confirms the irreversible deletion first. */
		onStartOver: () => void;
	}

	let {
		open = $bindable(false),
		description,
		allowStartOver,
		i18n,
		onResume,
		onStartOver,
	}: Props = $props();
</script>

<AssessmentDialog
	bind:open
	title={i18n.t('assessment.resume.title', 'Resume your test?')}
	{description}
	{i18n}
	// Escape keeps the saved answers and continues — it must never be one
	// step away from the irreversible deletion.
	onCancel={onResume}
>
	{#snippet actions({ close })}
		{#if allowStartOver}
			<!-- svelte-ignore a11y_autofocus -->
			<button
				type="button"
				class="submit-dialog-action"
				data-testid="assessment-resume-start-over"
				autofocus
				onclick={() => {
					close('cancel');
					onStartOver();
				}}
			>
				{i18n.t('assessment.resume.startOver', 'Start over')}
			</button>
		{/if}
		<!-- svelte-ignore a11y_autofocus -->
		<button
			type="button"
			class="submit-dialog-action primary"
			data-testid="assessment-resume-continue"
			autofocus={!allowStartOver}
			onclick={() => {
				close('confirm');
				onResume();
			}}
		>
			{i18n.t('assessment.resume.resumeAction', 'Resume where you left off')}
		</button>
	{/snippet}
</AssessmentDialog>

<style>
	/* The dialog's action buttons (the actions snippet keeps this component's CSS scope). */
	.submit-dialog-action {
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

	.submit-dialog-action:hover:not([aria-disabled='true']) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.submit-dialog-action:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.submit-dialog-action.primary {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
	}

	.submit-dialog-action.primary:hover:not([aria-disabled='true']) {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
	}
</style>
