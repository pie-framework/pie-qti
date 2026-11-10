<script lang="ts">
	import type { NavigationState } from '../types/index.js';
	import type { I18nProvider } from '@pie-qti/i18n';

	interface Props {
		navState: NavigationState;
		i18n?: I18nProvider;
		onPrevious?: () => void;
		onNext?: () => void;
		onSubmit?: () => void;
		showProgress?: boolean;
		/** Items carrying a response (answered or partially answered), for the "8 of 12 answered" count. */
		answeredCount?: number;
		/**
		 * Autosave status line ("Saved · 12:04" / "Saving…" / "Not saved"), announced
		 * politely on change. Absent (undefined) when there is nothing to show yet.
		 */
		saveLabel?: string | null;
		/**
		 * Whether autosave is on for this session: the indicator region mounts whenever it
		 * is (empty while idle), so a screen reader picks its first message up.
		 */
		saveStatusEnabled?: boolean;
		/** Whether the candidate has flagged the current item for review. */
		flagged?: boolean;
		/** Toggle the current item's flag-for-review. */
		onToggleFlag?: () => void;
		/** Whether the review screen can be opened (hidden once the test is complete). */
		showReview?: boolean;
		/** Open or close the review screen. */
		reviewOpen?: boolean;
		onToggleReview?: () => void;
		/**
		 * Show the Submit control regardless of the item position — set when an expired
		 * time limit left no reachable item, so the candidate can always finish the test.
		 */
		showSubmit?: boolean;
		/**
		 * Practice delivery (`itemSessionControl@showFeedback` with more than one attempt,
		 * or an adaptive item): the facts behind the item-level "Check answer" control —
		 * `null` hides it (simultaneous parts, feedback off, single-attempt items).
		 */
		checkAnswer?: {
			adaptive: boolean;
			attemptsUsed: number;
			maxAttempts: number | null;
			remainingAttempts: number | null;
			attemptsExhausted: boolean;
		} | null;
		/** Submit the current item and stay on it (the shell shows the feedback). */
		onCheckAnswer?: () => void;
		/** Blocks interaction and focus while a proctor pause holds the assessment. */
		inert?: boolean;
	}

	const {
		navState,
		i18n,
		onPrevious,
		onNext,
		onSubmit,
		showProgress = true,
		answeredCount,
		saveLabel = null,
		saveStatusEnabled = false,
		flagged = false,
		onToggleFlag,
		showReview = false,
		reviewOpen = false,
		onToggleReview,
		showSubmit = false,
		checkAnswer = null,
		onCheckAnswer,
		inert = false,
	}: Props = $props();

	const uid = $props.id();

	const progressPercentage = $derived(
		navState.totalItems > 0 ? ((navState.currentIndex + 1) / navState.totalItems) * 100 : 0,
	);
	const isLastItem = $derived(navState.currentIndex === navState.totalItems - 1);
	// Submit sits at the row's end on the last item — or whenever the shell demands it
	// (an expiry dead end), so finishing the test is never out of reach.
	const showSubmitButton = $derived(isLastItem || showSubmit);
	// Structural unavailability disables the control; a transition in flight only marks it
	// unavailable so the activated button keeps focus while the next item loads.
	const busy = $derived(navState.isLoading);

	/**
	 * The current section's candidate-facing label: its title, else its position when
	 * there is more than one section to tell apart. Never "Section 2 of 0".
	 */
	function sectionLabel(): string | null {
		const section = navState.currentSection;
		if (!section) return null;
		const title = section.title?.trim();
		if (title) return title;
		if (section.index < 0) return null;
		const total = navState.totalSections;
		if (total === undefined) {
			return i18n?.t('assessment.sectionDefault', { number: section.index + 1 }) ?? `Section ${section.index + 1}`;
		}
		if (total <= 1) return null;
		return i18n?.t('assessment.section', { current: section.index + 1, total }) ?? `Section ${section.index + 1} of ${total}`;
	}

	// Recomputed when the `i18n` prop changes. A setLocale() on the same provider
	// object is not tracked: the host re-renders, passes a new provider, or reloads.
	const translations = $derived.by(() => {
		const question =
			i18n?.t('assessment.question', { current: navState.currentIndex + 1, total: navState.totalItems }) ??
			`Question ${navState.currentIndex + 1} of ${navState.totalItems}`;
		const percent = Math.round(progressPercentage);
		const answered =
			answeredCount === undefined || !showProgress
				? null
				: i18n?.t('assessment.navigation.answeredCount', { answered: answeredCount, total: navState.totalItems }) ??
					`${answeredCount} of ${navState.totalItems} answered`;
		const progress = `${i18n?.t('assessment.navigation.progress', { percent }) ?? `Progress: ${percent}%`}: ${question}`;
		return {
			question,
			section: sectionLabel(),
			answered,
			label: i18n?.t('accessibility.navigationRegion') ?? 'Assessment navigation',
			previous: i18n?.t('common.previous') ?? 'Previous',
			next: i18n?.t('common.next') ?? 'Next',
			submit: i18n?.t('assessment.navigation.submit') ?? 'Submit',
			flag: i18n?.t('assessment.flag.label') ?? 'Flag for review',
			reviewOpen: i18n?.t('assessment.review.backToQuestion') ?? 'Back to question',
			reviewClosed: i18n?.t('assessment.review.open') ?? 'Review questions',
			checkAnswer: i18n?.t('assessment.checkAnswer.button') ?? 'Check answer',
			attemptsUsedUp:
				i18n?.t('assessment.checkAnswer.attemptsUsedUp') ?? 'You have used all your attempts for this question.',
			// The progress bar's name carries the position and the answered count.
			progress: answered ? `${progress}. ${answered}` : progress,
		};
	});

	/**
	 * The attempt facts beside the check control: the ordinal the next check would
	 * consume ("Attempt 2 of 3"), the same counter without a total for unlimited
	 * (adaptive) items, or the used-up explanation once the last attempt is gone.
	 */
	const attemptsLine = $derived.by(() => {
		if (!checkAnswer) return null;
		if (checkAnswer.attemptsExhausted) {
			return { text: translations.attemptsUsedUp, exhausted: true };
		}
		const next = checkAnswer.attemptsUsed + 1;
		if (checkAnswer.maxAttempts !== null && checkAnswer.maxAttempts > 1) {
			const text =
				i18n?.t('assessment.attempts.attemptOf', { current: Math.min(next, checkAnswer.maxAttempts), total: checkAnswer.maxAttempts }) ??
				`Attempt ${Math.min(next, checkAnswer.maxAttempts)} of ${checkAnswer.maxAttempts}`;
			return { text, exhausted: false };
		}
		const text = i18n?.t('assessment.attempts.current', { current: next }) ?? `Attempt ${next}`;
		return { text, exhausted: false };
	});

	function handlePrevious() {
		if (busy) return;
		onPrevious?.();
	}

	function handleNext() {
		if (busy) return;
		onNext?.();
	}

	function handleSubmit() {
		if (busy) return;
		onSubmit?.();
	}

	function handleCheckAnswer() {
		if (busy || checkAnswer?.attemptsExhausted) return;
		onCheckAnswer?.();
	}
</script>

<nav class="navigation-bar pie-qti-chrome" aria-label={translations.label} aria-busy={busy} inert={inert || undefined}>
	<div class="navigation-buttons">
		<button
			type="button"
			class="nav-button"
			data-testid="assessment-prev"
			onclick={handlePrevious}
			disabled={!navState.canPrevious}
			aria-disabled={busy ? 'true' : undefined}
		>
			<svg
				class="nav-icon nav-icon-directional"
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			<span class="nav-button-label collapsible">{translations.previous}</span>
		</button>

		{#if showProgress}
			<div class="progress-section">
				<div class="progress-label">
					<span class="progress-question">{translations.question}</span>
					{#if translations.section}
						<span class="progress-section-title">{translations.section}</span>
					{/if}
				{#if translations.answered}
					<span class="progress-answered" data-testid="assessment-answered-count">{translations.answered}</span>
				{/if}
				{#if saveStatusEnabled}
					<!--
						The autosave indicator: a polite live region that exists from the start
						(empty while idle), so a screen reader is subscribed when the first
						"Saving…" / "Saved" / "Not saved" lands rather than missing it.
					-->
					<span class="progress-saved" data-testid="assessment-save-status" role="status" aria-live="polite">
						{saveLabel}
					</span>
				{/if}
				</div>
				<progress class="progress-bar" value={progressPercentage} max="100" aria-label={translations.progress}></progress>
			</div>
		{:else}
			<div class="navigation-spacer"></div>
		{/if}

		{#if showReview}
			<!-- A view switch, not a disclosure: each label names the action this press
			     performs and is the accessible name, so the flip alone carries which view
			     is current (WCAG 4.1.2). aria-expanded would announce the same fact a
			     second time, and the whole main region it swaps is no disclosed region of
			     this control; aria-pressed would misread the mode switch as a two-state
			     toggle beside the flag button, which is that pattern's real user here. -->
			<button
				type="button"
				class="nav-button"
				data-testid="assessment-review"
				aria-disabled={busy ? 'true' : undefined}
				onclick={() => (busy ? undefined : onToggleReview?.())}
			>
				<svg
					class="nav-icon"
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
				</svg>
				<span class="nav-button-label collapsible">{reviewOpen ? translations.reviewOpen : translations.reviewClosed}</span>
			</button>
		{/if}

		{#if onToggleFlag}
			<button
				type="button"
				class="nav-button flag-button"
				class:flagged={flagged}
				data-testid="assessment-flag"
				aria-pressed={flagged}
				aria-disabled={busy ? 'true' : undefined}
				onclick={() => (busy ? undefined : onToggleFlag?.())}
			>
				<svg
					class="nav-icon"
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
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
				<span class="nav-button-label">{translations.flag}</span>
			</button>
		{/if}

		{#if checkAnswer && onCheckAnswer}
			<!--
				Practice delivery: an item-level submission that stays on the item so its
				feedback is seen — distinct from the section's Next and the test's Submit.
				The attempt counter beside it is a polite live region, so a new count (or the
				"no attempts left" explanation) is heard after each check.
			-->
			<div class="check-group">
				<button
					type="button"
					class="nav-button check-button"
					data-testid="assessment-check-answer"
					disabled={checkAnswer.attemptsExhausted}
					aria-disabled={busy ? 'true' : undefined}
					aria-describedby={attemptsLine ? `${uid}-attempts` : undefined}
					onclick={handleCheckAnswer}
				>
					<svg
						class="nav-icon"
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="nav-button-label">{translations.checkAnswer}</span>
				</button>
				{#if attemptsLine}
					<span
						id={`${uid}-attempts`}
						class="check-attempts"
						class:exhausted={attemptsLine.exhausted}
						data-testid="assessment-attempts"
						role="status"
						aria-live="polite"
					>
						{attemptsLine.text}
					</span>
				{/if}
			</div>
		{/if}

		{#if showSubmitButton}
			<!--
				Final submission: a destructive, irreversible action, styled apart from the
				filled primary Next and routed through the shell's confirmation dialog.
			-->
			<button
				type="button"
				class="nav-button submit-button"
				data-testid="assessment-submit"
				onclick={handleSubmit}
				aria-disabled={busy ? 'true' : undefined}
			>
				<svg
					class="nav-icon"
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
				</svg>
				<span class="nav-button-label">{translations.submit}</span>
			</button>
		{:else}
			<button
				type="button"
				class="nav-button primary"
				data-testid="assessment-next"
				onclick={handleNext}
				disabled={!navState.canNext}
				aria-disabled={busy ? 'true' : undefined}
			>
				<span class="nav-button-label collapsible">{translations.next}</span>
				<svg
					class="nav-icon nav-icon-directional"
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		{/if}
	</div>
</nav>

<style>
	.navigation-bar {
		container-type: inline-size;
		box-sizing: border-box;
		padding-block: var(--pie-qti-space-3, 0.75rem);
		padding-inline: var(--pie-qti-space-4, 1rem);
		border-block-start: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}

	/* One row: Previous, the position, the item actions, Next or Submit. */
	.navigation-buttons {
		display: flex;
		align-items: center;
		gap: var(--pie-qti-space-3, 0.75rem);
	}

	.progress-section {
		flex: 1 1 auto;
		min-inline-size: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--pie-qti-space-1, 0.25rem);
		text-align: center;
	}

	.navigation-spacer {
		flex: 1 1 auto;
	}

	.progress-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-inline-size: 100%;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.progress-question {
		font-weight: 600;
	}

	.progress-section-title {
		font-size: 0.875em;
	}

	.progress-answered {
		font-size: 0.875em;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	/* The autosave status reads quieter than the position, but never below AA contrast. */
	.progress-saved {
		font-size: 0.8125em;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.progress-bar {
		appearance: none;
		-webkit-appearance: none;
		box-sizing: border-box;
		inline-size: 100%;
		max-inline-size: 16rem;
		block-size: 0.5rem;
		border: 0;
		border-radius: 999px;
		overflow: hidden;
		background: var(--pie-qti-base-300, oklch(95% 0 0));
		box-shadow: inset 0 0 0 1px var(--pie-qti-border-strong, #767676);
		color: var(--pie-qti-primary, oklch(45% 0.24 277));
	}

	.progress-bar::-webkit-progress-bar {
		background: transparent;
	}

	.progress-bar::-webkit-progress-value {
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		border-radius: 999px;
	}

	.progress-bar::-moz-progress-bar {
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		border-radius: 999px;
	}

	/* Forced colors drop custom fills: let the platform draw the bar. */
	@media (forced-colors: active) {
		.progress-bar {
			appearance: auto;
			-webkit-appearance: auto;
			box-shadow: none;
		}
	}

	.nav-button {
		position: relative;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--pie-qti-space-2, 0.5rem);
		flex: 0 1 auto;
		max-inline-size: 45%;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-3, 0.75rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		text-align: center;
		overflow-wrap: anywhere;
		cursor: pointer;
	}

	.nav-button:hover:not(:disabled, [aria-disabled='true']) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.nav-button.primary {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
	}

	.nav-button.primary:hover:not(:disabled, [aria-disabled='true']) {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
	}

	/*
	 * Final submission. Deliberately unlike Next: an outlined, error-toned control
	 * (the action is irreversible), never mistaken for the forward navigation even
	 * before its confirmation dialog opens.
	 */
	.nav-button.submit-button {
		border: 2px solid var(--pie-qti-error-text, #b91c1c);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-error-text, #b91c1c);
	}

	.nav-button.submit-button:hover:not([aria-disabled='true']) {
		background: color-mix(in oklab, var(--pie-qti-error-text, #b91c1c) 8%, var(--pie-qti-base-100, oklch(100% 0 0)));
	}

	/* The per-item flag toggle shows its pressed state in the icon fill, not colour alone. */
	.nav-button.flag-button[aria-pressed='true'] {
		border-color: var(--pie-qti-warning-text, #92400e);
		color: var(--pie-qti-warning-text, #92400e);
	}

	.nav-button.flag-button[aria-pressed='true'] .nav-icon {
		fill: currentColor;
	}

	/*
	 * Forced colors drop the token colors and the SVG fill, which would leave the pressed
	 * flag indistinguishable: Highlight/HighlightText is the system's selection pair. With
	 * forced-color-adjust off the browser keeps the authored background too, so it must be
	 * the pair's background (Highlight) — never the token base colour, which would put
	 * HighlightText on white in light high-contrast themes.
	 */
	@media (forced-colors: active) {
		.nav-button.flag-button[aria-pressed='true'] {
			border-color: Highlight;
			background-color: Highlight;
			color: HighlightText;
			forced-color-adjust: none;
		}

		.nav-button.flag-button[aria-pressed='true'] .nav-icon {
			fill: currentColor;
		}
	}

	/* The flag keeps its visible label at every width; it may use more of the row. */
	.nav-button.flag-button {
		max-inline-size: 60%;
	}

	/*
	 * Practice delivery: the item-level check control and its attempt counter stay
	 * together and wrap as one unit on narrow bars. The counter reads quieter than the
	 * control but never below AA contrast; the used-up explanation carries the warning
	 * tone so "max attempts reached" is not mistaken for a transient state.
	 */
	.check-group {
		display: flex;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem);
		min-inline-size: 0;
	}

	.check-button {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}

	.check-button:hover:not(:disabled, [aria-disabled='true']) {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 8%, var(--pie-qti-base-100, oklch(100% 0 0)));
	}

	.check-attempts {
		font-size: 0.8125em;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		white-space: nowrap;
	}

	.check-attempts.exhausted {
		color: var(--pie-qti-warning-text, #92400e);
		font-weight: 600;
	}

	.nav-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.nav-button:disabled,
	.nav-button[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.nav-icon {
		flex: none;
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}

	/* Arrows point along the reading direction. */
	.nav-icon-directional:dir(rtl) {
		transform: scaleX(-1);
	}

	/* The bar is its own size container, so its padding follows the viewport. */
	@media (max-width: 40rem) {
		.navigation-bar {
			padding-block: var(--pie-qti-space-2, 0.5rem);
			padding-inline: var(--pie-qti-space-3, 0.75rem);
		}
	}

	/*
	 * Narrow containers (phones, 400% zoom in a padded host): the position moves to its
	 * own row above the buttons and the navigational buttons shrink to icons — their
	 * names stay for assistive technology. The flag keeps its visible label at every
	 * width (it is never icon-only), so the button row stays on one line.
	 */
	@container (max-width: 30rem) {
		.navigation-buttons {
			flex-wrap: wrap;
			gap: var(--pie-qti-space-2, 0.5rem);
		}

		.progress-section {
			flex-basis: 100%;
			order: -1;
		}

		.nav-button {
			padding-inline: var(--pie-qti-space-2, 0.5rem);
		}

		.progress-section-title,
		.progress-answered,
		.progress-saved {
			font-size: 0.8125em;
		}

		.nav-button-label.collapsible {
			position: absolute;
			inline-size: 1px;
			block-size: 1px;
			margin: -1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
			border: 0;
		}

		.nav-button:has(.collapsible) {
			padding-inline: var(--pie-qti-space-2, 0.5rem);
		}
	}
</style>
