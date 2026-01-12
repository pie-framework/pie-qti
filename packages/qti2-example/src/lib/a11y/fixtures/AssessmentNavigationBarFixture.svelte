<script lang="ts">
	import { getContext } from 'svelte';
	import type { NavigationState } from '@pie-qti/qti2-assessment-player';
	import NavigationBar from '@pie-qti/qti2-assessment-player/components/NavigationBar.svelte';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	// Get i18n from context (provided by layout)
	const contextI18nWrapper = getContext<{ value: SvelteI18nProvider | null } | undefined>('i18n');
	const i18n = $derived(contextI18nWrapper?.value);

	let navState = $state<NavigationState>({
		currentIndex: 0,
		totalItems: 5,
		canNext: true,
		canPrevious: false,
		isLoading: false,
		currentSection: { id: 'sec-1', index: 0, title: 'Section 1' },
		totalSections: 2,
	});
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">Fixture for progress and navigation controls.</p>

	{#if i18n}
		<NavigationBar
			{navState}
			{i18n}
			onPrevious={() => (navState = { ...navState, currentIndex: Math.max(0, navState.currentIndex - 1) })}
			onNext={() => (navState = { ...navState, currentIndex: Math.min(navState.totalItems - 1, navState.currentIndex + 1) })}
			onSubmit={() => {}}
		/>
	{:else}
		<div class="alert alert-warning">i18n not initialized</div>
	{/if}
</div>


