<script lang="ts">
	
	import type { NavigationState } from '@pie-qti/qti2-assessment-player';
import NavigationBar from '@pie-qti/qti2-assessment-player/components/NavigationBar.svelte';

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

	<NavigationBar
		{navState}
		onPrevious={() => (navState = { ...navState, currentIndex: Math.max(0, navState.currentIndex - 1) })}
		onNext={() => (navState = { ...navState, currentIndex: Math.min(navState.totalItems - 1, navState.currentIndex + 1) })}
		onSubmit={() => {}}
	/>
</div>


