<script lang="ts">
	/**
	 * Leaving a test part is irreversible: confirm with a clear "cannot return".
	 * The part's questions that still owe an answer are named with jumps, and
	 * Continue waits for them — a left part can never be revisited (the core
	 * refuses the step too).
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import AssessmentDialog from './AssessmentDialog.svelte';
	import SubmitBlockerGroup, { type BlockerGroups } from './SubmitBlockerGroup.svelte';

	/** The localized strings the warning renders, resolved by the shell (singular/plural). */
	type LeavePartTranslations = {
		needsAnswerHeading: string | null;
		incompleteHeading: string | null;
	};

	interface Props {
		/** Whether the dialog is shown. Bindable: the actions and Escape set it false. */
		open?: boolean;
		/** The part's questions that still owe an answer (Continue waits for them). */
		blockers: BlockerGroups;
		/** Total questions, for the static entries' "Question 2 of 12". */
		total: number;
		translations: LeavePartTranslations;
		/** Ids of the two blocker group headings, referenced by the held Continue action. */
		headingIds: { needsAnswer: string; incomplete: string };
		/** A transition is in flight: jumps are unavailable. */
		busy: boolean;
		i18n: I18nProvider;
		/** Jump from the warning to a question that still owes an answer. */
		onJump: (index: number) => void;
		/** Continue chosen (held while questions still owe an answer). */
		onConfirm: () => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		blockers,
		total,
		translations,
		headingIds,
		busy,
		i18n,
		onJump,
		onConfirm,
	}: Props = $props();

	const blocked = $derived(blockers.needsAnswer.length > 0 || blockers.incomplete.length > 0);
</script>

<AssessmentDialog
	bind:open
	title={i18n.t('assessment.leavePart.title', 'Leave this part?')}
	description={i18n.t('assessment.leavePart.description', 'After you continue, you cannot return to the questions in this part.')}
	dismissible={false}
	{i18n}
	{onConfirm}
>
	{#snippet children()}
		{#if translations.needsAnswerHeading}
			<SubmitBlockerGroup
				heading={translations.needsAnswerHeading}
				headingId={headingIds.needsAnswer}
				testId="leave-part-needs-answer"
				jumpPrefix="leave-part-needs-answer-jump"
				items={blockers.needsAnswer}
				{total}
				{busy}
				{i18n}
				onJump={onJump}
			/>
		{/if}
		{#if translations.incompleteHeading}
			<SubmitBlockerGroup
				heading={translations.incompleteHeading}
				headingId={headingIds.incomplete}
				testId="leave-part-incomplete"
				jumpPrefix="leave-part-incomplete-jump"
				items={blockers.incomplete}
				{total}
				{busy}
				{i18n}
				onJump={onJump}
			/>
		{/if}
	{/snippet}
	{#snippet actions({ close })}
		<!-- svelte-ignore a11y_autofocus -->
		<button
			type="button"
			class="submit-dialog-action"
			data-testid="assessment-dialog-cancel"
			autofocus={blocked}
			onclick={() => close('cancel')}
		>
			{i18n.t('assessment.leavePart.cancel', 'Stay on this part')}
		</button>
		<button
			type="button"
			class="submit-dialog-action primary"
			data-testid="assessment-dialog-confirm"
			aria-disabled={blocked ? 'true' : undefined}
			aria-describedby={blocked
				? [
						blockers.needsAnswer.length > 0 ? headingIds.needsAnswer : null,
						blockers.incomplete.length > 0 ? headingIds.incomplete : null,
					]
					.filter(Boolean)
					.join(' ')
				: undefined}
			onclick={() => {
				if (blocked) return;
				close('confirm');
			}}
		>
			{i18n.t('assessment.leavePart.confirm', 'Continue')}
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

	.submit-dialog-action[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.6;
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
