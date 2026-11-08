<script lang="ts">
	/**
	 * The candidate-facing completion state the shell shows after finalization:
	 * a localized "You have finished the test" (or its time-expired variant when the time
	 * ended the test — the whole-test limit, or a scope expiry that left nothing open —
	 * its proctor variant when a proctor force-submitted),
	 * the test's own `testFeedback` (outcome-matched, already filtered by the core), and —
	 * only when the host opts in through `showResultsSummary` — a per-question results
	 * summary with the backend's scores.
	 *
	 * Token-styled, keyboard-clean: the heading takes focus like a navigation target,
	 * and the summary is a plain list that reflows to 320px.
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig } from '@pie-qti/item-player';
	import type { QtiSectionRole, QtiSectionRuntimeHostContract } from '@pie-qti/section-player';
	import type { QtiSharedHtmlBlock } from '@pie-qti/section-player';
	import { TestFeedback as SectionTestFeedback } from '../../../section-player/src/components/index.js';
	import type { AssessmentEndReason, ResultsSummary } from '../types/index.js';

	interface Props {
		/** Heading level of the completion title, matching the shell's outline. */
		headingLevel: number;
		/** True when a time expiry ended the test: the heading says so. */
		finishedByTimeExpiry?: boolean;
		/**
		 * Why the test ended in this delivery. A proctor's force-submit (`proctor`) and a
		 * time expiry (`expiry` — the whole test, or a scope expiry that left nothing open,
		 * whoever submitted the collection) have their own headings; the others read as finished.
		 */
		endReason?: AssessmentEndReason | null;
		/**
		 * True when the session was restored already finalized: the terminal
		 * "already submitted" view, shown instead of delivery whose every action fails.
		 */
		alreadySubmitted?: boolean;
		/** The test's outcome-matched feedback blocks, as the shell renders them in delivery. */
		testFeedback?: QtiSharedHtmlBlock[];
		/** The finalized per-question results; rendered only with `showResultsSummary`. */
		resultsSummary?: ResultsSummary | null;
		/** Host opt-in: without it high-stakes deliveries show no scores at all. */
		showResultsSummary?: boolean;
		role?: QtiSectionRole;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		host?: QtiSectionRuntimeHostContract;
		typeset?: (root: HTMLElement) => void | Promise<void>;
		/** Own the viewport: page-level `main` landmark instead of a section. */
		fullViewport?: boolean;
		/** Interface-locale attributes of the shell chrome. */
		lang?: string;
		dir?: 'ltr' | 'rtl';
	}

	const {
		headingLevel,
		finishedByTimeExpiry = false,
		endReason = null,
		alreadySubmitted = false,
		testFeedback = [],
		resultsSummary = null,
		showResultsSummary = false,
		role = 'candidate',
		i18n,
		security,
		host,
		typeset,
		fullViewport = false,
		lang,
		dir,
	}: Props = $props();

	const uid = $props.id();
	const headingId = `${uid}-heading`;
	const resultsId = `${uid}-results`;
	const headingTag = $derived(`h${Math.min(6, Math.max(1, Math.round(headingLevel)))}`);
	const resultsHeadingTag = $derived(
		`h${Math.min(6, Math.max(1, Math.round(headingLevel) + 1))}`,
	);

	let headingEl = $state<HTMLElement | null>(null);

	const title = $derived(
		alreadySubmitted
			? (i18n?.t('assessment.complete.alreadySubmitted') ?? 'This test was already submitted.')
			: endReason === 'proctor'
				? (i18n?.t('assessment.complete.byProctor') ?? 'Your test was submitted by your proctor.')
				: finishedByTimeExpiry || endReason === 'expiry'
					? (i18n?.t('assessment.complete.timeExpired') ?? 'Time is up. The test is finished and your answers have been submitted.')
					: (i18n?.t('assessment.complete.finished') ?? 'You have finished the test.')
	);

	const statusText = $derived.by(() => ({
		answered: i18n?.t('assessment.review.statusAnswered') ?? 'Answered',
		partially: i18n?.t('assessment.review.statusPartially') ?? 'Partially answered',
		unanswered: i18n?.t('assessment.review.statusUnanswered') ?? 'Not answered',
	}));

	function statusLabel(status: ResultsSummary['items'][number]['status']): string {
		if (status === 'partiallyAnswered') return statusText.partially;
		if (status === 'answered') return statusText.answered;
		return statusText.unanswered;
	}

	/** Normalized scores arrive as floats; two decimals keep the readout sane. */
	function formatScore(value: number): string {
		const rounded = Math.round(value * 100) / 100;
		return i18n?.formatNumber?.(rounded) ?? String(rounded);
	}

	/** The shell moves focus here once the completion view mounts, like a navigation. */
	export function focusHeading(): void {
		headingEl?.focus();
	}
</script>

<svelte:element
	this={fullViewport ? 'main' : 'section'}
	class="assessment-complete pie-qti-chrome"
	class:full-viewport={fullViewport}
	lang={lang}
	dir={dir}
	aria-labelledby={headingId}
	data-testid="assessment-complete"
>
	<div class="complete-card">
		<svg
			class="complete-icon"
			xmlns="http://www.w3.org/2000/svg"
			width="32"
			height="32"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		<svelte:element
			this={headingTag}
			bind:this={headingEl}
			id={headingId}
			class="complete-title"
			tabindex="-1"
		>
			{title}
		</svelte:element>

		{#if testFeedback.length > 0}
			<!-- The test's own outcome-matched feedback (atEnd blocks are visible now). -->
			<div class="complete-feedback">
				<SectionTestFeedback feedback={testFeedback} {role} {i18n} {security} {host} {typeset} />
			</div>
		{/if}

		{#if showResultsSummary && resultsSummary}
			<section class="complete-results" aria-labelledby={resultsId} data-testid="assessment-results-summary">
				<svelte:element this={resultsHeadingTag} id={resultsId} class="complete-results-title">
					{i18n?.t('assessment.complete.resultsHeading') ?? 'Results summary'}
				</svelte:element>
				<p class="complete-total" data-testid="assessment-total-score">
					{i18n?.t('assessment.complete.totalScore', {
						score: formatScore(resultsSummary.totalScore),
						maxScore: formatScore(resultsSummary.maxScore),
					}) ?? `Total score: ${formatScore(resultsSummary.totalScore)} out of ${formatScore(resultsSummary.maxScore)}`}
				</p>
				<ul class="complete-items">
					{#each resultsSummary.items as item (item.identifier)}
						<li class="complete-item" data-testid="assessment-result-item">
							<span class="complete-item-name">
								{i18n?.t('assessment.complete.itemName', { number: item.number }) ?? `Question ${item.number}`}
								{#if item.title?.trim()}
									<span class="complete-item-title">{item.title}</span>
								{/if}
							</span>
							<span class="complete-item-status">{statusLabel(item.status)}</span>
							{#if item.score !== undefined && item.maxScore !== undefined}
								<span class="complete-item-score">
									{i18n?.t('assessment.feedback.score', {
										score: formatScore(item.score),
										maxScore: formatScore(item.maxScore),
									}) ?? `Score: ${formatScore(item.score)} / ${formatScore(item.maxScore)}`}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</svelte:element>

<style>
	.assessment-complete {
		box-sizing: border-box;
		flex: 1 1 auto;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: var(--pie-qti-space-6, 2rem) var(--pie-qti-space-4, 1rem);
		overflow-y: auto;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}

	.assessment-complete.full-viewport {
		min-block-size: 100dvh;
		padding-block-start: max(var(--pie-qti-space-6, 2rem), env(safe-area-inset-top, 0px));
		padding-block-end: max(var(--pie-qti-space-6, 2rem), env(safe-area-inset-bottom, 0px));
	}

	.complete-card {
		box-sizing: border-box;
		inline-size: min(42rem, 100%);
		padding: var(--pie-qti-space-6, 2rem);
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.complete-icon {
		display: block;
		inline-size: 2rem;
		block-size: 2rem;
		margin-block-end: var(--pie-qti-space-3, 0.75rem);
		color: var(--pie-qti-success, oklch(45% 0.13 163));
	}

	.complete-title {
		margin: 0 0 var(--pie-qti-space-4, 1rem);
		font-size: 1.375em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.complete-title:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.complete-feedback {
		margin-block-end: var(--pie-qti-space-4, 1rem);
	}

	/* The feedback section carries its own margins; drop the wrapper's at the edges. */
	.complete-feedback :global(.test-feedback:first-child) {
		margin-block-start: 0;
	}

	.complete-feedback :global(.test-feedback:last-child) {
		margin-block-end: 0;
	}

	.complete-results {
		margin-block-start: var(--pie-qti-space-4, 1rem);
	}

	.complete-results-title {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-size: 1.125em;
		font-weight: 700;
		line-height: 1.3;
	}

	.complete-total {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-weight: 600;
	}

	.complete-items {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.complete-item {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--pie-qti-space-1, 0.25rem) var(--pie-qti-space-4, 1rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		border-block-end: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
	}

	.complete-item:last-child {
		border-block-end: 0;
	}

	.complete-item-name {
		min-inline-size: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.complete-item-title {
		display: block;
		font-weight: 400;
		font-size: 0.9375em;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.complete-item-status {
		font-size: 0.9375em;
	}

	.complete-item-score {
		font-size: 0.9375em;
		font-variant-numeric: tabular-nums;
		margin-inline-start: auto;
	}

	/* Phones: the score drops under the name instead of stretching the row. */
	@media (max-width: 30rem) {
		.complete-card {
			padding: var(--pie-qti-space-4, 1rem);
		}

		.complete-item-score {
			margin-inline-start: 0;
			flex-basis: 100%;
		}
	}
</style>
