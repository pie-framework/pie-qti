<script lang="ts" module>
	// The actions snippet's buttons wear the one shared dialog-action rule family.
	import { ensureSubmitDialogActionStyles } from './submitDialogAction.js';
	ensureSubmitDialogActionStyles();
</script>

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
