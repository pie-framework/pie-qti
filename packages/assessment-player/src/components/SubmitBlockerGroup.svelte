<script lang="ts" module>
	/** One question a dialog holds the candidate on. */
	export type SubmitDialogItem = {
		number: number;
		index: number;
		jumpAllowed: boolean;
	};

	/** A question whose answer is incomplete, with what it still owes ("select at least 2"). */
	export type IncompleteDialogItem = SubmitDialogItem & { requirement: string };

	/** Blockers grouped for display: no answer at all, or an incomplete answer. */
	export type BlockerGroups = {
		needsAnswer: SubmitDialogItem[];
		incomplete: IncompleteDialogItem[];
	};
</script>

<script lang="ts">
	/**
	 * One group of questions a dialog holds the candidate on (the submit
	 * confirmation, the leave-part warning): a heading naming the count and why,
	 * then each question — a jump where navigation allows, else its position. An
	 * incomplete answer's entry adds what it still owes ("Question 2: select at
	 * least 2").
	 */
	import type { I18nProvider } from '@pie-qti/i18n';

	interface Props {
		/** The group's heading text ("2 questions need an answer…"). */
		heading: string;
		/** Id of the heading paragraph, referenced by the list and the held action. */
		headingId: string;
		/** Test id of the heading paragraph. */
		testId: string;
		/** Prefix of each jump button's test id (`${prefix}-${number}`). */
		jumpPrefix: string;
		/** The group's questions, in delivery order. */
		items: Array<SubmitDialogItem & { requirement?: string }>;
		/** Total questions, for the static entries' "Question 2 of 12". */
		total: number;
		/** Jumps are unavailable while a submission is in flight. */
		busy: boolean;
		i18n: I18nProvider;
		/** Jump to a question of this group. */
		onJump: (index: number) => void;
	}

	const { heading, headingId, testId, jumpPrefix, items, total, busy, i18n, onJump }: Props = $props();
</script>

<p class="submit-dialog-line submit-dialog-needs-answer" id={headingId} data-testid={testId}>
	{heading}
</p>
<ul class="submit-dialog-items" aria-labelledby={headingId}>
	{#each items as item (item.index)}
		<li>
			{#if item.jumpAllowed}
				<button
					type="button"
					class="submit-dialog-jump"
					data-testid={`${jumpPrefix}-${item.number}`}
					disabled={busy}
					onclick={() => void onJump(item.index)}
				>
					{item.requirement === undefined
						? i18n.t('assessment.review.goToItem', 'Go to question {number}', { number: item.number })
						: i18n.t('assessment.submit.incompleteJump', 'Go to question {number}: {requirement}', {
								number: item.number,
								requirement: item.requirement,
							})}
				</button>
			{:else}
				<span class="submit-dialog-static">
					{item.requirement === undefined
						? i18n.t('assessment.question', 'Question {current} of {total}', { current: item.number, total })
						: i18n.t('assessment.submit.incompleteEntry', 'Question {number}: {requirement}', {
								number: item.number,
								requirement: item.requirement,
							})}
				</span>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.submit-dialog-line {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
	}

	/* The refused end of the test reads as a warning naming questions, not a failure alert. */
	.submit-dialog-needs-answer {
		font-weight: 600;
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
