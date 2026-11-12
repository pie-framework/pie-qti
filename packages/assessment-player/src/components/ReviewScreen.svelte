<script lang="ts">
	/**
	 * Candidate-facing review screen and item palette.
	 *
	 * Lists every delivered item grouped by candidate-visible section with its state —
	 * answered / partially answered / unanswered, flagged for review, not yet visited —
	 * as text plus an icon (never colour alone), and a jump button per item wherever the
	 * navigation rules allow jumping. Linear parts render status only, with a note that
	 * explains why jumping is not available. The current item is marked with
	 * `aria-current`.
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { ReviewItemView } from '../core/reviewState.js';

	/** A review group: one candidate-visible section, or all items with no visible section. */
	export interface ReviewGroup {
		id: string | null;
		/** Position in the candidate-facing section list; -1 for the sectionless group. */
		index: number;
		title?: string;
		/** Whether jumping into this section is legal (linear parts are not). */
		navigable: boolean;
		items: ReviewItemView[];
	}

	interface Props {
		groups: ReviewGroup[];
		/** Items carrying a response, for the summary line. */
		answeredCount: number;
		totalItems: number;
		flaggedCount: number;
		i18n?: I18nProvider;
		/** Heading level of the "Review your answers" title, fitting the host outline. */
		headingLevel?: number;
		/** While a jump navigation is in flight the jump buttons are unavailable. */
		busy?: boolean;
		onJump: (index: number) => void | Promise<void>;
	}

	const { groups, answeredCount, totalItems, flaggedCount, i18n, headingLevel = 3, busy = false, onJump }: Props =
		$props();

	const uid = $props.id();
	const titleId = `${uid}-title`;
	const headingTag = $derived(`h${Math.min(6, Math.max(1, Math.round(headingLevel)))}`);
	// Section groups sit one level below the review title, inside the host outline.
	const groupHeadingTag = $derived(`h${Math.min(6, Math.max(1, Math.round(headingLevel) + 1))}`);

	let titleEl = $state<HTMLElement | null>(null);

	// Recomputed when the `i18n` prop changes; a setLocale() on the same provider object is
	// not tracked (the host re-renders, passes a new provider, or reloads).
	const translations = $derived.by(() => {
		const t = (key: string, fallback: string, values?: Record<string, string | number>) =>
			i18n?.t(key, fallback, values) ?? fallback;
		return {
			title: t('assessment.review.title', 'Review your answers'),
			summary: t('assessment.navigation.answeredCount', '{answered} of {total} answered', {
				answered: answeredCount,
				total: totalItems,
			}),
			flaggedSummary:
				flaggedCount > 0 ? t('assessment.review.flaggedCount', '{count} flagged for review', { count: flaggedCount }) : null,
			questionsGroup: t('assessment.review.questionsGroup', 'Questions'),
			sectionNumbered: (number: number, total: number) =>
				t('assessment.section', 'Section {current} of {total}', { current: number, total }),
			sectionDefault: (number: number) => t('assessment.sectionDefault', 'Section {number}', { number }),
			linearNote: t(
				'assessment.review.linearNote',
				'In this part you can only move forward, so these questions are listed for review only.',
			),
			goTo: (number: number) => t('assessment.review.goToItem', 'Go to question {number}', { number }),
			currentItem: t('assessment.review.currentItem', 'Current question'),
			question: (number: number) =>
				t('assessment.question', 'Question {current} of {total}', { current: number, total: totalItems }),
			statusAnswered: t('assessment.review.statusAnswered', 'Answered'),
			statusPartially: t('assessment.review.statusPartially', 'Partially answered'),
			statusUnanswered: t('assessment.review.statusUnanswered', 'Not answered'),
			notVisited: t('assessment.review.notVisited', 'Not yet visited'),
			flagged: t('assessment.review.flagged', 'Flagged'),
		};
	});

	type StatusKind = 'answered' | 'partial' | 'unanswered';

	function statusOf(item: ReviewItemView): { kind: StatusKind; label: string } {
		if (!item.visited) return { kind: 'unanswered', label: translations.notVisited };
		if (item.status === 'answered') return { kind: 'answered', label: translations.statusAnswered };
		if (item.status === 'partiallyAnswered') return { kind: 'partial', label: translations.statusPartially };
		return { kind: 'unanswered', label: translations.statusUnanswered };
	}

	function groupHeading(group: ReviewGroup): string {
		if (group.id === null) return translations.questionsGroup;
		const title = group.title?.trim();
		if (title) return title;
		const total = groups.filter((candidate) => candidate.id !== null).length;
		if (total <= 1) return translations.sectionDefault(group.index + 1);
		return translations.sectionNumbered(group.index + 1, total);
	}

	function handleJump(event: MouseEvent, index: number) {
		event.preventDefault();
		void onJump(index);
	}

	/** Move focus to the review title; the shell uses it when the review screen opens. */
	export function focusTitle(): void {
		titleEl?.focus();
	}
</script>

<section class="review-screen pie-qti-chrome" aria-labelledby={titleId}>
	<svelte:element this={headingTag} bind:this={titleEl} id={titleId} class="review-title" tabindex="-1">
		{translations.title}
	</svelte:element>
	<p class="review-summary">
		<span data-testid="review-answered-summary">{translations.summary}</span>
		{#if translations.flaggedSummary}
			<span class="review-flagged-summary" data-testid="review-flagged-summary">{translations.flaggedSummary}</span>
		{/if}
	</p>

	{#each groups as group (group.id ?? '__none__')}
		{@const groupId = `${uid}-group-${group.index >= 0 ? group.index : 'x'}`}
		<section class="review-group" aria-labelledby={groupId}>
			<svelte:element this={groupHeadingTag} id={groupId} class="review-group-title">
				{groupHeading(group)}
			</svelte:element>
			{#if !group.navigable && group.items.length > 0}
				<p class="review-note">{translations.linearNote}</p>
			{/if}
			<ul class="review-list">
				{#each group.items as item (item.identifier)}
					{@const status = statusOf(item)}
					<li class="review-item">
						{#if item.jumpAllowed}
							<button
								type="button"
								class="review-jump"
								aria-current={item.isCurrent ? 'true' : undefined}
								disabled={busy}
								onclick={(event) => handleJump(event, item.index)}
							>
								{translations.goTo(item.number)}
							</button>
						{:else}
							<span class="review-jump-static">{translations.question(item.number)}</span>
						{/if}
						<span
							class="review-status"
							class:status-answered={status.kind === 'answered'}
							class:status-partial={status.kind === 'partial'}
							class:status-unanswered={status.kind === 'unanswered'}
						>
							{#if status.kind === 'answered'}
								<svg
									class="review-status-icon"
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 20 20"
									fill="currentColor"
									aria-hidden="true"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
										clip-rule="evenodd"
									/>
								</svg>
							{:else if status.kind === 'partial'}
								<svg
									class="review-status-icon"
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 20 20"
									fill="currentColor"
									aria-hidden="true"
								>
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
										clip-rule="evenodd"
									/>
								</svg>
							{:else}
								<svg
									class="review-status-icon"
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									fill="none"
									viewBox="0 0 20 20"
									stroke="currentColor"
									aria-hidden="true"
								>
									<circle cx="10" cy="10" r="7.25" stroke-width="1.5" stroke-dasharray="3 2.4" />
								</svg>
							{/if}
							{status.label}
						</span>
						{#if item.flagged}
							<span class="review-flag">
								<svg
									class="review-status-icon"
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									aria-hidden="true"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"
									/>
								</svg>
								{translations.flagged}
							</span>
						{/if}
						{#if item.isCurrent}
							<span class="review-current-badge">{translations.currentItem}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</section>

<style>
	.review-screen {
		box-sizing: border-box;
		padding-block: var(--pie-qti-space-4, 1rem);
		padding-inline: var(--pie-qti-space-5, 1.5rem);
	}

	.review-title {
		margin: 0;
		font-size: 1.25em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.review-title:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.review-summary {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pie-qti-space-2, 0.5rem) var(--pie-qti-space-4, 1rem);
		margin: var(--pie-qti-space-2, 0.5rem) 0 0;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.review-flagged-summary {
		font-weight: 600;
	}

	.review-group {
		margin-block-start: var(--pie-qti-space-5, 1.5rem);
	}

	.review-group-title {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		font-size: 1.0625em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.review-note {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-size: 0.9375em;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.review-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-2, 0.5rem);
	}

	.review-item {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem) var(--pie-qti-space-3, 0.75rem);
		padding-block: var(--pie-qti-space-1, 0.25rem);
	}

	.review-jump {
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
		text-align: start;
		cursor: pointer;
	}

	.review-jump:hover:not(:disabled) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.review-jump[aria-current='true'] {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		box-shadow: inset 0 0 0 1px var(--pie-qti-primary, oklch(45% 0.24 277));
		font-weight: 700;
	}

	.review-jump:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.review-jump:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.review-jump-static {
		font-weight: 600;
	}

	.review-status {
		display: inline-flex;
		align-items: center;
		gap: var(--pie-qti-space-1, 0.25rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.review-status-icon {
		flex: none;
		inline-size: 1rem;
		block-size: 1rem;
	}

	.review-flag {
		display: inline-flex;
		align-items: center;
		gap: var(--pie-qti-space-1, 0.25rem);
		font-weight: 600;
		color: var(--pie-qti-warning-text, #92400e);
	}

	.review-current-badge {
		font-size: 0.875em;
		font-weight: 600;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 999px;
		padding-block: var(--pie-qti-space-1, 0.25rem);
		padding-inline: var(--pie-qti-space-3, 0.75rem);
	}

	/* Phones: one column, no squeezed rows. */
	@media (max-width: 40rem) {
		.review-screen {
			padding-inline: var(--pie-qti-space-3, 0.75rem);
		}

		.review-item {
			align-items: flex-start;
		}
	}
</style>
