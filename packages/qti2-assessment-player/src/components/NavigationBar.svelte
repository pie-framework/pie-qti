<script lang="ts">
	import type { NavigationState } from '../types/index.js';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	interface Props {
		navState: NavigationState;
		i18n?: SvelteI18nProvider;
		onPrevious?: () => void;
		onNext?: () => void;
		onSubmit?: () => void;
		showProgress?: boolean;
	}

	const { navState, i18n, onPrevious, onNext, onSubmit, showProgress = true }: Props = $props();

	const progressPercentage = $derived(
		navState.totalItems > 0 ? ((navState.currentIndex + 1) / navState.totalItems) * 100 : 0,
	);

	// Simplified translations - no manual subscriptions needed
	// Locale changes trigger page refresh, so reactivity is not required
	const translations = $derived({
		question: i18n?.t('assessment.question', { current: navState.currentIndex + 1, total: navState.totalItems })
			?? `Question ${navState.currentIndex + 1} of ${navState.totalItems}`,
		section: navState.currentSection
			? (navState.currentSection.title ?? (i18n?.t('assessment.section', { current: navState.currentSection.index + 1, total: 0 })
				?? `Section ${navState.currentSection.index + 1}`))
			: null,
		previous: i18n?.t('common.previous') ?? 'Previous',
		next: i18n?.t('common.next') ?? 'Next',
		submit: i18n?.t('assessment.navigation.submit') ?? 'Submit',
	});
</script>

<div class="navigation-bar">
	<!-- Progress indicator -->
	{#if showProgress}
		<div class="progress-section">
			<div class="progress-label text-sm">
				{translations.question}
				{#if translations.section}
					<span class="text-base-content/60">
						({translations.section})
					</span>
				{/if}
			</div>
			<progress
				class="progress progress-primary w-full"
				value={progressPercentage}
				max="100"
			></progress>
		</div>
	{/if}

	<!-- Navigation buttons -->
	<div class="navigation-buttons">
		<button
			class="btn btn-outline"
			onclick={() => onPrevious?.()}
			disabled={!navState.canPrevious || navState.isLoading}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			{translations.previous}
		</button>

		<div class="flex-1"></div>

		{#if navState.currentIndex === navState.totalItems - 1}
			<!-- Submit button on last item -->
			<button class="btn btn-primary" onclick={() => onSubmit?.()} disabled={navState.isLoading}>
				{translations.submit}
			</button>
		{:else}
			<!-- Next button -->
			<button
				class="btn btn-primary"
				onclick={() => onNext?.()}
				disabled={!navState.canNext || navState.isLoading}
			>
				{translations.next}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		{/if}
	</div>
</div>

<style>
	.navigation-bar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		border-top: 1px solid var(--color-base-300);
		background: var(--color-base-100);
	}

	.progress-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.progress-label {
		font-weight: 500;
	}

	.navigation-buttons {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	@media (max-width: 640px) {
		.navigation-buttons {
			flex-direction: column;
		}

		.navigation-buttons button {
			width: 100%;
		}

		.flex-1 {
			display: none;
		}
	}
</style>
