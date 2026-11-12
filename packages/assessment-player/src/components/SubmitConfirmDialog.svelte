<script lang="ts" module>
	// The actions snippet's buttons wear the one shared dialog-action rule family.
	import { ensureSubmitDialogActionStyles } from './submitDialogAction.js';
	ensureSubmitDialogActionStyles();

	/** The localized strings the submit confirmation renders, resolved by the shell. */
	export type SubmitDialogTranslations = {
		dialogTitle: string;
		dialogDescription: string;
		answeredLine: string;
		flaggedLine: string | null;
		needsAnswerHeading: string | null;
		incompleteHeading: string | null;
		unansweredHeading: string | null;
		allAnswered: string;
		confirm: string;
		cancel: string;
		reviewAction: string;
	};

	/** The summary the confirmation shows, computed by the shell from the core. */
	export type SubmitDialogSummary = {
		answeredCount: number;
		total: number;
		flaggedCount: number;
		unanswered: SubmitDialogItem[];
	} & BlockerGroups;
</script>

<script lang="ts">
	/**
	 * The submit confirmation (WCAG 3.3.4: submitting the test is irreversible).
	 * Names the unanswered and flagged questions, links back to them when the
	 * navigation rules allow, and requires an explicit confirm. Focus returns to
	 * the Submit control on cancel.
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import AssessmentDialog from './AssessmentDialog.svelte';
	import SubmitBlockerGroup, { type BlockerGroups, type SubmitDialogItem } from './SubmitBlockerGroup.svelte';

	interface Props {
		/** Whether the dialog is shown. Bindable: the actions and Escape set it false. */
		open?: boolean;
		summary: SubmitDialogSummary | null;
		/** The submit transition is in flight: actions stay focusable but unavailable. */
		busy: boolean;
		/** Submit is unavailable while the end of the test would refuse held-back items. */
		blocked: boolean;
		translations: SubmitDialogTranslations;
		/** Ids of the blocker group headings, referenced by their lists and the held Submit action. */
		headingIds: { needsAnswer: string; incomplete: string; unanswered: string };
		i18n: I18nProvider;
		/** Jump from the dialog to a question that still owes an answer. */
		onJump: (index: number) => void;
		/** "Review questions" chosen. */
		onReview: () => void;
		/** Submit chosen (the dialog stays open until the caller closes it). */
		onConfirm: () => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		summary,
		busy,
		blocked,
		translations,
		headingIds,
		i18n,
		onJump,
		onReview,
		onConfirm,
	}: Props = $props();
</script>

<AssessmentDialog bind:open title={translations.dialogTitle} description={translations.dialogDescription} tone="danger" closeOnConfirm={false} {busy} {i18n} {onConfirm}>
	{#snippet children()}
		<p class="submit-dialog-summary" data-testid="submit-dialog-summary">
			<strong>{translations.answeredLine}</strong>
		</p>
		{#if translations.flaggedLine}
			<p class="submit-dialog-line">{translations.flaggedLine}</p>
		{/if}
		{#if translations.needsAnswerHeading && summary}
			<!--
				Items the end of the test would refuse: QTI allowSkipping=false without an
				answer, named first, with a jump where navigation allows. Submit is
				unavailable until they are answered.
			-->
			<SubmitBlockerGroup
				heading={translations.needsAnswerHeading}
				headingId={headingIds.needsAnswer}
				testId="submit-dialog-needs-answer"
				jumpPrefix="submit-dialog-needs-answer-jump"
				items={summary.needsAnswer}
				total={summary.total}
				{busy}
				{i18n}
				onJump={onJump}
			/>
		{/if}
		{#if translations.incompleteHeading && summary}
			<!--
				validateResponses=true with an incomplete answer: a distinct group — the
				answer exists but does not meet its interaction's minimum — whose entries
				say what each still owes.
			-->
			<SubmitBlockerGroup
				heading={translations.incompleteHeading}
				headingId={headingIds.incomplete}
				testId="submit-dialog-incomplete"
				jumpPrefix="submit-dialog-incomplete-jump"
				items={summary.incomplete}
				total={summary.total}
				{busy}
				{i18n}
				onJump={onJump}
			/>
		{/if}
		{#if translations.unansweredHeading && summary}
			<p class="submit-dialog-line" id={headingIds.unanswered}>{translations.unansweredHeading}</p>
			<ul class="submit-dialog-items" aria-labelledby={headingIds.unanswered}>
				{#each summary.unanswered as item (item.index)}
					<li>
						{#if item.jumpAllowed}
							<button
								type="button"
								class="submit-dialog-jump"
								data-testid={`submit-dialog-jump-${item.number}`}
								disabled={busy}
								onclick={() => void onJump(item.index)}
							>
								{i18n.t('assessment.review.goToItem', 'Go to question {number}', { number: item.number })}
							</button>
						{:else}
							<span class="submit-dialog-static">
								{i18n.t('assessment.question', 'Question {current} of {total}', {
									current: item.number,
									total: summary?.total ?? 0,
								})}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else if !blocked}
			<p class="submit-dialog-line">{translations.allAnswered}</p>
		{/if}
	{/snippet}
	{#snippet actions({ close })}
		<button
			type="button"
			class="submit-dialog-action"
			data-testid="submit-dialog-review"
			aria-disabled={busy ? 'true' : undefined}
			onclick={() => {
				// Unavailable while the submission runs: it must not act under it.
				if (busy) return;
				close('cancel');
				onReview();
			}}
		>
			{translations.reviewAction}
		</button>
		<!-- svelte-ignore a11y_autofocus -->
		<button
			type="button"
			class="submit-dialog-action"
			data-testid="assessment-dialog-cancel"
			autofocus
			aria-disabled={busy ? 'true' : undefined}
			onclick={() => close('cancel')}
		>
			{translations.cancel}
		</button>
		<button
			type="button"
			class="submit-dialog-action danger"
			data-testid="assessment-dialog-confirm"
			aria-disabled={busy || blocked ? 'true' : undefined}
			aria-describedby={blocked
				? [
						translations.needsAnswerHeading ? headingIds.needsAnswer : null,
						translations.incompleteHeading ? headingIds.incomplete : null,
					]
					.filter(Boolean)
					.join(' ')
				: undefined}
			onclick={() => {
				if (blocked) return;
				close('confirm');
			}}
		>
			{translations.confirm}
		</button>
	{/snippet}
</AssessmentDialog>

<style>
	/* Submit-confirmation dialog body */
	.submit-dialog-summary {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		font-size: 1.0625em;
	}

	.submit-dialog-line {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
	}

	.submit-dialog-items {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-2, 0.5rem);
		max-block-size: 12rem;
		overflow-y: auto;
	}

	.submit-dialog-jump {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
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
		text-align: start;
		cursor: pointer;
	}

	.submit-dialog-jump:hover:not(:disabled) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.submit-dialog-jump:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.submit-dialog-jump:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.submit-dialog-static {
		font-weight: 600;
	}
</style>
