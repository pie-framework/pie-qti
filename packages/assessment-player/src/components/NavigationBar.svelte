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
	}

	const { navState, i18n, onPrevious, onNext, onSubmit, showProgress = true }: Props = $props();

	const progressPercentage = $derived(
		navState.totalItems > 0 ? ((navState.currentIndex + 1) / navState.totalItems) * 100 : 0,
	);
	const isLastItem = $derived(navState.currentIndex === navState.totalItems - 1);
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
		return {
			question,
			section: sectionLabel(),
			label: i18n?.t('accessibility.navigationRegion') ?? 'Assessment navigation',
			previous: i18n?.t('common.previous') ?? 'Previous',
			next: i18n?.t('common.next') ?? 'Next',
			submit: i18n?.t('assessment.navigation.submit') ?? 'Submit',
			progress: `${i18n?.t('assessment.navigation.progress', { percent }) ?? `Progress: ${percent}%`}: ${question}`,
		};
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
</script>

<nav class="navigation-bar pie-qti-chrome" aria-label={translations.label} aria-busy={busy}>
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
				</div>
				<progress class="progress-bar" value={progressPercentage} max="100" aria-label={translations.progress}></progress>
			</div>
		{:else}
			<div class="navigation-spacer"></div>
		{/if}

		{#if isLastItem}
			<!-- Submit button on last item -->
			<button
				type="button"
				class="nav-button primary"
				data-testid="assessment-submit"
				onclick={handleSubmit}
				aria-disabled={busy ? 'true' : undefined}
			>
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

	/* One row: Previous, the position, Next or Submit. */
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

	@container (max-width: 30rem) {
		.navigation-buttons {
			gap: var(--pie-qti-space-2, 0.5rem);
		}

		.nav-button {
			padding-inline: var(--pie-qti-space-2, 0.5rem);
		}

		.progress-section-title {
			font-size: 0.8125em;
		}
	}

	/* Very narrow (small phones, 400% zoom in a padded host): the arrows carry Previous/Next, the names stay for AT. */
	@container (max-width: 18rem) {
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
